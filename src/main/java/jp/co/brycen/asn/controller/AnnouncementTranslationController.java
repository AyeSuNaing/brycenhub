package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Announcement;
import jp.co.brycen.asn.model.AnnouncementTranslation;
import jp.co.brycen.asn.repository.AnnouncementRepository;
import jp.co.brycen.asn.repository.AnnouncementTranslationRepository;
import jp.co.brycen.asn.translation.TranslationProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * GET  /api/announcements/{id}/translate?lang=ja
 * POST /api/announcements/translate-batch  { ids: [1,2,3], lang: "ja" }
 */
@RestController
@RequestMapping("/api/announcements")
public class AnnouncementTranslationController {

    @Autowired private AnnouncementRepository            announcementRepo;
    @Autowired private AnnouncementTranslationRepository translationRepo;
    @Autowired private TranslationProvider               translationProvider;

    // ── Single translate ─────────────────────────────────────
    @GetMapping("/{id}/translate")
    public ResponseEntity<?> translate(
            @PathVariable Long id,
            @RequestParam String lang) {
        try {
            return ResponseEntity.ok(translateOne(id, lang));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ── Batch translate ──────────────────────────────────────
    @PostMapping("/translate-batch")
    public ResponseEntity<?> translateBatch(
            @RequestBody Map<String, Object> req) {
        try {
            String lang = (String) req.get("lang");
            @SuppressWarnings("unchecked")
            List<Integer> ids = (List<Integer>) req.get("ids");

            if (lang == null || ids == null || ids.isEmpty()) {
                return ResponseEntity.ok(Collections.emptyList());
            }

            List<Map<String, Object>> result = ids.stream()
                .map(id -> translateOne(Long.valueOf(id), lang))
                .collect(Collectors.toList());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ── Shared translate logic ───────────────────────────────
    private Map<String, Object> translateOne(Long id, String lang) {
        Announcement a = announcementRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + id));

        String sourceLang = a.getOriginalLanguage() != null
            ? a.getOriginalLanguage() : "en";

        // Same language → original ပြ
        if (sourceLang.equals(lang)) {
            return Map.of(
                "id",       id,
                "language", lang,
                "title",    a.getTitle()   != null ? a.getTitle()   : "",
                "content",  a.getContent() != null ? a.getContent() : "",
                "cached",   false,
                "provider", "original"
            );
        }

        // Cache စစ်
        Optional<AnnouncementTranslation> cached =
            translationRepo.findByAnnouncementIdAndLanguageCode(id, lang);

        if (cached.isPresent()) {
            AnnouncementTranslation c = cached.get();
            return Map.of(
                "id",       id,
                "language", lang,
                "title",    c.getTranslatedTitle()   != null ? c.getTranslatedTitle()   : "",
                "content",  c.getTranslatedContent() != null ? c.getTranslatedContent() : "",
                "cached",   true,
                "provider", "cache"
            );
        }

        // Translate
        String translatedTitle   = translationProvider.translate(a.getTitle(), sourceLang, lang);
        String translatedContent = a.getContent() != null
            ? translationProvider.translate(a.getContent(), sourceLang, lang) : "";

        // Cache သိမ်း
        AnnouncementTranslation t = new AnnouncementTranslation();
        t.setAnnouncementId(id);
        t.setLanguageCode(lang);
        t.setTranslatedTitle(translatedTitle);
        t.setTranslatedContent(translatedContent);
        translationRepo.save(t);

        return Map.of(
            "id",       id,
            "language", lang,
            "title",    translatedTitle,
            "content",  translatedContent,
            "cached",   false,
            "provider", translationProvider.getProviderName()
        );
    }
}