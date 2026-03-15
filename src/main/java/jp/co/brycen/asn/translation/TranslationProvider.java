package jp.co.brycen.asn.translation;

/**
 * Translation Provider Interface
 * Mock → Google Translate switch: application.properties တစ်ကြောင်းပဲ ပြောင်းရ
 */
public interface TranslationProvider {
    /**
     * @param text     translate လုပ်မဲ့ text
     * @param fromLang source language code (en, ja, my, km, vi, ko)
     * @param toLang   target language code
     * @return translated text
     */
    String translate(String text, String fromLang, String toLang);

    /**
     * Provider name (log/debug အတွက်)
     */
    String getProviderName();
}
