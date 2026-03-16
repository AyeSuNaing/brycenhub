package jp.co.brycen.asn.translation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.*;

/**
 * DeepL Translation Provider
 *
 * application.properties မှာ:
 *   translation.provider=deepl
 *   translation.deepl.api-key=1db1c9ff-8d0c-429f-9caf-439b20279799:fx
 *
 * DeepL Free API endpoint: https://api-free.deepl.com/v2/translate
 * DeepL Pro  API endpoint: https://api.deepl.com/v2/translate
 * (API key `:fx` နဲ့ ဆုံးရင် Free tier)
 *
 * Supported languages (ကျွန်တော်တို့ project):
 *   EN ✅  JA ✅  KO ✅
 *   VI ⚠️ (Pro only)   KM ❌   MY ❌ → English ပြ
 */
@Component
@ConditionalOnProperty(name = "translation.provider", havingValue = "deepl")
public class DeepLTranslationProvider implements TranslationProvider {

    // DeepL Free tier → api-free.deepl.com
    // DeepL Pro tier  → api.deepl.com
    private static final String DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
    private static final String DEEPL_PRO_URL  = "https://api.deepl.com/v2/translate";

    // DeepL မပံ့ပိုးတဲ့ language codes → original English ပြ
    private static final Set<String> UNSUPPORTED = Set.of("km");

    // ကျွန်တော်တို့ language code → DeepL language code mapping
    // DeepL က uppercase သုံးတယ် (en → EN, ja → JA)
    private static final Map<String, String> LANG_MAP = new HashMap<>();
    static {
        LANG_MAP.put("en", "EN");
        LANG_MAP.put("ja", "JA");
        LANG_MAP.put("ko", "KO");
        LANG_MAP.put("vi", "VI");   // Pro only — Free မှာ error ဖြစ်ရင် fallback
        LANG_MAP.put("km", null);   // Not supported
        LANG_MAP.put("my", "MY");   // Not supported
    }

    @Value("${translation.deepl.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String translate(String text, String fromLang, String toLang) {
        if (text == null || text.isBlank()) return text;

        // Same language → original ပြ
        if (fromLang != null && fromLang.equals(toLang)) return text;

        // Unsupported language → English (original) ပြ
        if (UNSUPPORTED.contains(toLang)) return text;

        // DeepL language code ရယူ
        String deepLTarget = LANG_MAP.get(toLang);
        if (deepLTarget == null) return text; // mapping မရှိရင် fallback

        String deepLSource = fromLang != null
                ? LANG_MAP.getOrDefault(fromLang, "EN")
                : "EN";

        // API URL ရွေး (`:fx` နဲ့ ဆုံးရင် Free)
        String apiUrl = (apiKey != null && apiKey.endsWith(":fx"))
                ? DEEPL_FREE_URL
                : DEEPL_PRO_URL;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.set("Authorization", "DeepL-Auth-Key " + apiKey);

            // DeepL API က form-urlencoded သုံးတယ်
            String body = "text=" + encode(text)
                    + "&source_lang=" + deepLSource
                    + "&target_lang=" + deepLTarget;

            HttpEntity<String> request = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    apiUrl, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List translations = (List) response.getBody().get("translations");
                if (translations != null && !translations.isEmpty()) {
                    Map first = (Map) translations.get(0);
                    Object translated = first.get("text");
                    if (translated != null) {
                        return translated.toString();
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[DeepL] Error translating to " + toLang + ": " + e.getMessage());
        }

        // Fallback → original text
        return text;
    }

    /**
     * URL encode helper (java.net.URLEncoder သုံး)
     */
    private String encode(String text) {
        try {
            return java.net.URLEncoder.encode(text, "UTF-8");
        } catch (Exception e) {
            return text;
        }
    }

    @Override
    public String getProviderName() {
        return "DeepL";
    }
}
