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
            // MODE 2: message empty → analyze frame → return checklist
            // ══════════════════════════════════════════════════════
            if (request.getMessage() == null || request.getMessage().trim().isEmpty()) {
                return handleChecklistGeneration(request, lang);
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
        String targetFile = allFiles.get(fileIndex);

        log.info("[MODE1] Generating file {}/{}: {}", fileIndex + 1, allFiles.size(), targetFile);

        AiAssistantRequest.FrameContext frame = request.getFrameContext();
        List<String> techStacks = request.getTechStacks() != null ? request.getTechStacks() : List.of();
        String frameDesc = frame != null ?
            "Frame: " + frame.getFrameName() + " (" + frame.getFrameWidth() + "x" + frame.getFrameHeight() + "px)" : "";
        String techDesc = techStacks.isEmpty() ? "Angular, Spring Boot" :
            String.join(", ", techStacks.subList(0, Math.min(5, techStacks.size())));

        // Detect tech stack & frame type
        String ext = targetFile.contains(".") ? targetFile.substring(targetFile.lastIndexOf('.')+1).toLowerCase() : "";
        boolean isFrontend = java.util.Arrays.asList("ts","html","scss","css","dart","swift","kt","jsx","tsx","vue").contains(ext);
        boolean isMobileFrame = frame != null && frame.getFrameWidth() != null && frame.getFrameWidth() <= 520;
        boolean isIOS      = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("ios") || t.toLowerCase().contains("swift") || t.toLowerCase().contains("swiftui"));
        boolean isAndroid  = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("android") || t.toLowerCase().contains("kotlin"));
        boolean isFlutter  = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("flutter") || t.toLowerCase().contains("dart"));
        boolean isRN       = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("react native"));
        boolean isVue      = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("vue"));
        boolean isReact    = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("react") && !t.toLowerCase().contains("native"));
        boolean isAngular  = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("angular"));

        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate production-ready code for this file.\n\n");
        prompt.append("Design: ").append(frameDesc).append("\n");
        prompt.append("Tech stack: ").append(techDesc).append("\n");
        prompt.append("File: ").append(targetFile).append("\n\n");

        // GitHub context
        if (request.getGithubContext() != null && !request.getGithubContext().isEmpty()) {
            prompt.append("\n--- GitHub Repository Context ---\n");
            prompt.append(request.getGithubContext()).append("\n");
            prompt.append("Match the coding style and patterns from this repo.\n");
            prompt.append("---\n\n");
        }

        if (targetFile.equalsIgnoreCase("preview.html")) {
            boolean isMobilePreview = isMobileFrame;
            prompt.append("Generate a STANDALONE static HTML page (no Angular, no React, pure HTML5 + CSS3).\n");
            prompt.append("- Match the design EXACTLY: colors, fonts, layout, spacing\n");
            prompt.append("- Inline all CSS inside <style> tag in <head>\n");
            prompt.append("- Use placeholder images from https://picsum.photos/\n");
            if (isMobilePreview) {
                prompt.append("- Mobile layout: max-width 390px, centered, touch-friendly (min 44px buttons)\n");
                prompt.append("- Viewport meta: <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
            } else {
                prompt.append("- Desktop layout: full width, match frame " + (frame != null ? frame.getFrameWidth() + "x" + frame.getFrameHeight() + "px" : "1440x900px") + "\n");
            }
            prompt.append("- Fully self-contained — browser can open directly\n");
        } else if (isFrontend) {
            if (isIOS || ext.equals("swift")) {
                prompt.append("iOS/SwiftUI: struct View, @State/@ObservableObject, match design exactly.\n");
                prompt.append("Use SwiftUI: VStack, HStack, ZStack, ScrollView, Image, Text, Button, List.\n");
                if (isMobileFrame) prompt.append("Mobile: screen width 390pt, safe area, .padding().\n");
            } else if (isAndroid || ext.equals("kt")) {
                prompt.append("Android Kotlin: Jetpack Compose @Composable, Material3 components.\n");
                if (isMobileFrame) prompt.append("Mobile: fillMaxWidth(), dp units, LazyColumn.\n");
            } else if (isFlutter || ext.equals("dart")) {
                prompt.append("Flutter/Dart: StatefulWidget or StatelessWidget, Material widgets.\n");
                if (isMobileFrame) prompt.append("Mobile: MediaQuery, responsive padding, ListView.\n");
            } else if (isRN) {
                prompt.append("React Native: functional component, StyleSheet, match design.\n");
                if (isMobileFrame) prompt.append("Mobile: Dimensions, flexbox, ScrollView.\n");
            } else if (isVue) {
                prompt.append("Vue 3: Composition API, <script setup lang=\"ts\">, match design.\n");
            } else if (isReact && !isAngular) {
                prompt.append("React: functional component, hooks, TypeScript interfaces.\n");
            } else {
                // default Angular
                prompt.append("Angular: standalone component, imports array, inject() pattern, match design.\n");
            }
        } else {
            prompt.append("Java: package jp.co.brycen.asn, full imports, Spring Boot annotations, complete class.\n");
        }
        prompt.append("\nIMPORTANT: Respond using EXACTLY this format:\n");
        prompt.append("===FILE_START===\n");
        prompt.append("(complete file content here)\n");
        prompt.append("===FILE_END===\n");
        prompt.append("No explanation, no markdown, just the file content between the markers.");

        String aiText = callAnthropic(prompt.toString(), null, List.of(), MODEL_SONNET, 6000);
        log.info("[MODE1] Response for {}: {} chars", targetFile, aiText.length());

        // Parse using delimiter markers — no JSON quoting issues
        AiAssistantResponse fileResponse = parseDelimitedFile(aiText, targetFile, lang);
        if (fileResponse == null) {
            // Fallback: try JSON parse
            fileResponse = tryParseFilesResponse(aiText, lang);
        }
        if (fileResponse == null || fileResponse.getFiles() == null || fileResponse.getFiles().isEmpty()) {
            log.warn("[MODE1] Parse failed for {}", targetFile);
            return AiAssistantResponse.builder()
                .message("❌ Failed to generate " + targetFile)
                .success(false).build();
        }

        // Check if more files remain
        int nextIndex = fileIndex + 1;
        boolean hasMore = nextIndex < allFiles.size();
        String nextFile = hasMore ? allFiles.get(nextIndex) : null;

        // Build offer message for next file
        String offerMsg = null;
        if (hasMore) {
            String nextExt = nextFile.contains(".") ? nextFile.substring(nextFile.lastIndexOf('.')+1).toLowerCase() : "";
            String nextBadge = nextExt.toUpperCase();
            if ("my".equals(lang)) {
                offerMsg = "[" + nextBadge + "] **" + nextFile + "** ဆက်ထုတ်မလား? (" + nextIndex + "/" + allFiles.size() + ")\n**yes** လို့ ရေးပါ";
            } else if ("ja".equals(lang)) {
                offerMsg = "[" + nextBadge + "] **" + nextFile + "** を生成しますか? (" + nextIndex + "/" + allFiles.size() + ")\n**はい**と入力してください";
            } else {
                offerMsg = "Generate [" + nextBadge + "] **" + nextFile + "** next? (" + nextIndex + "/" + allFiles.size() + ")\nType **yes** to continue";
            }
        } else {
            if ("my".equals(lang)) offerMsg = "✅ Files " + allFiles.size() + " ခု အားလုံး generate ပြီးပါပြီ!";
            else if ("ja".equals(lang)) offerMsg = "✅ 全" + allFiles.size() + "ファイルの生成が完了しました！";
            else offerMsg = "✅ All " + allFiles.size() + " files generated successfully!";
        }

        String doneMsg;
        if ("my".equals(lang)) doneMsg = "✅ **" + targetFile + "** generate ပြီးပါပြီ! (" + (fileIndex+1) + "/" + allFiles.size() + ")";
        else if ("ja".equals(lang)) doneMsg = "✅ **" + targetFile + "** を生成しました (" + (fileIndex+1) + "/" + allFiles.size() + ")";
        else doneMsg = "✅ Generated **" + targetFile + "** (" + (fileIndex+1) + "/" + allFiles.size() + ")";

        log.info("[MODE1] Done {}/{}, hasMore={}", fileIndex+1, allFiles.size(), hasMore);

        return AiAssistantResponse.builder()
            .message(doneMsg)
            .success(true)
            .files(fileResponse.getFiles())
            .summary(targetFile)
            .offerGenerate(hasMore)
            .offerMessage(offerMsg)
            .suggestedFiles(allFiles)   // pass all files for next request
            .readyToGenerate(hasMore)
            .build();
    }

        // ── MODE 2: Analyze frame → return checklist ────────────────────
    private AiAssistantResponse handleChecklistGeneration(AiAssistantRequest request, String lang) throws Exception {
        log.info("[AiAssistant] MODE 2: Checklist generation");

        AiAssistantRequest.FrameContext frame = request.getFrameContext();
        List<String> techStacks = request.getTechStacks() != null ? request.getTechStacks() : List.of();

        StringBuilder prompt = new StringBuilder();
        prompt.append("You are an AI assistant for a UI design tool called BrycenDesign.\n");
        prompt.append("Analyze this UI design frame carefully and provide a detailed analysis.\n\n");

        if (frame != null) {
            prompt.append("Frame: ").append(frame.getFrameName())
                  .append(" (").append(frame.getFrameWidth()).append("x").append(frame.getFrameHeight()).append("px)\n");
            prompt.append("Components: ").append(frame.getComponents()).append("\n\n");
        }

        if (!techStacks.isEmpty()) {
            prompt.append("Project Tech Stack: ").append(String.join(", ", techStacks)).append("\n\n");
        }

        prompt.append("Reply in ").append(getLangName(lang)).append(".\n\n");
        prompt.append("Return ONLY a JSON object (no markdown, no extra text):\n");
        prompt.append("{\n");
        prompt.append("  \"description\": \"1-2 sentences: what UI screen is this?\",\n");
        prompt.append("  \"features\": [\"Feature 1\", \"Feature 2\", \"Feature 3\"],\n");
        prompt.append("  \"apis\": [\"GET /api/...\", \"POST /api/...\"  ],\n");
        prompt.append("  \"files\": [\"filename1.ext\", \"filename2.ext\"]\n");
        prompt.append("}\n\n");
        prompt.append("Rules:\n");
        prompt.append("- description: what screen/page this is\n");
        prompt.append("- features: 3-5 key features visible in the UI\n");
        prompt.append("- apis: 2-4 REST API endpoints needed for this screen\n");
        prompt.append("- files: appropriate for the tech stack, 3-6 files max\n");
        // Tech-aware file suggestions
        boolean hasiOS    = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("ios") || t.toLowerCase().contains("swift"));
        boolean hasAndroid= techStacks.stream().anyMatch(t -> t.toLowerCase().contains("android") || t.toLowerCase().contains("kotlin"));
        boolean hasFlutter= techStacks.stream().anyMatch(t -> t.toLowerCase().contains("flutter") || t.toLowerCase().contains("dart"));
        boolean hasRN2    = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("react native"));
        boolean hasAngular2 = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("angular"));
        boolean hasMobileFrame = frame != null && frame.getFrameWidth() != null && frame.getFrameWidth() <= 520;

        if (hasiOS) {
            prompt.append("- For iOS/SwiftUI: NameView.swift (SwiftUI View), NameViewModel.swift (ObservableObject), NameModel.swift (data model)\n");
        } else if (hasAndroid) {
            prompt.append("- For Android/Kotlin: NameScreen.kt (Composable), NameViewModel.kt, NameRepository.kt\n");
        } else if (hasFlutter) {
            prompt.append("- For Flutter: name_screen.dart (Widget), name_controller.dart, name_model.dart\n");
        } else if (hasRN2) {
            prompt.append("- For React Native: NameScreen.tsx, NameStyles.ts\n");
        } else if (hasAngular2) {
            prompt.append("- For Angular: .component.ts, .component.html, .component.scss\n");
        } else {
            prompt.append("- For Angular: .component.ts, .component.html, .component.scss\n");
        }
        prompt.append("- For Spring Boot: Service.java, Controller.java, Entity.java\n");


        String aiText = callAnthropic(prompt.toString(), null, new ArrayList<>(), MODEL_HAIKU, 1000);
        log.info("[MODE2] Raw AI response: {}", aiText.substring(0, Math.min(500, aiText.length())));

        // Parse JSON response
        try {
            String cleaned = aiText
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "")
                .trim();
            int s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
            if (s != -1 && e != -1) {
                JsonNode json = objectMapper.readTree(cleaned.substring(s, e + 1));

                // Build rich message: description + features + apis
                StringBuilder msg = new StringBuilder();
                if (json.has("description")) {
                    msg.append(json.get("description").asText()).append("\n\n");
                }
                if (json.has("features") && json.get("features").size() > 0) {
                    if ("my".equals(lang)) msg.append("**Features တွေ:**\n");
                    else if ("ja".equals(lang)) msg.append("**機能一覧:**\n");
                    else if ("km".equals(lang)) msg.append("**មុខងារ:**\n");
                    else if ("vi".equals(lang)) msg.append("**Tính năng:**\n");
                    else if ("ko".equals(lang)) msg.append("**기능 목록:**\n");
                    else msg.append("**Features:**\n");
                    json.get("features").forEach(f -> msg.append("• ").append(f.asText()).append("\n"));
                    msg.append("\n");
                }
                if (json.has("apis") && json.get("apis").size() > 0) {
                    if ("my".equals(lang)) msg.append("**API Endpoints လိုမယ်:**\n");
                    else if ("ja".equals(lang)) msg.append("**必要なAPI:**\n");
                    else if ("km".equals(lang)) msg.append("**API ដែលត្រូវការ:**\n");
                    else if ("vi".equals(lang)) msg.append("**API cần thiết:**\n");
                    else if ("ko".equals(lang)) msg.append("**필요한 API:**\n");
                    else msg.append("**Required APIs:**\n");
                    json.get("apis").forEach(a -> msg.append("• ").append(a.asText()).append("\n"));
                    msg.append("\n");
                }
                if ("my".equals(lang)) msg.append("Code generate လုပ်ပေးရမလား? **yes** လို့ ရေးပါ။");
                else if ("ja".equals(lang)) msg.append("コードを生成しますか？**はい**と入力してください。");
                else if ("km".equals(lang)) msg.append("តើអ្នកចង់បង្កើតកូដទេ? វាយ **yes**។");
                else if ("vi".equals(lang)) msg.append("Bạn có muốn tạo code không? Gõ **yes**.");
                else if ("ko".equals(lang)) msg.append("코드를 생성하시겠습니까? **yes**를 입력하세요.");
                else msg.append("Would you like me to generate the code? Type **yes** to proceed.");

                List<String> suggestedFiles = new ArrayList<>();
                if (json.has("files")) {
                    json.get("files").forEach(f -> suggestedFiles.add(f.asText()));
                }

                if (!suggestedFiles.isEmpty()) {
                    return AiAssistantResponse.builder()
                            .message(msg.toString())
                            .success(true)
                            .readyToGenerate(true)
                            .suggestedFiles(suggestedFiles)
                            .build();
                }
            }
        } catch (Exception ex) {
            log.warn("[AiAssistant] Checklist parse failed: {}", ex.getMessage());
        }

        // Fallback
        List<String> fallbackFiles = buildFallbackFiles(techStacks, frame);
        return AiAssistantResponse.builder()
                .message(buildChecklistMessage(lang, frame))
                .success(true)
                .readyToGenerate(true)
                .suggestedFiles(fallbackFiles)
                .build();
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

        // Check if user is asking to generate
        if (isGenerateRequest(request.getMessage())) {
            AiAssistantResponse filesResp = tryParseFilesResponse(aiText, lang);
            if (filesResp != null) return filesResp;
        }

        return AiAssistantResponse.builder()
                .message(aiText)
                .success(true)
                .build();
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
        if (systemPrompt != null && !systemPrompt.isEmpty()) {
            body.put("system", systemPrompt);
        }
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
        if ("my".equals(lang)) {
            sb.append("မြန်မာဘာသာဖြင့် ဖြေပါ။ ");
        } else if ("ja".equals(lang)) {
            sb.append("日本語で回答してください。 ");
        } else if ("km".equals(lang)) {
            sb.append("សូមឆ្លើយជាភាសាខ្មែរ។ ");
        } else if ("vi".equals(lang)) {
            sb.append("Vui lòng trả lời bằng tiếng Việt. ");
        } else if ("ko".equals(lang)) {
            sb.append("한국어로 답변해 주세요. ");
        } else {
            sb.append("Reply in English. ");
        }
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

    // ── Build fallback checklist message ────────────────────────────
    private String buildChecklistMessage(String lang, AiAssistantRequest.FrameContext frame) {
        String fname = frame != null ? frame.getFrameName() : "this";
        if ("my".equals(lang)) {
            return "**" + fname + "** frame ကို analyze ပြီးပါပြီ။ Generate လုပ်မည့် files တွေကို ရွေးပြီး Generate နှိပ်ပေးပါ။";
        } else if ("ja".equals(lang)) {
            return "**" + fname + "**フレームを分析しました。生成するファイルを選択してGenerateボタンを押してください。";
        } else {
            return "I've analyzed the **" + fname + "** frame. Select the files you want to generate and click Generate.";
        }
    }

    // ── Build fallback files from tech stacks ───────────────────────
    private List<String> buildFallbackFiles(List<String> techStacks, AiAssistantRequest.FrameContext frame) {
        String name = frame != null
                ? frame.getFrameName().toLowerCase().replaceAll("[^a-z0-9]", "-")
                : "component";
        List<String> files = new ArrayList<>();

        boolean hasAngular = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("angular"));
        boolean hasSpring  = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("spring") || t.toLowerCase().contains("java"));
        boolean hasFlutter = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("flutter"));
        boolean hasReact   = techStacks.stream().anyMatch(t -> t.toLowerCase().contains("react"));

        if (hasAngular) {
            files.add(name + ".component.ts");
            files.add(name + ".component.html");
            files.add(name + ".component.scss");
        } else if (hasReact) {
            files.add(name + ".tsx");
        } else if (hasFlutter) {
            files.add(name + "_screen.dart");
        } else {
            files.add(name + ".component.ts");
            files.add(name + ".component.html");
            files.add(name + ".component.scss");
        }

        if (hasSpring) {
            String pascal = toPascalCase(name);
            files.add(pascal + "Controller.java");
            files.add(pascal + "Service.java");
        }

        return files.isEmpty() ? List.of(name + ".component.ts", name + ".component.html") : files;
    }

    // ── Parse files JSON from AI response ───────────────────────────
    /**
     * Parse delimiter-based response: ===FILE_START=== ... ===FILE_END===
     * Avoids all JSON quote escaping issues
     */
    private AiAssistantResponse parseDelimitedFile(String text, String fileName, String lang) {
        try {
            String START = "===FILE_START===";
            String END = "===FILE_END===";
            int s = text.indexOf(START);
            if (s == -1) {
                log.warn("[delimit] START marker not found");
                return null;
            }
            // END marker optional — if missing, take all content after START
            int e = text.indexOf(END, s);
            String fileContent;
            if (e != -1 && e > s) {
                fileContent = text.substring(s + START.length(), e).trim();
                fileContent = fileContent.replaceAll("^```[a-zA-Z0-9]*\\s*\n?", "").trim();
                fileContent = fileContent.replaceAll("\n?```\\s*$", "").trim();
            } else {
                // No END marker — take everything after START (response may be truncated)
                fileContent = text.substring(s + START.length()).trim();
                // Remove any trailing markdown fences
                // Strip leading/trailing markdown fences
                fileContent = fileContent.replaceAll("^```[a-zA-Z0-9]*\\s*\n?", "").trim();
                fileContent = fileContent.replaceAll("\n?```\\s*$", "").trim();
                log.warn("[delimit] No END marker — using rest of response ({} chars)", fileContent.length());
            }
            if (fileContent.isEmpty()) {
                log.warn("[delimit] Empty content");
                return null;
            }
            log.info("[delimit] Extracted {} chars for {}", fileContent.length(), fileName);

            List<AiAssistantResponse.GeneratedFile> files = new ArrayList<>();
            files.add(AiAssistantResponse.GeneratedFile.builder()
                .name(fileName).content(fileContent).build());

            String msg;
            if ("my".equals(lang)) msg = "✅ **" + fileName + "** generate ပြီးပါပြီ!";
            else if ("ja".equals(lang)) msg = "✅ **" + fileName + "** を生成しました";
            else msg = "✅ Generated **" + fileName + "**";

            return AiAssistantResponse.builder()
                .message(msg).success(true)
                .files(files).summary(fileName)
                .build();
        } catch (Exception e) {
            log.warn("[delimit] Exception: {}", e.getMessage());
            return null;
        }
    }

        private AiAssistantResponse tryParseFilesResponse(String text, String lang) {
        try {
            String cleaned = text
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "")
                .trim();

            log.info("[tryParse] length={}, preview={}", cleaned.length(),
                cleaned.substring(0, Math.min(80, cleaned.length())));

            // Find JSON boundaries
            int s = cleaned.indexOf('{');
            int e = cleaned.lastIndexOf('}');
            if (s == -1 || e == -1 || e <= s) {
                log.warn("[tryParse] No JSON found");
                return null;
            }
            String jsonStr = cleaned.substring(s, e + 1);

            // Try standard parse first
            try {
                JsonNode json = objectMapper.readTree(jsonStr);
                if (json.has("files")) {
                    List<AiAssistantResponse.GeneratedFile> fileList = new ArrayList<>();
                    json.get("files").forEach(f -> {
                        String name = f.path("name").asText("");
                        String fc = f.path("content").asText("");
                        if (!name.isEmpty()) {
                            fileList.add(AiAssistantResponse.GeneratedFile.builder()
                                .name(name).content(fc).build());
                        }
                    });
                    if (!fileList.isEmpty()) {
                        String summary = json.has("summary") ? json.get("summary").asText() : "";
                        log.info("[tryParse] Standard parse OK — {} files", fileList.size());
                        return buildFilesResponse(fileList, summary, lang);
                    }
                }
            } catch (Exception parseEx) {
                log.warn("[tryParse] Standard parse failed: {} — trying manual extraction",
                    parseEx.getMessage() == null ? "null" :
                    parseEx.getMessage().substring(0, Math.min(80, parseEx.getMessage().length())));
            }

            // Manual extraction: find each file block by "name" key
            List<AiAssistantResponse.GeneratedFile> fileList = new ArrayList<>();
            int searchPos = 0;
            while (true) {
                // Find next "name":
                int nameKey = jsonStr.indexOf("\"name\"", searchPos);
                if (nameKey == -1) break;

                // Extract name value
                int nameValStart = jsonStr.indexOf("\"", nameKey + 7);
                if (nameValStart == -1) break;
                nameValStart++;
                int nameValEnd = jsonStr.indexOf("\"", nameValStart);
                if (nameValEnd == -1) break;
                String fname = jsonStr.substring(nameValStart, nameValEnd);

                // Find "content": after this name
                int contentKey = jsonStr.indexOf("\"content\"", nameValEnd);
                if (contentKey == -1) break;

                // Find opening quote of content value
                int contentValStart = jsonStr.indexOf("\"", contentKey + 10);
                if (contentValStart == -1) break;
                contentValStart++;

                // Find closing of content value — scan char by char for unescaped "
                // followed by whitespace + "}" or ","
                int contentValEnd = -1;
                int pos = contentValStart;
                while (pos < jsonStr.length()) {
                    char c = jsonStr.charAt(pos);
                    if (c == '\\') {
                        pos += 2; // skip escaped char
                        continue;
                    }
                    if (c == '"') {
                        // Check if this ends the content: next non-space should be } or ,
                        int ahead = pos + 1;
                        while (ahead < jsonStr.length() && (jsonStr.charAt(ahead) == ' ' || jsonStr.charAt(ahead) == '\n' || jsonStr.charAt(ahead) == '\r' || jsonStr.charAt(ahead) == '\t')) {
                            ahead++;
                        }
                        if (ahead < jsonStr.length()) {
                            char next = jsonStr.charAt(ahead);
                            if (next == '}' || next == ',') {
                                contentValEnd = pos;
                                break;
                            }
                        }
                    }
                    pos++;
                }

                if (contentValEnd > contentValStart) {
                    String rawContent = jsonStr.substring(contentValStart, contentValEnd);
                    // Unescape JSON string escapes
                    String fileContent = rawContent
                        .replace("\\n", "\n")
                        .replace("\\t", "\t")
                        .replace("\\r", "\r")
                        .replace("\\\"", "\"")
                        .replace("\\\\", "\\");
                    fileList.add(AiAssistantResponse.GeneratedFile.builder()
                        .name(fname).content(fileContent).build());
                    log.info("[tryParse] Manual extracted: {} ({} chars)", fname, fileContent.length());
                    searchPos = contentValEnd;
                } else {
                    searchPos = nameValEnd + 1;
                }
            }

            if (!fileList.isEmpty()) {
                log.info("[tryParse] Manual extraction OK — {} files", fileList.size());
                return buildFilesResponse(fileList, "", lang);
            }

            log.warn("[tryParse] All extraction methods failed");
            return null;

        } catch (Exception e) {
            log.warn("[tryParse] Exception: {}", e.getMessage() == null ? "null" :
                e.getMessage().substring(0, Math.min(100, e.getMessage().length())));
            return null;
        }
    }

    private AiAssistantResponse buildFilesResponse(
            List<AiAssistantResponse.GeneratedFile> fileList, String summary, String lang) {
        String msg;
        if ("my".equals(lang)) {
            msg = "Files " + fileList.size() + " ခု generate ပြီးပါပြီး!";
        } else if ("ja".equals(lang)) {
            msg = fileList.size() + "ファイルを生成しました!";
        } else {
            msg = "Generated " + fileList.size() + " files successfully!";
        }
        return AiAssistantResponse.builder()
                .message(msg).success(true)
                .files(fileList).summary(summary)
                .build();
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
        if ("my".equals(l)) {
            return "❌ Error ဖြစ်နေတယ်။ နောက်မှ ထပ်ကြိုးစားပါ။";
        } else if ("ja".equals(l)) {
            return "❌ エラーが発生しました。後でもう一度お試しください。";
        } else {
            return "❌ An error occurred. Please try again.";
        }
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