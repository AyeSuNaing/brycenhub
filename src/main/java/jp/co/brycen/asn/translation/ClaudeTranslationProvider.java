package jp.co.brycen.asn.translation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.*;

/**
 * Claude AI Translation Provider
 *
 * application.properties မှာ:
 *   translation.provider=claude
 *   anthropic.api.key=sk-ant-xxxxxxxx
 *
 * Supported languages:
 *   EN ✅  JA ✅  MY ✅  KM ✅  VI ✅  KO ✅
 *   (DeepL မပံ့ပိုးတဲ့ Khmer + Myanmar ပါ support လုပ်တယ်)
 */
@Component
@ConditionalOnProperty(name = "translation.provider", havingValue = "claude")
public class ClaudeTranslationProvider implements TranslationProvider {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL   = "claude-haiku-4-5-20251001";

    // Language code → full name mapping (prompt ထဲ ထည့်ဖို့)
    private static final Map<String, String> LANG_NAMES = new HashMap<>();
    static {
        LANG_NAMES.put("en", "English");
        LANG_NAMES.put("ja", "Japanese");
        LANG_NAMES.put("my", "Myanmar (Burmese)");
        LANG_NAMES.put("km", "Khmer (Cambodian)");
        LANG_NAMES.put("vi", "Vietnamese");
        LANG_NAMES.put("ko", "Korean");
    }

    @Value("${anthropic.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String translate(String text, String fromLang, String toLang) {
        if (text == null || text.isBlank()) return text;
        if (fromLang != null && fromLang.equals(toLang)) return text;

        String targetLangName = LANG_NAMES.getOrDefault(toLang, toLang);
        String sourceLangName = LANG_NAMES.getOrDefault(fromLang, "English");

        // Prompt — translation only, no explanation
        String prompt = String.format(
            "Translate the following text from %s to %s.\n" +
            "Return ONLY the translated text. No explanations, no notes.\n\n" +
            "Text to translate:\n%s",
            sourceLangName, targetLangName, text
        );

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("anthropic-version", "2023-06-01");

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", prompt);

            Map<String, Object> body = new HashMap<>();
            body.put("model", CLAUDE_MODEL);
            body.put("max_tokens", 1024);
            body.put("messages", List.of(message));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                CLAUDE_API_URL, entity, Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<?> content = (List<?>) response.getBody().get("content");
                if (content != null && !content.isEmpty()) {
                    Map<?, ?> firstBlock = (Map<?, ?>) content.get(0);
                    String translated = (String) firstBlock.get("text");
                    return translated != null ? translated.trim() : text;
                }
            }

        } catch (Exception e) {
            System.err.println("[ClaudeTranslationProvider] Error: " + e.getMessage());
        }

        return text; // fallback — error ဖြစ်ရင် original ပြ
    }

    @Override
    public String getProviderName() {
        return "ClaudeTranslationProvider";
    }
}
