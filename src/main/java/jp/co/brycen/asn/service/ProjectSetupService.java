package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.ProjectSetupGuide;
import jp.co.brycen.asn.model.ProjectTechStack;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.ProjectSetupGuideRepository;
import jp.co.brycen.asn.repository.ProjectTechStackRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Generates AI-driven project setup guides + iterative error fixes.
 * v4 (2026-04-19): Iterative Fix Loop — AI learns from previous failed attempts.
 */
@Service
@Transactional
public class ProjectSetupService {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL   = "claude-haiku-4-5-20251001";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Autowired private ProjectSetupGuideRepository setupRepo;
    @Autowired private ProjectRepository           projectRepo;
    @Autowired private ProjectTechStackRepository  techRepo;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ProjectSetupGuide getGuide(Long projectId) {
        return setupRepo.findByProjectId(projectId).orElse(null);
    }

    public ProjectSetupGuide generate(Long projectId, String os) throws Exception {
        String targetOs = normalizeOs(os);

        Project project = projectRepo.findById(projectId)
            .orElseThrow(() -> new RuntimeException("Project not found"));

        List<ProjectTechStack> techStacks = techRepo.findByProjectIdOrderByPosition(projectId);
        if (techStacks.isEmpty()) {
            throw new RuntimeException("No tech stack defined. Please add tech stack first.");
        }

        String techStackJson = buildTechStackJson(techStacks);
        String prompt = buildSetupPrompt(project, techStackJson, targetOs);
        String jsonResponse = callClaude(prompt, 4000);

        String cleanJson = extractJson(jsonResponse);
        String contentWithOs = injectOsMarker(cleanJson, targetOs);
        objectMapper.readTree(contentWithOs);

        ProjectSetupGuide guide = setupRepo.findByProjectId(projectId).orElse(
            ProjectSetupGuide.builder().projectId(projectId).build()
        );
        guide.setContent(contentWithOs);
        guide.setGeneratedBy("AI");
        guide.setTechStackSnapshot(techStackJson);
        return setupRepo.save(guide);
    }

    // ════════════════════════════════════════════════════════════════
    // ✨ ITERATIVE FIX — now accepts previous attempts
    // ════════════════════════════════════════════════════════════════
    public Map<String, Object> fixError(
            Long projectId,
            String stepTitle,
            String command,
            String errorOutput,
            String os,
            List<Map<String, String>> previousAttempts) throws Exception {

        String targetOs = normalizeOs(os);

        Project project = projectRepo.findById(projectId)
            .orElseThrow(() -> new RuntimeException("Project not found"));

        List<ProjectTechStack> techStacks = techRepo.findByProjectIdOrderByPosition(projectId);
        String techStackJson = buildTechStackJson(techStacks);

        String prompt = buildFixErrorPrompt(project, techStackJson, targetOs,
                                             stepTitle, command, errorOutput,
                                             previousAttempts);

        String jsonResponse = callClaude(prompt, 2500);
        String cleanJson = extractJson(jsonResponse);

        JsonNode parsed = objectMapper.readTree(cleanJson);
        Map<String, Object> result = objectMapper.convertValue(parsed, Map.class);

        if (!result.containsKey("problem"))     result.put("problem", "Unknown error");
        if (!result.containsKey("solution"))    result.put("solution", "");
        if (!result.containsKey("commands"))    result.put("commands", new ArrayList<>());
        if (!result.containsKey("explanation")) result.put("explanation", "");

        return result;
    }

    public ProjectSetupGuide save(Long projectId, String content) {
        ProjectSetupGuide guide = setupRepo.findByProjectId(projectId).orElse(
            ProjectSetupGuide.builder().projectId(projectId).build()
        );
        guide.setContent(content);
        guide.setGeneratedBy("MANUAL");
        return setupRepo.save(guide);
    }

    public void delete(Long projectId) {
        setupRepo.deleteByProjectId(projectId);
    }

    // ────────────────────────────────────────────────────────────────
    private String normalizeOs(String os) {
        if (os == null) return "macos";
        String lower = os.toLowerCase().trim();
        if (lower.contains("mac") || lower.equals("darwin") || lower.equals("osx")) return "macos";
        if (lower.contains("win")) return "windows";
        if (lower.contains("linux") || lower.contains("ubuntu") || lower.contains("debian")) return "linux";
        return "macos";
    }

    private String buildTechStackJson(List<ProjectTechStack> techStacks) throws Exception {
        List<Map<String, String>> list = new ArrayList<>();
        for (ProjectTechStack ts : techStacks) {
            Map<String, String> m = new HashMap<>();
            m.put("name",     ts.getName());
            m.put("category", ts.getCategory() != null ? ts.getCategory() : "other");
            list.add(m);
        }
        return objectMapper.writeValueAsString(list);
    }

    private String injectOsMarker(String json, String os) {
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node.isObject()) {
                com.fasterxml.jackson.databind.node.ObjectNode obj =
                    (com.fasterxml.jackson.databind.node.ObjectNode) node;
                obj.put("os", os);
                return objectMapper.writeValueAsString(obj);
            }
        } catch (Exception e) {
            // ignore
        }
        return json;
    }

    // ────────────────────────────────────────────────────────────────
    private String buildSetupPrompt(Project project, String techStackJson, String os) {
        String osLabel = osDisplayName(os);
        String osHints = osSpecificHints(os);
        String scaffoldRules = scaffoldSpecificRules(os);

        return "You are a senior DevOps engineer creating a project setup guide "
             + "for a developer using " + osLabel + ".\n\n"
             + "The PM has already created an empty GitHub repo with member permissions.\n"
             + "Now generate step-by-step commands to scaffold, init git, and push.\n\n"
             + "=== TARGET OS ===\n" + osLabel + "\n\n"
             + osHints + "\n\n"
             + scaffoldRules + "\n\n"
             + "=== PROJECT ===\n"
             + "Title: " + project.getTitle() + "\n"
             + "Description: " + (project.getDescription() != null ? project.getDescription() : "(no description)") + "\n\n"
             + "=== TECH STACK ===\n" + techStackJson + "\n\n"
             + "Return ONLY valid JSON:\n"
             + "{\n"
             + "  \"summary\": \"Short 1-line stack description\",\n"
             + "  \"steps\": [\n"
             + "    {\"title\":\"Step\",\"description\":\"Brief\",\"commands\":[\"# Comment\",\"cmd\"]}\n"
             + "  ]\n"
             + "}\n\n"
             + "Rules:\n"
             + "- 5-8 steps: Prereqs → Clone → FE scaffold → BE scaffold → DB → .gitignore/README → Commit+Push\n"
             + "- Use <REPO_URL>, <DB_NAME> placeholders\n"
             + "- Commands must be copy-paste ready (NO interactive prompts)";
    }

    // ════════════════════════════════════════════════════════════════
    // ✨ Fix error prompt — now includes previous attempts context
    // ════════════════════════════════════════════════════════════════
    private String buildFixErrorPrompt(Project project, String techStackJson, String os,
                                        String stepTitle, String command, String errorOutput,
                                        List<Map<String, String>> previousAttempts) {

        String osLabel = osDisplayName(os);
        int attemptNum = (previousAttempts == null ? 0 : previousAttempts.size()) + 1;

        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a senior DevOps engineer helping a developer fix a setup error.\n\n");
        prompt.append("=== CONTEXT ===\n");
        prompt.append("Operating System: ").append(osLabel).append("\n");
        prompt.append("Project: ").append(project.getTitle()).append("\n");
        prompt.append("Tech Stack: ").append(techStackJson).append("\n");
        prompt.append("Current Step: ").append(stepTitle).append("\n");
        prompt.append("Attempt: ").append(attemptNum).append(" of max 5\n\n");

        prompt.append("=== ORIGINAL COMMAND ===\n")
              .append(command != null ? command : "(not provided)").append("\n\n");

        // ── Include previous attempts if any ──
        if (previousAttempts != null && !previousAttempts.isEmpty()) {
            prompt.append("=== PREVIOUS FAILED ATTEMPTS ===\n");
            prompt.append("The user tried the following fixes and they DID NOT work. ")
                  .append("DO NOT suggest the same approaches again — try a DIFFERENT angle.\n\n");

            int n = 1;
            for (Map<String, String> attempt : previousAttempts) {
                prompt.append("--- Attempt ").append(n++).append(" ---\n");
                prompt.append("What was suggested: ").append(attempt.getOrDefault("suggestedSolution", "(unknown)")).append("\n");
                prompt.append("Commands tried: ").append(attempt.getOrDefault("triedCommands", "(unknown)")).append("\n");
                prompt.append("Why it failed: ").append(attempt.getOrDefault("newError", "(still failing)")).append("\n\n");
            }

            prompt.append("=== CURRENT ERROR (after trying above) ===\n");
        } else {
            prompt.append("=== ERROR OUTPUT ===\n");
        }

        prompt.append(errorOutput != null ? errorOutput : "(not provided)").append("\n\n");

        prompt.append("Analyze the error and provide a DIFFERENT fix approach.\n\n");
        prompt.append("Return ONLY valid JSON:\n");
        prompt.append("{\n");
        prompt.append("  \"problem\": \"One sentence describing root cause\",\n");
        prompt.append("  \"solution\": \"One sentence describing NEW approach (different from previous attempts)\",\n");
        prompt.append("  \"commands\": [\"# Comment\", \"shell command\"],\n");
        prompt.append("  \"explanation\": \"2-3 sentences explaining WHY this is different and should work\"\n");
        prompt.append("}\n\n");

        prompt.append("CRITICAL Guidelines:\n");
        prompt.append("- If previous attempts exist, ACKNOWLEDGE them in explanation (e.g. \"Last approach failed because X, trying Y instead\")\n");
        prompt.append("- NEVER suggest the same commands as previous attempts\n");
        prompt.append("- Escalate strategy: attempt 1=preferred fix, attempt 2=alternative approach, attempt 3+=workaround/force install\n");
        prompt.append("- Be SPECIFIC to the current error\n");
        prompt.append("- Commands must be valid for ").append(osLabel).append("\n\n");

        prompt.append("=== NPM PEER DEPENDENCY PATTERNS (CRITICAL) ===\n");
        prompt.append("- ERESOLVE peer conflict: first try removing the conflicting package, then --legacy-peer-deps\n");
        prompt.append("- ETARGET no matching version: remove explicit version pin, let npm resolve\n");
        prompt.append("- EACCES permission: use sudo (Unix) or run as Admin (Windows), or fix npm global prefix\n");
        prompt.append("- For @angular/fire conflicts with Angular 21+: recommend using firebase SDK directly instead (skip @angular/fire)\n");
        prompt.append("- For Flutter version mismatches: recommend flutter doctor + upgrade/downgrade specific channel\n");

        return prompt.toString();
    }

    private String scaffoldSpecificRules(String os) {
        return "=== CRITICAL SCAFFOLD RULES ===\n\n"
             + "### Spring Boot — MANDATORY parameters:\n"
             + "curl -s https://start.spring.io/starter.zip \\\n"
             + "  -d type=maven-project -d language=java \\\n"
             + "  -d bootVersion=3.5.5 -d baseDir=. \\\n"
             + "  -d groupId=com.<name> -d artifactId=<name>-api \\\n"
             + "  -d name=<name>-api -d packageName=com.<name> \\\n"
             + "  -d packaging=jar -d javaVersion=17 \\\n"
             + "  -d dependencies=web,mysql,data-jpa,validation,lombok,devtools \\\n"
             + "  -o spring-boot-project.zip\n"
             + "- DO NOT include 'security' (dev friction)\n"
             + "- After unzip: chmod +x mvnw\n\n"
             + "### Angular — MANDATORY flags:\n"
             + "ng new <app> --routing --style=scss --skip-git --ssr=false --defaults\n\n"
             + "### Firebase integration — AVOID @angular/fire (lags Angular version):\n"
             + "Use: npm install firebase (SDK directly — stable across versions)\n\n"
             + "### Git — use placeholders, not hardcoded emails:\n"
             + "git config user.name \"<YOUR_NAME>\"\n"
             + "git config user.email \"<YOUR_EMAIL>\"";
    }

    private String osDisplayName(String os) {
        switch (os) {
            case "windows": return "Windows (PowerShell)";
            case "linux":   return "Linux (Ubuntu/Debian bash)";
            default:        return "macOS (zsh/bash with Homebrew)";
        }
    }

    private String osSpecificHints(String os) {
        switch (os) {
            case "windows":
                return "=== WINDOWS ===\nPowerShell, Chocolatey, choco install nodejs-lts -y";
            case "linux":
                return "=== LINUX ===\napt package manager, sudo apt install -y";
            default:
                return "=== MACOS ===\nzsh/bash with Homebrew, Apple Silicon compatible";
        }
    }

    private String callClaude(String prompt, int maxTokens) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("model",      CLAUDE_MODEL);
        body.put("max_tokens", maxTokens);
        body.put("messages",   List.of(Map.of("role", "user", "content", prompt)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key",         apiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            List<?> content = (List<?>) response.getBody().get("content");
            if (content != null && !content.isEmpty()) {
                Map<?, ?> first = (Map<?, ?>) content.get(0);
                return (String) first.get("text");
            }
        }
        throw new RuntimeException("Claude API returned empty response");
    }

    private String extractJson(String raw) {
        if (raw == null) return "{}";
        String cleaned = raw.trim();
        if (cleaned.contains("```")) {
            cleaned = cleaned.replaceAll("(?s)```[a-zA-Z]*\\s*", "").trim();
        }
        int start = cleaned.indexOf('{');
        int end   = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            cleaned = cleaned.substring(start, end + 1);
        }
        return cleaned;
    }
}