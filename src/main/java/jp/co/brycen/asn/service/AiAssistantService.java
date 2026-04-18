package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.dto.ai.AiAssistantRequest;
import jp.co.brycen.asn.dto.ai.AiAssistantResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAssistantService {

    @Value("${anthropic.api.key}")
    private String anthropicApiKey;

    private static final String ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL_HAIKU  = "claude-haiku-4-5-20251001";
    private static final String MODEL_SONNET = "claude-sonnet-4-20250514";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AiAssistantResponse chat(AiAssistantRequest request) {
        try {
            String lang = request.getLanguage() != null ? request.getLanguage() : "en";

            // ══════════════════════════════════════════════════════
            // MODE 1: confirmedFiles present → generate actual code
            // ══════════════════════════════════════════════════════
            if (request.getConfirmedFiles() != null && !request.getConfirmedFiles().isEmpty()) {
                return handleCodeGeneration(request, lang);
            }

            // ══════════════════════════════════════════════════════
            // MODE 2: message empty → greet + analyze (chat mode, NOT auto-generate)
            // ══════════════════════════════════════════════════════
            if (request.getMessage() == null || request.getMessage().trim().isEmpty()) {
                return handleGreeting(request, lang);
            }

            // ══════════════════════════════════════════════════════
            // MODE 3: normal chat
            // ══════════════════════════════════════════════════════
            return handleNormalChat(request, lang);

        } catch (Exception e) {
            log.error("[AiAssistant] Error: {}", e.getMessage(), e);
            return AiAssistantResponse.builder()
                    .message(getErrorMessage(request.getLanguage()))
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    // ── MODE 1: Generate ONE file at a time ────────────────────────
    private AiAssistantResponse handleCodeGeneration(AiAssistantRequest request, String lang) throws Exception {
        List<String> allFiles = request.getConfirmedFiles();
        int fileIndex = request.getFileIndex() != null ? request.getFileIndex() : 0;

        if (fileIndex >= allFiles.size()) {
            return AiAssistantResponse.builder()
                .message("✅ All files generated!")
                .success(true).build();
        }

        String targetFile = allFiles.get(fileIndex);
        log.info("[MODE1] Generating file {}/{}: {}", fileIndex + 1, allFiles.size(), targetFile);

        AiAssistantRequest.FrameContext frame = request.getFrameContext();
        List<String> techStacks = request.getTechStacks() != null ? request.getTechStacks() : List.of();
        String githubCtx = request.getGithubContext() != null ? request.getGithubContext() : "";

        StringBuilder prompt = new StringBuilder();
        prompt.append("You are an expert developer. Generate production-ready code.\n\n");
        prompt.append("File to generate: ").append(targetFile).append("\n");

        if (frame != null) {
            prompt.append("Frame: ").append(frame.getFrameName())
                  .append(" (").append(frame.getFrameWidth()).append("x")
                  .append(frame.getFrameHeight()).append("px)\n\n");

            // Full component structure
            if (frame.getComponents() != null) {
                prompt.append("=== UI Components (JSON) ===\n");
                prompt.append(frame.getComponents()).append("\n");
                prompt.append("===========================\n\n");
                prompt.append("Each component has: type, name, content (text/label), x/y position, w/h size, style (backgroundColor, color).\n");
                prompt.append("Use this data to:\n");
                prompt.append("- Determine screen type (login/product-list/dashboard/etc) from component patterns\n");
                prompt.append("- Reproduce exact layout positions and sizes\n");
                prompt.append("- Match exact colors from backgroundColor and color fields\n");
                prompt.append("- Use content field values as actual text in the UI\n\n");
            }
        }
        if (!techStacks.isEmpty()) {
            prompt.append("Tech Stack: ").append(String.join(", ", techStacks)).append("\n\n");
        }
        if (!githubCtx.isEmpty()) {
            prompt.append("GitHub Context:\n").append(githubCtx).append("\n\n");
        }
        prompt.append("All files in this set: ").append(String.join(", ", allFiles)).append("\n");
        prompt.append("Generate ONLY ").append(targetFile).append(" — make it complete and production-ready.\n\n");
        prompt.append("Use this format exactly:\n\n");
        prompt.append("===FILE_START===\n");
        prompt.append("[complete file content here]\n");
        prompt.append("===FILE_END===\n");

        String aiText = callAnthropic(prompt.toString(), null, List.of(), MODEL_SONNET, 6000);
        log.info("[MODE1] Response for {}: {} chars", targetFile, aiText.length());

        AiAssistantResponse fileResponse = parseDelimitedFile(aiText, targetFile, lang);
        if (fileResponse == null) fileResponse = tryParseFilesResponse(aiText, lang);
        if (fileResponse == null || fileResponse.getFiles() == null || fileResponse.getFiles().isEmpty()) {
            log.warn("[MODE1] Parse failed for {}", targetFile);
            return AiAssistantResponse.builder()
                .message("❌ Failed to generate " + targetFile)
                .success(false).build();
        }

        String doneMsg;
        if ("my".equals(lang)) doneMsg = "✅ **" + targetFile + "** generate ပြီးပါပြီ! (" + (fileIndex+1) + "/" + allFiles.size() + ")";
        else if ("ja".equals(lang)) doneMsg = "✅ **" + targetFile + "** を生成しました (" + (fileIndex+1) + "/" + allFiles.size() + ")";
        else doneMsg = "✅ Generated **" + targetFile + "** (" + (fileIndex+1) + "/" + allFiles.size() + ")";

        return AiAssistantResponse.builder()
            .message(doneMsg)
            .success(true)
            .files(fileResponse.getFiles())
            .summary(targetFile)
            .suggestedFiles(allFiles)
            .readyToGenerate(false)
            .build();
    }

    // ── MODE 2: Greeting — chat mode, readyToGenerate: FALSE ────────
    private AiAssistantResponse handleGreeting(AiAssistantRequest request, String lang) throws Exception {
        log.info("[AiAssistant] MODE 2: Greeting (chat mode)");

        AiAssistantRequest.FrameContext frame = request.getFrameContext();
        List<String> techStacks = request.getTechStacks() != null ? request.getTechStacks() : List.of();
        String githubCtx = request.getGithubContext() != null ? request.getGithubContext() : "";

        StringBuilder prompt = new StringBuilder();
        prompt.append("You are an AI assistant for BrycenDesign, a UI design tool.\n");
        prompt.append("A developer opened the AI assistant for a UI frame.\n\n");

        if (frame != null) {
            prompt.append("Frame name: ").append(frame.getFrameName()).append("\n");
            prompt.append("Frame size: ").append(frame.getFrameWidth()).append("x")
                  .append(frame.getFrameHeight()).append("px\n\n");
            // Send component JSON ONCE only
            if (frame.getComponents() != null) {
                prompt.append("=== UI Components (JSON) ===\n");
                prompt.append(frame.getComponents()).append("\n");
                prompt.append("===========================\n\n");
                prompt.append("Identify the screen type from component STRUCTURE (not just content text).\n");
                prompt.append("Rules:\n");
                prompt.append("- 2+ text/input fields + 1 button, all centered=true → LOGIN or REGISTER\n");
                prompt.append("- sidebar + grid of image+card groups → PRODUCT LIST / CATALOG\n");
                prompt.append("- many stat cards + charts → DASHBOARD\n");
                prompt.append("- image top + text + CTA button → LANDING / HERO\n");
                prompt.append("- table component → ADMIN / DATA TABLE\n");
                prompt.append("IMPORTANT: Even if content fields say generic names like 'Label','Text','Button',\n");
                prompt.append("still make your BEST GUESS from structure. Do NOT ask the user for more info.\n\n");
            }
        }
        if (!techStacks.isEmpty()) {
            prompt.append("Tech Stack: ").append(String.join(", ", techStacks)).append("\n\n");
        }
        if (!githubCtx.isEmpty()) {
            prompt.append("GitHub Repo:\n").append(githubCtx).append("\n\n");
        }

        prompt.append("Reply in ").append(getLangName(lang)).append(".\n\n");
        prompt.append("Based on the components, write a friendly greeting that:\n");
        prompt.append("1. Identifies the EXACT screen type (Login/Product List/Dashboard/etc)\n");
        prompt.append("2. Lists features visible in this design (2-3 bullet points)\n");
        prompt.append("3. Lists APIs this screen will need (2-3 bullet points)\n");
        prompt.append("4. Lists files to generate based on the tech stack\n");
        // Frame size hint for AI
        if (frame != null && frame.getFrameWidth() != null) {
            if (frame.getFrameWidth() > 520) {
                prompt.append("IMPORTANT: This is a DESKTOP frame (").append(frame.getFrameWidth()).append("px wide). ");
                prompt.append("Prioritize WEB files (Angular/React/Vue) over mobile files (Flutter/Swift/Kotlin).\n");
            } else {
                prompt.append("IMPORTANT: This is a MOBILE frame (").append(frame.getFrameWidth()).append("px wide). ");
                prompt.append("Prioritize MOBILE files (Flutter/Swift/Kotlin/React Native) over web files.\n");
            }
        }
        prompt.append("5. Ends by asking if the developer wants to generate, or has questions first\n\n");
        prompt.append("Keep it concise. Do NOT return JSON. Just friendly chat text.\n");
        prompt.append("The developer can ask questions or discuss before generating code.");

        // Ask AI to also return file list as JSON at the end
        prompt.append("\n\nAt the end of your message, append this exact block (do not skip):\n");
        prompt.append("FILES_JSON:{\"files\":[\"file1.ext\",\"file2.ext\"]}\n");
        prompt.append("List only the files appropriate for this frame and tech stack.");

        // If frame image provided → use vision model with image
        String aiText;
        String frameImage = request.getFrameImage();
        if (frameImage != null && !frameImage.isEmpty()) {
            aiText = callAnthropicWithImage(prompt.toString(), frameImage, MODEL_HAIKU, 1200);
        } else {
            aiText = callAnthropic(prompt.toString(), null, new ArrayList<>(), MODEL_HAIKU, 1200);
        }

        // Parse file list from AI response
        List<String> suggestedFiles = parseFilesFromGreeting(aiText, techStacks, frame);

        // Strip the FILES_JSON block from the visible message
        String visibleMsg = aiText.replaceAll("FILES_JSON:\\{[^\\}]*\\}", "").trim();

        return AiAssistantResponse.builder()
                .message(visibleMsg)
                .success(true)
                .readyToGenerate(false)
                .suggestedFiles(suggestedFiles)
                .build();
    }

    // ── Parse file list from AI greeting response ─────────────────
    private List<String> parseFilesFromGreeting(String aiText, List<String> techStacks, AiAssistantRequest.FrameContext frame) {
        try {
            // Look for FILES_JSON:{...}
            int idx = aiText.indexOf("FILES_JSON:{");
            if (idx != -1) {
                int start = aiText.indexOf("{", idx);
                int end   = aiText.indexOf("}", start) + 1;
                if (start != -1 && end > start) {
                    String json = aiText.substring(start, end);
                    JsonNode node = objectMapper.readTree(json);
                    if (node.has("files")) {
                        List<String> files = new ArrayList<>();
                        node.get("files").forEach(f -> files.add(f.asText()));
                        if (!files.isEmpty()) {
                            log.info("[Greeting] AI suggested files: {}", files);
                            return files;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Greeting] Failed to parse file list: {}", e.getMessage());
        }
        // Fallback — simple default by tech stack
        String name = frame != null ? frame.getFrameName().toLowerCase().replaceAll("[^a-z0-9]", "-") : "screen";
        List<String> defaults = new ArrayList<>();
        defaults.add(name + ".component.ts");
        defaults.add(name + ".component.html");
        return defaults;
    }

    // ── MODE 3: Normal chat ─────────────────────────────────────────
    private AiAssistantResponse handleNormalChat(AiAssistantRequest request, String lang) throws Exception {
        log.info("[AiAssistant] MODE 3: Normal chat — message: {}",
                request.getMessage().substring(0, Math.min(50, request.getMessage().length())));

        String systemPrompt = buildSystemPrompt(lang, request.getFrameContext(), request.getGeneratedFiles());

        List<Map<String, Object>> history = new ArrayList<>();
        if (request.getHistory() != null) {
            request.getHistory().forEach(h ->
                history.add(Map.of("role", h.getRole(), "content", h.getContent())));
        }

        String aiText = callAnthropic(request.getMessage(), systemPrompt, history, MODEL_HAIKU, 1000);

        // If user says generate → return readyToGenerate with saved suggested files
        if (isGenerateRequest(request.getMessage())) {
            List<String> saved = request.getSuggestedFiles();
            if (saved != null && !saved.isEmpty()) {
                return AiAssistantResponse.builder()
                        .message(aiText)
                        .success(true)
                        .readyToGenerate(true)
                        .suggestedFiles(saved)
                        .build();
            }
            AiAssistantResponse filesResp = tryParseFilesResponse(aiText, lang);
            if (filesResp != null) return filesResp;
        }

        return AiAssistantResponse.builder()
                .message(aiText)
                .success(true)
                .build();
    }

    // ── Call Anthropic API with image (vision) ─────────────────────
    private String callAnthropicWithImage(String prompt, String imageBase64, String model, int maxTokens) throws Exception {
        List<Map<String, Object>> imageContent = new ArrayList<>();
        imageContent.add(Map.of(
            "type", "image",
            "source", Map.of(
                "type", "base64",
                "media_type", "image/jpeg",
                "data", imageBase64
            )
        ));
        imageContent.add(Map.of("type", "text", "text", prompt));

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("messages", List.of(Map.of("role", "user", "content", imageContent)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", anthropicApiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> resp = restTemplate.postForEntity(ANTHROPIC_URL, entity, String.class);
        JsonNode root = objectMapper.readTree(resp.getBody());
        return root.path("content").get(0).path("text").asText();
    }

    // ── Call Anthropic API ──────────────────────────────────────────
    private String callAnthropic(String userMessage, String systemPrompt,
                                  List<Map<String, Object>> history,
                                  String model, int maxTokens) throws Exception {
        List<Map<String, Object>> messages = new ArrayList<>(history);
        messages.add(Map.of("role", "user", "content", userMessage));

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        if (systemPrompt != null && !systemPrompt.isEmpty()) body.put("system", systemPrompt);
        body.put("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", anthropicApiKey);
        headers.set("anthropic-version", "2023-06-01");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> resp = restTemplate.postForEntity(ANTHROPIC_URL, entity, String.class);

        JsonNode root = objectMapper.readTree(resp.getBody());
        String text = root.path("content").get(0).path("text").asText();
        log.info("[AiAssistant] Response ({}): {}", model, text.substring(0, Math.min(100, text.length())));
        return text;
    }

    // ── Build system prompt for normal chat ─────────────────────────
    private String buildSystemPrompt(String lang,
                                      AiAssistantRequest.FrameContext frame,
                                      List<AiAssistantRequest.GeneratedFile> files) {
        StringBuilder sb = new StringBuilder();
        if ("my".equals(lang)) sb.append("မြန်မာဘာသာဖြင့် ဖြေပါ။ ");
        else if ("ja".equals(lang)) sb.append("日本語で回答してください。 ");
        else if ("km".equals(lang)) sb.append("សូមឆ្លើយជាភាសាខ្មែរ។ ");
        else if ("vi".equals(lang)) sb.append("Vui lòng trả lời bằng tiếng Việt. ");
        else if ("ko".equals(lang)) sb.append("한국어로 답변해 주세요. ");
        else sb.append("Reply in English. ");

        sb.append("You are an AI assistant for BrycenDesign — a UI design tool. ");
        sb.append("Help developers understand the design and generated code.\n\n");

        if (frame != null) {
            sb.append("Current Frame: ").append(frame.getFrameName())
              .append(" (").append(frame.getFrameWidth()).append("×").append(frame.getFrameHeight()).append("px)\n");
            if (frame.getComponents() != null)
                sb.append("Components: ").append(frame.getComponents()).append("\n\n");
        }
        if (files != null && !files.isEmpty()) {
            sb.append("Generated Files:\n");
            files.forEach(f -> {
                sb.append("### ").append(f.getName()).append("\n");
                String preview = f.getContent().length() > 400
                        ? f.getContent().substring(0, 400) + "..." : f.getContent();
                sb.append(preview).append("\n\n");
            });
        }
        return sb.toString();
    }


    // ── Parse delimiter-based response ──────────────────────────────
    private AiAssistantResponse parseDelimitedFile(String text, String fileName, String lang) {
        try {
            String START = "===FILE_START===";
            String END   = "===FILE_END===";
            int s = text.indexOf(START);
            if (s == -1) { log.warn("[delimit] START marker not found"); return null; }
            int e = text.indexOf(END, s);
            String fileContent;
            if (e != -1 && e > s) {
                fileContent = text.substring(s + START.length(), e).trim();
                fileContent = fileContent.replaceAll("^```[a-zA-Z0-9]*\\s*\n?", "").replaceAll("\n?```$", "").trim();
            } else {
                fileContent = text.substring(s + START.length()).trim();
            }
            if (fileContent.isEmpty()) { log.warn("[delimit] Empty content"); return null; }

            List<AiAssistantResponse.GeneratedFile> files = List.of(
                AiAssistantResponse.GeneratedFile.builder().name(fileName).content(fileContent).build()
            );
            String msg;
            if ("my".equals(lang)) msg = "✅ **" + fileName + "** generate ပြီးပါပြီ";
            else if ("ja".equals(lang)) msg = "✅ **" + fileName + "** を生成しました";
            else msg = "✅ Generated **" + fileName + "**";

            return AiAssistantResponse.builder()
                .message(msg).success(true).files(files).summary(fileName).build();
        } catch (Exception e) {
            log.warn("[delimit] Exception: {}", e.getMessage());
            return null;
        }
    }

    // ── Try parse JSON files response ────────────────────────────────
    private AiAssistantResponse tryParseFilesResponse(String text, String lang) {
        try {
            String cleaned = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
            int s = cleaned.indexOf('{');
            int e = cleaned.lastIndexOf('}');
            if (s == -1 || e == -1 || e <= s) return null;
            String jsonStr = cleaned.substring(s, e + 1);

            try {
                JsonNode json = objectMapper.readTree(jsonStr);
                if (json.has("files")) {
                    List<AiAssistantResponse.GeneratedFile> fileList = new ArrayList<>();
                    json.get("files").forEach(f -> {
                        String name = f.path("name").asText("");
                        String fc   = f.path("content").asText("");
                        if (!name.isEmpty())
                            fileList.add(AiAssistantResponse.GeneratedFile.builder().name(name).content(fc).build());
                    });
                    if (!fileList.isEmpty()) {
                        String summary = json.has("summary") ? json.get("summary").asText() : "";
                        return buildFilesResponse(fileList, summary, lang);
                    }
                }
            } catch (Exception parseEx) {
                log.warn("[tryParse] Standard parse failed: {}", parseEx.getMessage());
            }
            return null;
        } catch (Exception e) {
            log.warn("[tryParse] Exception: {}", e.getMessage());
            return null;
        }
    }

    private AiAssistantResponse buildFilesResponse(
            List<AiAssistantResponse.GeneratedFile> fileList, String summary, String lang) {
        String msg;
        if ("my".equals(lang)) msg = "Files " + fileList.size() + " ခု generate ပြီးပါပြီ!";
        else if ("ja".equals(lang)) msg = fileList.size() + "ファイルを生成しました!";
        else msg = "Generated " + fileList.size() + " files successfully!";
        return AiAssistantResponse.builder().message(msg).success(true)
                .files(fileList).summary(summary).build();
    }

    // ── Detect generate request ─────────────────────────────────────
    private boolean isGenerateRequest(String message) {
        if (message == null) return false;
        String lower = message.toLowerCase();
        return lower.contains("yes") || lower.contains("generate") ||
               lower.contains("ဟုတ်") || lower.contains("လုပ်ပေး") ||
               lower.contains("はい") || lower.contains("生成");
    }

    // ── Error messages ──────────────────────────────────────────────
    private String getErrorMessage(String lang) {
        String l = lang != null ? lang : "en";
        if ("my".equals(l)) return "❌ Error ဖြစ်နေတယ်။ နောက်မှ ထပ်ကြိုးစားပါ။";
        else if ("ja".equals(l)) return "❌ エラーが発生しました。後でもう一度お試しください。";
        else return "❌ An error occurred. Please try again.";
    }

    // ── Helpers ─────────────────────────────────────────────────────
    private String getLangName(String lang) {
        if ("my".equals(lang)) return "Myanmar (Burmese)";
        else if ("ja".equals(lang)) return "Japanese";
        else if ("km".equals(lang)) return "Khmer";
        else if ("vi".equals(lang)) return "Vietnamese";
        else if ("ko".equals(lang)) return "Korean";
        else return "English";
    }


    private String toPascalCase(String kebab) {
        StringBuilder sb = new StringBuilder();
        for (String part : kebab.split("-")) {
            if (!part.isEmpty()) sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }
}