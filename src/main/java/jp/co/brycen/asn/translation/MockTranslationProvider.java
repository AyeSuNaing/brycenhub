package jp.co.brycen.asn.translation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.HashMap;

/**
 * Mock Translation Provider
 * application.properties မှာ: translation.provider=mock (default)
 * Google Translate သုံးချင်ရင်: translation.provider=google
 */
@Component
@ConditionalOnProperty(name = "translation.provider", havingValue = "mock", matchIfMissing = true)
public class MockTranslationProvider implements TranslationProvider {

    // Language prefix map (test အတွက် prefix ထည့်ပြတာ)
    private static final Map<String, String> LANG_PREFIX = new HashMap<>();
    static {
        LANG_PREFIX.put("ja", "[JP]");
        LANG_PREFIX.put("my", "[MM]");
        LANG_PREFIX.put("km", "[KH]");
        LANG_PREFIX.put("vi", "[VN]");
        LANG_PREFIX.put("ko", "[KR]");
        LANG_PREFIX.put("en", "[EN]");
    }

    @Override
    public String translate(String text, String fromLang, String toLang) {
        if (text == null || text.isBlank()) return text;
        if (fromLang != null && fromLang.equals(toLang)) return text;

        String prefix = LANG_PREFIX.getOrDefault(toLang, "[" + toLang.toUpperCase() + "]");
        return prefix + " " + text;
    }

    @Override
    public String getProviderName() {
        return "MockTranslationProvider";
    }
}
