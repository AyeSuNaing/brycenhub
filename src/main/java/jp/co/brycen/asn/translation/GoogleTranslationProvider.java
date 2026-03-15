package jp.co.brycen.asn.translation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.util.*;

/**
 * Google Translate Provider
 * Google Translate API key ရလာရင် application.properties မှာ:
 *   translation.provider=google
 *   translation.google.api-key=YOUR_KEY_HERE
 * ဒါပဲ ပြောင်းရမယ် — code တစ်ကြောင်းမှ မပြောင်းရ!
 */
@Component
@ConditionalOnProperty(name = "translation.provider", havingValue = "google")
public class GoogleTranslationProvider implements TranslationProvider {

    @Value("${translation.google.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String GOOGLE_API_URL =
            "https://translation.googleapis.com/language/translate/v2";

    @Override
    public String translate(String text, String fromLang, String toLang) {
        if (text == null || text.isBlank()) return text;
        if (fromLang != null && fromLang.equals(toLang)) return text;

        try {
            String url = GOOGLE_API_URL + "?key=" + apiKey;

            Map<String, Object> body = new HashMap<>();
            body.put("q", text);
            body.put("target", toLang);
            if (fromLang != null && !fromLang.isBlank()) {
                body.put("source", fromLang);
            }
            body.put("format", "text");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map data = (Map) response.getBody().get("data");
                if (data != null) {
                    List translations = (List) data.get("translations");
                    if (translations != null && !translations.isEmpty()) {
                        Map translation = (Map) translations.get(0);
                        return (String) translation.get("translatedText");
                    }
                }
            }
        } catch (Exception e) {
            // API error ဖြစ်ရင် original text ပြန်ပေး
            System.err.println("Google Translate error: " + e.getMessage());
        }

        return text; // fallback
    }

    @Override
    public String getProviderName() {
        return "GoogleTranslationProvider";
    }
}
