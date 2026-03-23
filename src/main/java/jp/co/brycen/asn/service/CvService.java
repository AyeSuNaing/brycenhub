package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.dto.CvDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;

@Service
public class CvService {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL   = "claude-haiku-4-5-20251001";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${cv.upload.path:uploads/cv/}")
    private String uploadPath;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper  = new ObjectMapper();

    public CvDto.CvAnalyzeResponse analyzeCv(MultipartFile file) throws IOException {
        byte[] fileBytes = file.getBytes();
        String base64Pdf = Base64.getEncoder().encodeToString(fileBytes);

        String originalName = file.getOriginalFilename();
        if (originalName != null) {
            String lower = originalName.toLowerCase();
            if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
                throw new RuntimeException("DOCX not supported. Please upload PDF.");
            }
        }

        Map<String, Object> documentSource = new HashMap<>();
        documentSource.put("type", "base64");
        documentSource.put("media_type", "application/pdf");
        documentSource.put("data", base64Pdf);

        Map<String, Object> documentBlock = new HashMap<>();
        documentBlock.put("type", "document");
        documentBlock.put("source", documentSource);

        Map<String, Object> textBlock = new HashMap<>();
        textBlock.put("type", "text");
        textBlock.put("text", buildCvPrompt());

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", Arrays.asList(documentBlock, textBlock));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", CLAUDE_MODEL);
        requestBody.put("max_tokens", 8000);
        requestBody.put("messages", Collections.singletonList(userMessage));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<?> content = (List<?>) response.getBody().get("content");
                if (content != null && !content.isEmpty()) {
                    Map<?, ?> firstBlock = (Map<?, ?>) content.get(0);
                    String jsonText = (String) firstBlock.get("text");
                    return parseClaudeResponse(jsonText);
                }
            }
        } catch (Exception e) {
            System.err.println("[CvService] Claude API error: " + e.getMessage());
            throw new RuntimeException("CV analysis failed: " + e.getMessage());
        }
        throw new RuntimeException("CV analysis failed: empty response");
    }

    private String buildCvPrompt() {
        return "You are a CV parser. Extract ALL information from this CV.\n\n"
             + "Return ONLY a valid JSON object. No markdown. No explanation.\n\n"
             + "JSON structure:\n"
             + "{\n"
             + "  \"detectedLanguage\": \"en\",\n"
             + "  \"name\": \"Full Name\",\n"
             + "  \"email\": \"email@example.com\",\n"
             + "  \"phone\": \"+855 12 345 678\",\n"
             + "  \"experienceYears\": 3,\n"
             + "  \"educationOriginal\": \"education in original language\",\n"
             + "  \"educationEn\": \"education in English\",\n"
             + "  \"experienceOriginal\": \"brief experience summary\",\n"
             + "  \"experienceEn\": \"brief experience summary in English\",\n"
             + "  \"skills\": [{\"skillName\": \"iOS (Swift)\", \"skillNameEn\": \"iOS (Swift)\", \"skillLevel\": \"SENIOR\"}],\n"
             + "  \"projects\": [{\"title\": \"App Name\", \"description\": \"1-2 sentences\", \"techStack\": \"Swift, Firebase\", \"duration\": \"2022-2023\", \"role\": \"iOS Developer\"}],\n"
             + "  \"socialLinks\": {\"linkedin\": \"url or null\", \"github\": \"url or null\", \"twitter\": null, \"facebook\": null, \"website\": \"url or null\", \"other\": null}\n"
             + "}\n\n"
             + "Rules:\n"
             + "- detectedLanguage: en|ja|my|km|vi|ko\n"
             + "- skillLevel: BEGINNER|MID|SENIOR|null\n"
             + "- skillNameEn: standard English tech name\n"
             + "- experienceYears: integer or null\n"
             + "- socialLinks.other: first extra link only (short)\n"
             + "- null for missing fields, not empty string\n"
             + "- IMPORTANT: Keep experienceOriginal and experienceEn SHORT (2-3 sentences max). Do NOT list every job.";
    }

    // ── Recover truncated JSON ────────────────────────────────────

    private String recoverTruncatedJson(String raw) {
        if (raw == null || raw.isEmpty()) return "{}";

        // Already valid?
        try {
            objectMapper.readValue(raw, Map.class);
            return raw;
        } catch (Exception ignored) {}

        System.out.println("[CvService] Truncated JSON detected, recovering...");

        // Find last safe position (after a complete top-level value)
        Deque<Character> stack = new ArrayDeque<>();
        boolean inStr   = false;
        boolean esc     = false;
        int     lastSafe = 0;
        char[]  chars   = raw.toCharArray();

        for (int i = 0; i < chars.length; i++) {
            char c = chars[i];
            if (esc)          { esc = false; continue; }
            if (c == '\\' && inStr) { esc = true; continue; }
            if (c == '"')     { inStr = !inStr; continue; }
            if (inStr)        continue;

            if (c == '{' || c == '[') {
                stack.push(c == '{' ? '}' : ']');
            } else if (c == '}' || c == ']') {
                if (!stack.isEmpty()) stack.pop();
                if (stack.size() == 1) lastSafe = i + 1;
            }
        }

        String trimmed = raw;
        if (lastSafe > 0 && lastSafe < raw.length()) {
            trimmed = raw.substring(0, lastSafe).trim();
            if (trimmed.endsWith(",")) {
                trimmed = trimmed.substring(0, trimmed.length() - 1).trim();
            }
        }

        trimmed = closeOpenStructures(trimmed);

        try {
            objectMapper.readValue(trimmed, Map.class);
            System.out.println("[CvService] JSON recovered OK");
            return trimmed;
        } catch (Exception e) {
            System.err.println("[CvService] Recovery failed: " + e.getMessage());
            return "{}";
        }
    }

    private String closeOpenStructures(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        boolean inStr = false;
        boolean esc   = false;

        for (char c : s.toCharArray()) {
            if (esc)          { esc = false; continue; }
            if (c == '\\' && inStr) { esc = true; continue; }
            if (c == '"')     { inStr = !inStr; continue; }
            if (inStr)        continue;

            if      (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if ((c == '}' || c == ']') && !stack.isEmpty()) stack.pop();
        }

        if (inStr) s = s + "\"";
        StringBuilder sb = new StringBuilder(s);
        while (!stack.isEmpty()) sb.append(stack.pop());
        return sb.toString();
    }

    // ── Parse Claude response ─────────────────────────────────────

    @SuppressWarnings("unchecked")
    private CvDto.CvAnalyzeResponse parseClaudeResponse(String jsonText) {
        try {
            String cleaned = jsonText.trim();

            // Strip markdown fences
            if (cleaned.contains("```")) {
                cleaned = cleaned.replaceAll("(?s)```[a-zA-Z]*\\s*", "").trim();
            }

            // Extract from first {
            int start = cleaned.indexOf('{');
            if (start > 0) cleaned = cleaned.substring(start);

            // Recover if truncated
            cleaned = recoverTruncatedJson(cleaned);

            Map<String, Object> json = objectMapper.readValue(cleaned, Map.class);

            // Skills
            List<CvDto.SkillItem> skills = new ArrayList<>();
            List<?> rawSkills = (List<?>) json.get("skills");
            if (rawSkills != null) {
                for (Object o : rawSkills) {
                    Map<?, ?> s = (Map<?, ?>) o;
                    skills.add(CvDto.SkillItem.builder()
                        .skillName  (getString(s, "skillName"))
                        .skillNameEn(getString(s, "skillNameEn"))
                        .skillLevel (normalizeLevel(getString(s, "skillLevel")))
                        .build());
                }
            }

            // Projects
            List<CvDto.ProjectItem> projects = new ArrayList<>();
            List<?> rawProjects = (List<?>) json.get("projects");
            if (rawProjects != null) {
                for (Object o : rawProjects) {
                    Map<?, ?> p = (Map<?, ?>) o;
                    CvDto.ProjectItem proj = CvDto.ProjectItem.builder()
                        .title      (getString(p, "title"))
                        .description(getString(p, "description"))
                        .techStack  (getString(p, "techStack"))
                        .duration   (getString(p, "duration"))
                        .role       (getString(p, "role"))
                        .build();
                    if (proj.getTitle() != null) projects.add(proj);
                }
            }

            // SocialLinks
            CvDto.SocialLinks socialLinks = null;
            Map<?, ?> rawSocial = (Map<?, ?>) json.get("socialLinks");
            if (rawSocial != null) {
                String li = getString(rawSocial, "linkedin");
                String gh = getString(rawSocial, "github");
                String tw = getString(rawSocial, "twitter");
                String fb = getString(rawSocial, "facebook");
                String ws = getString(rawSocial, "website");
                String ot = getString(rawSocial, "other");
                if (li != null || gh != null || tw != null || fb != null || ws != null || ot != null) {
                    socialLinks = CvDto.SocialLinks.builder()
                        .linkedin(li).github(gh).twitter(tw)
                        .facebook(fb).website(ws).other(ot)
                        .build();
                }
            }

            return CvDto.CvAnalyzeResponse.builder()
                .detectedLanguage  (getString(json, "detectedLanguage"))
                .name              (getString(json, "name"))
                .email             (getString(json, "email"))
                .phone             (getString(json, "phone"))
                .experienceYears   (getInt   (json, "experienceYears"))
                .educationOriginal (getString(json, "educationOriginal"))
                .educationEn       (getString(json, "educationEn"))
                .experienceOriginal(getString(json, "experienceOriginal"))
                .experienceEn      (getString(json, "experienceEn"))
                .skills            (skills)
                .projects          (projects)
                .socialLinks       (socialLinks)
                .build();

        } catch (Exception e) {
            System.err.println("[CvService] Parse error: " + e.getMessage());
            throw new RuntimeException("Failed to parse CV analysis result");
        }
    }

    // ── Save CV file ──────────────────────────────────────────────

    public String saveCvFile(MultipartFile file, Long userId) throws IOException {
        Path dir = Paths.get(uploadPath);
        if (!Files.exists(dir)) Files.createDirectories(dir);
        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv.pdf";
        String filename = userId + "_" + System.currentTimeMillis() + "_" + origName;
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return "uploads/cv/" + filename;
    }

    // ── Helpers ───────────────────────────────────────────────────

    private String getString(Map<?, ?> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        String s = val.toString().trim();
        return (s.isEmpty() || s.equals("null")) ? null : s;
    }

    private Integer getInt(Map<?, ?> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        try { return Integer.parseInt(val.toString().trim()); }
        catch (NumberFormatException e) { return null; }
    }

    private String normalizeLevel(String level) {
        if (level == null) return null;
        switch (level.toUpperCase().trim()) {
            case "BEGINNER": case "JUNIOR": case "ENTRY":  return "BEGINNER";
            case "MID":      case "INTERMEDIATE":          return "MID";
            case "SENIOR":   case "LEAD":   case "EXPERT": return "SENIOR";
            default: return null;
        }
    }
}