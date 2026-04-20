package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.dto.ProjectDesignDto;
import jp.co.brycen.asn.dto.ai.AiAssistantRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Extracts structured API endpoints + DB tables from generated code files
 * using Claude AI, then saves to DB via ProjectDesignService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectDesignExtractService {

    @Value("${anthropic.api.key}")
    private String apiKey;

    private static final String CLAUDE_URL   = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL = "claude-sonnet-4-20250514"; // Sonnet for better extraction

    private final RestTemplate     restTemplate;
    private final ObjectMapper     objectMapper;
    private final ProjectDesignService projectDesignService;

    // ── Main entry point ─────────────────────────────────────────────
    public void extractAndSave(Long projectId, Long generatedBy,
                               String frameName,
                               List<ProjectDesignDto.FileItem> files) {
        log.info("[Extract] projectId={} frame={} files={}", projectId, frameName,
            files != null ? files.size() : 0);

        if (files == null || files.isEmpty()) {
            log.warn("[Extract] No files provided");
            return;
        }

        try {
            // Build combined code context (max 12000 chars)
            StringBuilder code = new StringBuilder();
            for (ProjectDesignDto.FileItem f : files) {
                code.append("// === ").append(f.getFileName()).append(" ===\n");
                String content = f.getFileContent() != null ? f.getFileContent() : "";
                code.append(content, 0, Math.min(content.length(), 3000)).append("\n\n");
                if (code.length() > 12000) break;
            }

            log.info("[Extract] Calling Claude AI for extraction, code size={}", code.length());
            String aiJson = callClaude(buildExtractPrompt(frameName, code.toString()));
            log.info("[Extract] Claude response preview: {}", aiJson.substring(0, Math.min(200, aiJson.length())));
            ParsedDesign design = parseAiResponse(aiJson);
            log.info("[Extract] Parsed: {} endpoints, {} tables", design.endpoints.size(), design.tables.size());

            // Auto-detect better frame name from endpoints if original is generic
            String effectiveFrameName = frameName;
            if (isGenericFrameName(frameName) && !design.endpoints.isEmpty()) {
                effectiveFrameName = detectPageType(design.endpoints, frameName);
                log.info("[Extract] Frame name: '{}' → '{}'", frameName, effectiveFrameName);
            }

            // Build SaveRequest
            ProjectDesignDto.SaveRequest req = new ProjectDesignDto.SaveRequest();
            req.setProjectId(projectId);
            req.setGeneratedBy(generatedBy);
            req.setFrameName(effectiveFrameName);
            req.setFiles(files);
            req.setApiEndpoints(design.endpoints);
            req.setDbTables(design.tables);

            projectDesignService.saveGenerated(req);
            log.info("[Extract] Saved: {} APIs, {} tables", design.endpoints.size(), design.tables.size());

        } catch (Exception e) {
            log.error("[Extract] Failed: {}", e.getMessage(), e);
            // Fallback: save files without extract
            ProjectDesignDto.SaveRequest req = new ProjectDesignDto.SaveRequest();
            req.setProjectId(projectId);
            req.setGeneratedBy(generatedBy);
            req.setFrameName(frameName);
            req.setFiles(files);
            req.setApiEndpoints(List.of());
            req.setDbTables(List.of());
            projectDesignService.saveGenerated(req);
        }
    }

    // ── Build extraction prompt ───────────────────────────────────────
//    private String buildExtractPrompt(String frameName, String code) {
//        return "You are a code analyzer. Analyze the following generated code for a UI frame called \""
//            + frameName + "\".\n\n"
//            + "Extract ALL API endpoints and database tables.\n\n"
//            + "=== CODE ===\n" + code + "\n=== END CODE ===\n\n"
//            + "Return ONLY a valid JSON object (no markdown):\n"
//            + "{\n"
//            + "  \"endpoints\": [\n"
//            + "    {\n"
//            + "      \"method\": \"POST\",\n"
//            + "      \"url\": \"/api/auth/login\",\n"
//            + "      \"description\": \"Authenticate user\",\n"
//            + "      \"requestBody\": \"{\\\"email\\\":\\\"string\\\",\\\"password\\\":\\\"string\\\"}\",\n"
//            + "      \"responseBody\": \"{\\\"token\\\":\\\"string\\\",\\\"user\\\":{\\\"id\\\":\\\"number\\\",\\\"email\\\":\\\"string\\\"}}\",\n"
//            + "      \"pathParams\": \"\",\n"
//            + "      \"queryParams\": \"\",\n"
//            + "      \"statusCodes\": \"200,400,401,500\"\n"
//            + "    }\n"
//            + "  ],\n"
//            + "  \"tables\": [\n"
//            + "    {\n"
//            + "      \"tableName\": \"users\",\n"
//            + "      \"columns\": \"id INT PK, email VARCHAR(255), password VARCHAR(255), created_at TIMESTAMP\",\n"
//            + "      \"description\": \"User accounts\"\n"
//            + "    }\n"
//            + "  ]\n"
//            + "}\n\n"
//            + "Rules:\n"
//            + "- requestBody/responseBody: compact JSON schema string\n"
//            + "- statusCodes: comma-separated HTTP codes\n"
//            + "- Extract from route definitions, controller methods, SQL queries\n"
//            + "- If none found, return empty arrays";
//    }
    
    private String buildExtractPrompt(String frameName, String code) {
        return "You are a full-stack database + API architect.\n\n"
            + "Analyze the following generated code for a UI frame called \""
            + frameName + "\".\n\n"
            + "Your job has TWO parts:\n"
            + "1. EXTRACT all API endpoints from the code (controllers, routes, HTTP calls).\n"
            + "2. INFER all database tables that this feature MUST have to work properly.\n"
            + "   Even if no SQL/Entity code is present, DESIGN the tables based on:\n"
            + "     - The API request/response bodies (fields = columns)\n"
            + "     - The API URL patterns (e.g. /auth/login → users table)\n"
            + "     - Standard relational DB practices (id PK, timestamps, FKs)\n"
            + "     - The UI context (frame name: \"" + frameName + "\")\n\n"
            + "=== CODE ===\n" + code + "\n=== END CODE ===\n\n"
            + "Return ONLY a valid JSON object (no markdown, no explanation):\n"
            + "{\n"
            + "  \"endpoints\": [\n"
            + "    {\n"
            + "      \"method\": \"POST\",\n"
            + "      \"url\": \"/api/auth/login\",\n"
            + "      \"description\": \"Authenticate user\",\n"
            + "      \"requestBody\": \"{\\\"email\\\":\\\"string\\\",\\\"password\\\":\\\"string\\\"}\",\n"
            + "      \"responseBody\": \"{\\\"token\\\":\\\"string\\\",\\\"user\\\":{\\\"id\\\":\\\"number\\\",\\\"email\\\":\\\"string\\\"}}\",\n"
            + "      \"pathParams\": \"\",\n"
            + "      \"queryParams\": \"\",\n"
            + "      \"statusCodes\": \"200,400,401,500\"\n"
            + "    }\n"
            + "  ],\n"
            + "  \"tables\": [\n"
            + "    {\n"
            + "      \"tableName\": \"users\",\n"
            + "      \"columns\": \"id BIGINT PK AUTO_INCREMENT, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, name VARCHAR(100), role VARCHAR(50), created_at TIMESTAMP, updated_at TIMESTAMP\",\n"
            + "      \"description\": \"User accounts for authentication and profile\"\n"
            + "    },\n"
            + "    {\n"
            + "      \"tableName\": \"user_sessions\",\n"
            + "      \"columns\": \"id BIGINT PK AUTO_INCREMENT, user_id BIGINT FK users(id), token VARCHAR(500) NOT NULL, expires_at TIMESTAMP, created_at TIMESTAMP\",\n"
            + "      \"description\": \"Active JWT session tokens\"\n"
            + "    }\n"
            + "  ]\n"
            + "}\n\n"
            + "Rules for ENDPOINTS:\n"
            + "- Extract from controller methods, @RequestMapping, HTTP calls, fetch/http.post/http.get\n"
            + "- requestBody/responseBody: compact JSON schema string\n"
            + "- statusCodes: comma-separated HTTP codes\n\n"
            + "Rules for TABLES (IMPORTANT — INFER, don't just extract):\n"
            + "- ALWAYS return at least 1 table if the frame has any API call or form\n"
            + "- Login/Register screens → infer: users, (optional) user_sessions/user_roles\n"
            + "- Product listing → infer: products, categories, (optional) product_images\n"
            + "- Shopping cart → infer: cart_items, orders, order_items, products\n"
            + "- Dashboard → infer: the domain entities shown (tasks, projects, users...)\n"
            + "- Profile → infer: users, (optional) addresses, preferences\n"
            + "- Column format: 'name TYPE[(size)] [PK|FK table(col)|UNIQUE|NOT NULL]'\n"
            + "- Always include: id (PK), created_at, updated_at when meaningful\n"
            + "- Use realistic types: BIGINT, VARCHAR(255), TEXT, TIMESTAMP, DECIMAL(10,2), BOOLEAN\n"
            + "- Prefer snake_case for columns, plural snake_case for table names\n"
            + "- Only return empty tables array if frame is purely decorative (splash, error page)";
    }
    

    // ── Call Claude API ───────────────────────────────────────────────
    private String callClaude(String prompt) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("model",     CLAUDE_MODEL);
        body.put("max_tokens", 3000);
        body.put("messages",  List.of(Map.of("role", "user", "content", prompt)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key",         apiKey);
        headers.set("anthropic-version",  "2023-06-01");

        ResponseEntity<String> resp = restTemplate.postForEntity(
            CLAUDE_URL, new HttpEntity<>(body, headers), String.class);
        JsonNode root = objectMapper.readTree(resp.getBody());
        return root.path("content").get(0).path("text").asText();
    }

    // ── Detect page type from endpoints ─────────────────────────────
    private boolean isGenericFrameName(String name) {
        if (name == null) return true;
        String lower = name.toLowerCase().trim();
        return lower.equals("desktop") || lower.equals("mobile") ||
               lower.equals("frame") || lower.equals("screen") ||
               lower.equals("page") || lower.equals("untitled");
    }

    private String detectPageType(List<ProjectDesignDto.ApiEndpoint> endpoints, String fallback) {
        String urls = endpoints.stream()
            .map(e -> e.getUrl() != null ? e.getUrl().toLowerCase() : "")
            .collect(java.util.stream.Collectors.joining(" "));
        if (urls.contains("/auth/login") || urls.contains("/auth/register")) return "Auth";
        if (urls.contains("/product") || urls.contains("/catalog")) return "Products";
        if (urls.contains("/dashboard") || urls.contains("/stats")) return "Dashboard";
        if (urls.contains("/cart") || urls.contains("/order") || urls.contains("/checkout")) return "Checkout";
        if (urls.contains("/user") || urls.contains("/profile")) return "Profile";
        if (urls.contains("/admin")) return "Admin";
        return fallback; // keep original if can't detect
    }

    // ── Parse AI JSON response ────────────────────────────────────────
    private ParsedDesign parseAiResponse(String text) {
        ParsedDesign result = new ParsedDesign();
        try {
            String cleaned = text.replaceAll("(?s)```json\\s*", "")
                                  .replaceAll("(?s)```\\s*", "").trim();
            int s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
            if (s == -1 || e == -1) return result;
            JsonNode json = objectMapper.readTree(cleaned.substring(s, e + 1));

            // Endpoints
            if (json.has("endpoints")) {
                json.get("endpoints").forEach(ep -> {
                    ProjectDesignDto.ApiEndpoint ae = new ProjectDesignDto.ApiEndpoint();
                    ae.setMethod(ep.path("method").asText("GET"));
                    ae.setUrl(ep.path("url").asText(""));
                    ae.setDescription(ep.path("description").asText(""));
                    ae.setRequestBody(ep.path("requestBody").asText(""));
                    ae.setResponseBody(ep.path("responseBody").asText(""));
                    ae.setPathParams(ep.path("pathParams").asText(""));
                    ae.setQueryParams(ep.path("queryParams").asText(""));
                    ae.setStatusCodes(ep.path("statusCodes").asText("200"));
                    if (!ae.getUrl().isEmpty()) result.endpoints.add(ae);
                });
            }

            // Tables
            if (json.has("tables")) {
                json.get("tables").forEach(tbl -> {
                    ProjectDesignDto.DbTable dt = new ProjectDesignDto.DbTable();
                    dt.setTableName(tbl.path("tableName").asText(""));
                    dt.setColumns(tbl.path("columns").asText(""));
                    dt.setDescription(tbl.path("description").asText(""));
                    if (!dt.getTableName().isEmpty()) result.tables.add(dt);
                });
            }
        } catch (Exception ex) {
            log.warn("[Extract] Parse failed: {}", ex.getMessage());
        }
        return result;
    }

    private static class ParsedDesign {
        List<ProjectDesignDto.ApiEndpoint> endpoints = new ArrayList<>();
        List<ProjectDesignDto.DbTable>     tables    = new ArrayList<>();
    }
}