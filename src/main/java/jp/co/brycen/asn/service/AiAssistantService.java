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
    private static final String MODEL = "claude-haiku-4-5-20251001";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AiAssistantResponse chat(AiAssistantRequest request) {
        try {
            String lang = request.getLanguage() != null ? request.getLanguage() : "en";

            // Build system prompt
            String systemPrompt = buildSystemPrompt(lang, request.getFrameContext(), request.getGeneratedFiles());

            // Build messages array (history + current)
            List<Map<String, Object>> messages = new ArrayList<>();

            // Add history
            if (request.getHistory() != null) {
                for (AiAssistantRequest.Message h : request.getHistory()) {
                    messages.add(Map.of("role", h.getRole(), "content", h.getContent()));
                }
            }

            // Add current message
            messages.add(Map.of("role", "user", "content", request.getMessage()));

            // Call Anthropic
            Map<String, Object> body = new HashMap<>();
            body.put("model", MODEL);
            body.put("max_tokens", 2000);
            body.put("system", systemPrompt);
            body.put("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", anthropicApiKey);
            headers.set("anthropic-version", "2023-06-01");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> resp = restTemplate.postForEntity(ANTHROPIC_URL, entity, String.class);

            JsonNode root = objectMapper.readTree(resp.getBody());
            String aiText = root.path("content").get(0).path("text").asText();

            log.info("[AiAssistant] Response: {}", aiText.substring(0, Math.min(100, aiText.length())));

            // Check if response contains JSON with files (generate mode)
            if (request.getMessage() != null &&
               (request.getMessage().toLowerCase().contains("yes") ||
                request.getMessage().toLowerCase().contains("generate") ||
                request.getMessage().toLowerCase().contains("ဟုတ်") ||
                request.getMessage().toLowerCase().contains("လုပ်ပေး"))) {

                // Try parse as file generation response
                AiAssistantResponse filesResponse = tryParseFilesResponse(aiText, lang);
                if (filesResponse != null) return filesResponse;
            }

            // Check if AI is offering to generate
            boolean offerGenerate = isOfferingGenerate(aiText);

            return AiAssistantResponse.builder()
                    .message(aiText)
                    .success(true)
                    .offerGenerate(offerGenerate)
                    .offerMessage(offerGenerate ? getOfferMessage(lang) : null)
                    .build();

        } catch (Exception e) {
            log.error("[AiAssistant] Error: {}", e.getMessage());
            return AiAssistantResponse.builder()
                    .message(getErrorMessage(request.getLanguage()))
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    // ── Build system prompt ──────────────────────────────────────────
    private String buildSystemPrompt(String lang,
                                     AiAssistantRequest.FrameContext frame,
                                     List<AiAssistantRequest.GeneratedFile> files) {
        StringBuilder sb = new StringBuilder();

        // Language instruction
        switch (lang) {
            case "my":
                sb.append("မြန်မာဘာသာဖြင့် ဖြေပါ။ ");
                break;
            case "ja":
                sb.append("日本語で回答してください。 ");
                break;
            default:
                sb.append("Reply in English. ");
        }

        sb.append("You are an AI assistant for BrycenDesign — a UI design tool. ");
        sb.append("You help developers understand generated code, answer questions about the design, ");
        sb.append("and suggest improvements.\n\n");

        // Frame context
        if (frame != null) {
            sb.append("Current Design Frame:\n");
            sb.append("- Name: ").append(frame.getFrameName()).append("\n");
            sb.append("- Size: ").append(frame.getFrameWidth()).append("×").append(frame.getFrameHeight()).append("px\n");
            if (frame.getComponents() != null) {
                sb.append("- Components: ").append(frame.getComponents()).append("\n");
            }
            sb.append("\n");
        }

        // Generated files context
        if (files != null && !files.isEmpty()) {
            sb.append("Generated Files (user can ask about these):\n");
            for (AiAssistantRequest.GeneratedFile f : files) {
                sb.append("### ").append(f.getName()).append("\n");
                // Only include first 500 chars to keep context small
                String preview = f.getContent().length() > 500
                        ? f.getContent().substring(0, 500) + "..."
                        : f.getContent();
                sb.append(preview).append("\n\n");
            }
        }

        sb.append("Rules:\n");
        sb.append("- Be concise and helpful\n");
        sb.append("- If user asks to generate code, respond with JSON: ");
        sb.append("{\"files\":[{\"name\":\"filename.ext\",\"content\":\"...\"}],\"summary\":\"...\"}\n");
        sb.append("- For normal conversation, reply in plain text\n");
        sb.append("- If design is shown and no files yet, offer to generate code naturally\n");

        return sb.toString();
    }

    // ── Try parse files from AI response ────────────────────────────
    private AiAssistantResponse tryParseFilesResponse(String text, String lang) {
        try {
            String cleaned = text
                .replaceAll("(?m)^```json\\s*", "")
                .replaceAll("(?m)^```\\s*", "")
                .replaceAll("```\\s*$", "")
                .trim();

            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start == -1 || end == -1) return null;

            JsonNode json = objectMapper.readTree(cleaned.substring(start, end + 1));
            if (!json.has("files")) return null;

            List<AiAssistantResponse.GeneratedFile> fileList = new ArrayList<>();
            for (JsonNode f : json.get("files")) {
                fileList.add(AiAssistantResponse.GeneratedFile.builder()
                        .name(f.path("name").asText())
                        .content(f.path("content").asText())
                        .build());
            }

            String summary = json.has("summary") ? json.get("summary").asText() : "";
            String confirmMsg = getFilesReadyMessage(lang, fileList.size(), summary);

            return AiAssistantResponse.builder()
                    .message(confirmMsg)
                    .success(true)
                    .files(fileList)
                    .summary(summary)
                    .build();

        } catch (Exception e) {
            return null;
        }
    }

    // ── Detect if AI is offering to generate ────────────────────────
    private boolean isOfferingGenerate(String text) {
        String lower = text.toLowerCase();
        return lower.contains("generate") || lower.contains("create files") ||
               lower.contains("shall i") || lower.contains("would you like") ||
               lower.contains("ထုတ်ပေးမလား") || lower.contains("generate လုပ်မလား") ||
               lower.contains("コード生成") || lower.contains("生成しましょうか");
    }

    // ── Localized messages ───────────────────────────────────────────
    private String getOfferMessage(String lang) {
        switch (lang) {
            case "my": return "ဒီ design အတွက် code generate လုပ်ပေးမလား?";
            case "ja": return "このデザインのコードを生成しますか？";
            default:   return "Would you like me to generate code for this design?";
        }
    }

    private String getFilesReadyMessage(String lang, int count, String summary) {
        switch (lang) {
            case "my": return count + " ဖိုင် generate ပြီးပြီ။ " + summary;
            case "ja": return count + "ファイルを生成しました。" + summary;
            default:   return "Generated " + count + " files. " + summary;
        }
    }

    private String getErrorMessage(String lang) {
        switch (lang) {
            case "my": return "တစ်ခုခု မှားနေတယ်။ နောက်မှ ထပ်ကြိုးစားပေးပါ။";
            case "ja": return "エラーが発生しました。後でもう一度お試しください。";
            default:   return "Something went wrong. Please try again.";
        }
    }
}
