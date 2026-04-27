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

import java.util.Map;
import java.util.Optional;

/**
 * GET /api/announcements/{id}/translate?lang=ja
 */
@RestController
@RequestMapping("/api/announcements")
public class AnnouncementTranslationController {

    @Autowired private AnnouncementRepository           announcementRepo;
    @Autowired private AnnouncementTranslationRepository translationRepo;
    @Autowired private TranslationProvider              translationProvider;

    @GetMapping("/{id}/translate")
    public ResponseEntity<?> translate(
            @PathVariable Long id,
            @RequestParam String lang) {
        try {
            Announcement a = announcementRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Announcement not found"));

            String sourceLang = a.getOriginalLanguage() != null
                ? a.getOriginalLanguage() : "en";

            // Same language → original ပြ
            if (sourceLang.equals(lang)) {
                return ResponseEntity.ok(Map.of(
                    "announcementId", id,
                    "language",       lang,
                    "title",          a.getTitle()   != null ? a.getTitle()   : "",
                    "content",        a.getContent() != null ? a.getContent() : "",
                    "cached",         false,
                    "provider",       "original"
                ));
            }

            // Cache စစ်
            Optional<AnnouncementTranslation> cached =
                translationRepo.findByAnnouncementIdAndLanguageCode(id, lang);

            if (cached.isPresent()) {
                AnnouncementTranslation c = cached.get();
                return ResponseEntity.ok(Map.of(
                    "announcementId", id,
                    "language",       lang,
                    "title",          c.getTranslatedTitle()   != null ? c.getTranslatedTitle()   : "",
                    "content",        c.getTranslatedContent() != null ? c.getTranslatedContent() : "",
                    "cached",         true,
                    "provider",       "cache"
                ));
            }

            // Translate
            String translatedTitle   = translationProvider.translate(a.getTitle(),   sourceLang, lang);
            String translatedContent = a.getContent() != null
                ? translationProvider.translate(a.getContent(), sourceLang, lang) : "";

            // Cache သိမ်း
            AnnouncementTranslation t = new AnnouncementTranslation();
            t.setAnnouncementId(id);
            t.setLanguageCode(lang);
            t.setTranslatedTitle(translatedTitle);
            t.setTranslatedContent(translatedContent);
            translationRepo.save(t);

            return ResponseEntity.ok(Map.of(
                "announcementId", id,
                "language",       lang,
                "title",          translatedTitle,
                "content",        translatedContent,
                "cached",         false,
                "provider",       translationProvider.getProviderName()
            ));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
