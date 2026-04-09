package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.model.ProjectRule;
import jp.co.brycen.asn.repository.ProjectRuleRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.*;
import java.util.*;

@Service
@Transactional
public class ProjectRuleService {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL   = "claude-haiku-4-5-20251001";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${rule.upload.path:uploads/rules/}")
    private String uploadPath;

    @Autowired
    private ProjectRuleRepository ruleRepo;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper  = new ObjectMapper();

    // ================================================================
    // GET — active rules by project
    // ================================================================
    public List<ProjectRule> getActiveRules(Long projectId) {
        return ruleRepo.findByProjectIdAndIsActiveTrueOrderByPosition(projectId);
    }

    // ================================================================
    // GET — rules by project + category
    // ================================================================
    public List<ProjectRule> getRulesByCategory(Long projectId, ProjectRule.Category category) {
        return ruleRepo.findByProjectIdAndCategoryAndIsActiveTrueOrderByPosition(projectId, category);
    }

    // ================================================================
    // POST — analyze uploaded file (PDF / DOCX / XLSX / TXT)
    // Returns preview list — NOT saved yet (PM must confirm)
    // ================================================================
    public List<Map<String, Object>> analyzeFile(MultipartFile file, Long projectId) throws Exception {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String fileType = detectFileType(filename);
        String savedUrl = saveFile(file, projectId, fileType);

        List<Map<String, Object>> rules;

        if ("pdf".equals(fileType)) {
            // PDF — use Claude document block (base64)
            rules = analyzeViaPdfBlock(file);
        } else {
            // DOCX / XLSX / TXT — extract text first, then send as text block
            String extractedText = extractText(file, fileType);
            rules = analyzeViaTextBlock(extractedText);
        }

        // Attach file metadata to each rule for later save
        rules.forEach(r -> {
            r.put("sourceFileUrl",  savedUrl);
            r.put("sourceFileType", fileType);
            r.put("source",         "AI_GENERATED");
        });

        return rules;
    }

    // ================================================================
    // POST — confirm & save rules to DB (after PM review)
    // ================================================================
    public List<ProjectRule> confirmRules(Long projectId, Long createdBy,
                                          List<Map<String, Object>> ruleItems) {
        List<ProjectRule> saved = new ArrayList<>();
        int pos = getNextPosition(projectId);

        for (Map<String, Object> item : ruleItems) {
            ProjectRule rule = ProjectRule.builder()
                .projectId     (projectId)
                .title         (getString(item, "title"))
                .content       (getString(item, "content"))
                .category      (parseCategory(getString(item, "category")))
                .source        (parseSource(getString(item, "source")))
                .sourceFileUrl (getString(item, "sourceFileUrl"))
                .sourceFileType(getString(item, "sourceFileType"))
                .position      (pos++)
                .isActive      (true)
                .createdBy     (createdBy)
                .build();
            saved.add(ruleRepo.save(rule));
        }
        return saved;
    }

    // ================================================================
    // POST — save single manual rule
    // ================================================================
    public ProjectRule saveManual(Long projectId, Long createdBy,
                                  String title, String content,
                                  ProjectRule.Category category) {
        int pos = getNextPosition(projectId);
        return ruleRepo.save(ProjectRule.builder()
            .projectId(projectId)
            .title    (title)
            .content  (content)
            .category (category)
            .source   (ProjectRule.Source.MANUAL)
            .position (pos)
            .isActive (true)
            .createdBy(createdBy)
            .build());
    }

    // ================================================================
    // PUT — update rule
    // ================================================================
    public ProjectRule update(Long ruleId, String title, String content,
                              ProjectRule.Category category) {
        ProjectRule rule = ruleRepo.findById(ruleId)
            .orElseThrow(() -> new RuntimeException("Rule not found: " + ruleId));
        if (title    != null) rule.setTitle(title);
        if (content  != null) rule.setContent(content);
        if (category != null) rule.setCategory(category);
        return ruleRepo.save(rule);
    }

    // ================================================================
    // DELETE — soft delete
    // ================================================================
    public void softDelete(Long ruleId) {
        ProjectRule rule = ruleRepo.findById(ruleId)
            .orElseThrow(() -> new RuntimeException("Rule not found: " + ruleId));
        rule.setIsActive(false);
        ruleRepo.save(rule);
    }

    // ================================================================
    // BUILD SYSTEM PROMPT — Design Tool code gen inject
    // ================================================================
    public String buildCodeGenSystemPrompt(Long projectId) {
        List<ProjectRule> rules = getActiveRules(projectId);
        if (rules.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        sb.append("== PROJECT RULES (Follow strictly) ==\n\n");

        Map<ProjectRule.Category, List<ProjectRule>> grouped = new LinkedHashMap<>();
        for (ProjectRule.Category cat : ProjectRule.Category.values()) {
            grouped.put(cat, new ArrayList<>());
        }
        for (ProjectRule r : rules) {
            grouped.get(r.getCategory()).add(r);
        }

        grouped.forEach((cat, list) -> {
            if (list.isEmpty()) return;
            sb.append("[").append(categoryLabel(cat)).append("]\n");
            list.forEach(r -> sb.append("- ").append(r.getTitle())
                                 .append(": ").append(r.getContent()).append("\n"));
            sb.append("\n");
        });

        sb.append("Generate code that strictly follows all rules above.\n");
        return sb.toString();
    }

    // ================================================================
    // PRIVATE — File type detection
    // ================================================================
    private String detectFileType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf"))  return "pdf";
        if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
        if (lower.endsWith(".txt"))  return "txt";
        throw new RuntimeException("Unsupported format. Allowed: PDF, DOCX, XLSX, TXT");
    }

    // ================================================================
    // PRIVATE — Text extraction (Apache POI)
    // ================================================================
    private String extractText(MultipartFile file, String fileType) throws Exception {
        switch (fileType) {
            case "docx": return extractFromDocx(file);
            case "xlsx": return extractFromXlsx(file);
            case "txt":  return new String(file.getBytes());
            default:     throw new RuntimeException("Cannot extract text from: " + fileType);
        }
    }

    private String extractFromDocx(MultipartFile file) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(file.getInputStream());
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            String text = extractor.getText();
            if (text == null || text.trim().isEmpty()) {
                throw new RuntimeException("Word document is empty or unreadable.");
            }
            return text;
        }
    }

    private String extractFromXlsx(MultipartFile file) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(file.getInputStream())) {
            StringBuilder sb        = new StringBuilder();
            DataFormatter formatter = new DataFormatter();

            for (int si = 0; si < wb.getNumberOfSheets(); si++) {
                Sheet sheet = wb.getSheetAt(si);
                sb.append("=== Sheet: ").append(sheet.getSheetName()).append(" ===\n");

                for (Row row : sheet) {
                    boolean rowHasData = false;
                    StringBuilder rowSb = new StringBuilder();
                    for (Cell cell : row) {
                        String val = formatter.formatCellValue(cell).trim();
                        if (!val.isEmpty()) rowHasData = true;
                        rowSb.append(val).append("\t");
                    }
                    if (rowHasData) sb.append(rowSb.toString().stripTrailing()).append("\n");
                }
                sb.append("\n");
            }

            String text = sb.toString().trim();
            if (text.isEmpty()) throw new RuntimeException("Excel file is empty.");
            return text;
        }
    }

    // ================================================================
    // PRIVATE — Claude call: PDF document block
    // ================================================================
    private List<Map<String, Object>> analyzeViaPdfBlock(MultipartFile file) throws Exception {
        String base64Pdf = Base64.getEncoder().encodeToString(file.getBytes());

        Map<String, Object> docSource = new HashMap<>();
        docSource.put("type",       "base64");
        docSource.put("media_type", "application/pdf");
        docSource.put("data",       base64Pdf);

        Map<String, Object> docBlock = new HashMap<>();
        docBlock.put("type",   "document");
        docBlock.put("source", docSource);

        Map<String, Object> textBlock = new HashMap<>();
        textBlock.put("type", "text");
        textBlock.put("text", buildRuleAnalyzePrompt("document"));

        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role",    "user");
        userMsg.put("content", Arrays.asList(docBlock, textBlock));

        return callClaudeAndParse(userMsg);
    }

    // ================================================================
    // PRIVATE — Claude call: text block (DOCX / XLSX / TXT)
    // ================================================================
    private List<Map<String, Object>> analyzeViaTextBlock(String extractedText) throws Exception {
        // Limit to ~50k chars to avoid token overflow
        String text = extractedText.length() > 50000
            ? extractedText.substring(0, 50000) + "\n...(truncated)"
            : extractedText;

        String prompt = buildRuleAnalyzePrompt("text")
            + "\n\n=== DOCUMENT CONTENT ===\n" + text;

        Map<String, Object> textBlock = new HashMap<>();
        textBlock.put("type", "text");
        textBlock.put("text", prompt);

        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role",    "user");
        userMsg.put("content", Collections.singletonList(textBlock));

        return callClaudeAndParse(userMsg);
    }

    // ================================================================
    // PRIVATE — Shared Claude API call + JSON parse
    // ================================================================
    private List<Map<String, Object>> callClaudeAndParse(Map<String, Object> userMsg) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("model",      CLAUDE_MODEL);
        body.put("max_tokens", 4000);
        body.put("messages",   Collections.singletonList(userMsg));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key",        apiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            List<?> content = (List<?>) response.getBody().get("content");
            if (content != null && !content.isEmpty()) {
                Map<?, ?> first    = (Map<?, ?>) content.get(0);
                String    jsonText = (String) first.get("text");
                return parseRulesFromClaude(jsonText);
            }
        }
        throw new RuntimeException("File analysis failed: empty response from Claude");
    }

    // ================================================================
    // PRIVATE — Prompt builder
    // ================================================================
    private String buildRuleAnalyzePrompt(String inputType) {
        return "You are a project rules extractor.\n\n"
             + "Analyze this " + inputType + " (coding guide / process doc / team handbook) "
             + "and extract ALL rules, standards, and guidelines.\n\n"
             + "Return ONLY a valid JSON array. No markdown. No explanation.\n\n"
             + "Format:\n"
             + "[\n"
             + "  {\n"
             + "    \"title\":    \"Short rule title (max 100 chars)\",\n"
             + "    \"content\":  \"Detailed rule description\",\n"
             + "    \"category\": \"CODING_STANDARDS\" | \"PROCESS_RULES\" | \"GENERAL\",\n"
             + "    \"source\":   \"AI_GENERATED\"\n"
             + "  }\n"
             + "]\n\n"
             + "Category guide:\n"
             + "- CODING_STANDARDS: naming, folder structure, code style, patterns\n"
             + "- PROCESS_RULES: PR review, testing, deployment, workflow\n"
             + "- GENERAL: team rules, communication, anything else\n\n"
             + "Extract as many specific, actionable rules as possible.";
    }

    // ================================================================
    // PRIVATE — Parse Claude JSON array response
    // ================================================================
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseRulesFromClaude(String jsonText) {
        try {
            String cleaned = jsonText.trim();
            if (cleaned.contains("```")) {
                cleaned = cleaned.replaceAll("(?s)```[a-zA-Z]*\\s*", "").trim();
            }
            int start = cleaned.indexOf('[');
            int end   = cleaned.lastIndexOf(']');
            if (start >= 0 && end > start) {
                cleaned = cleaned.substring(start, end + 1);
            }
            return objectMapper.readValue(cleaned, List.class);
        } catch (Exception e) {
            System.err.println("[ProjectRuleService] JSON parse error: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ================================================================
    // PRIVATE — Save uploaded file to disk
    // ================================================================
    private String saveFile(MultipartFile file, Long projectId, String fileType) throws Exception {
        Path dir = Paths.get(uploadPath, "project-" + projectId);
        Files.createDirectories(dir);
        String filename   = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path   targetPath = dir.resolve(filename);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        return uploadPath + "project-" + projectId + "/" + filename;
    }

    // ================================================================
    // PRIVATE — Misc helpers
    // ================================================================
    private int getNextPosition(Long projectId) {
        List<ProjectRule> existing = ruleRepo.findByProjectIdOrderByPosition(projectId);
        return existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getPosition() + 1;
    }

    private String getString(Map<?, ?> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : "";
    }

    private ProjectRule.Category parseCategory(String s) {
        try { return ProjectRule.Category.valueOf(s); }
        catch (Exception e) { return ProjectRule.Category.GENERAL; }
    }

    private ProjectRule.Source parseSource(String s) {
        try { return ProjectRule.Source.valueOf(s); }
        catch (Exception e) { return ProjectRule.Source.AI_GENERATED; }
    }

    private String categoryLabel(ProjectRule.Category cat) {
        switch (cat) {
            case CODING_STANDARDS: return "CODING STANDARDS";
            case PROCESS_RULES:    return "PROCESS RULES";
            default:               return "GENERAL";
        }
    }
}
