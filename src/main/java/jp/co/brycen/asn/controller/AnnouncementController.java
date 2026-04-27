package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Announcement;
import jp.co.brycen.asn.model.AnnouncementTranslation;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.AnnouncementRepository;
import jp.co.brycen.asn.repository.AnnouncementTranslationRepository;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.translation.TranslationProvider;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * POST   /api/announcements                       ← create (pre-translate 6 langs)
 * GET    /api/announcements?from=&to=             ← list with date filter + authorName
 * PUT    /api/announcements/{id}                  ← update (re-translate 6 langs)
 * DELETE /api/announcements/{id}                  ← delete
 * PATCH  /api/announcements/{id}/pin              ← toggle pin
 * POST   /api/announcements/admin/retranslate-all ← one-time bulk translate
 */
@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementRepository            announcementRepository;
    private final AnnouncementTranslationRepository translationRepository;
    private final UserRepository                    userRepository;
    private final TranslationProvider               translationProvider;

    private static final String[] ALL_LANGS = {"en", "ja", "my", "km", "vi", "ko"};

    // ── Author cache (per request) ───────────────────────────
    private final Map<Long, String> _authorCache = new HashMap<>();

    private String getAuthorName(Long authorId) {
        if (authorId == null) return "Unknown";
        return _authorCache.computeIfAbsent(authorId, id ->
            userRepository.findById(id)
                .map(User::getName)
                .orElse("Unknown")
        );
    }

    // ─────────────────────────────────────────────────────────
    // POST /api/announcements
    // ─────────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> create(
            @RequestBody CreateRequest req,
            @AuthenticationPrincipal User user) {
        try {
            Announcement a = new Announcement();
            a.setAuthorId(user.getId());
            a.setTitle(req.getTitle());
            a.setContent(req.getContent());
            a.setTargetScope(req.getTargetScope() != null ? req.getTargetScope() : "BRANCH");
            a.setTargetId(req.getTargetId() != null ? req.getTargetId() : user.getBranchId());
            a.setPriority(req.getPriority() != null ? req.getPriority() : "NORMAL");
            a.setIsPinned(0);

            String origLang = (user.getPreferredLanguage() != null)
                    ? user.getPreferredLanguage() : "en";
            a.setOriginalLanguage(origLang);

            if (req.getExpireDays() != null && req.getExpireDays() > 0) {
                a.setExpiresAt(LocalDateTime.now().plusDays(req.getExpireDays()));
            } else {
                a.setExpiresAt(null);
            }

            Announcement saved = announcementRepository.save(a);
            translateAllLanguages(saved);
            return ResponseEntity.ok(withTranslation(saved, origLang));

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("Failed: " + e.getMessage(), false));
        }
    }

    // ─────────────────────────────────────────────────────────
    // GET /api/announcements?from=2026-01-01&to=2026-04-27
    // ─────────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAll(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        String userLang = (user.getPreferredLanguage() != null)
                ? user.getPreferredLanguage() : "en";

        Long branchId = user.getBranchId();

        LocalDateTime fromDt = (from != null && !from.isEmpty())
                ? LocalDate.parse(from).atStartOfDay() : null;
        LocalDateTime toDt = (to != null && !to.isEmpty())
                ? LocalDate.parse(to).atTime(23, 59, 59) : null;

        List<Announcement> list;
        if (fromDt != null && toDt != null) {
            list = (branchId == null)
                    ? announcementRepository.findAllByDateRange(fromDt, toDt)
                    : announcementRepository.findByBranchOrGlobalAndDateRange(branchId, fromDt, toDt);
        } else {
            list = (branchId == null)
                    ? announcementRepository.findAllByOrderByCreatedAtDesc()
                    : announcementRepository.findByBranchOrGlobal(branchId);
        }

        _authorCache.clear(); // per-request cache reset
        List<Map<String, Object>> result = new ArrayList<>();
        for (Announcement a : list) {
            result.add(withTranslation(a, userLang));
        }
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────
    // PUT /api/announcements/{id}
    // ─────────────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody CreateRequest req,
            @AuthenticationPrincipal User user) {
        try {
            Announcement a = announcementRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Announcement not found"));

            if (req.getTitle()       != null) a.setTitle(req.getTitle());
            if (req.getContent()     != null) a.setContent(req.getContent());
            if (req.getPriority()    != null) a.setPriority(req.getPriority());
            if (req.getTargetScope() != null) a.setTargetScope(req.getTargetScope());

            String origLang = (user.getPreferredLanguage() != null)
                    ? user.getPreferredLanguage() : "en";
            a.setOriginalLanguage(origLang);

            if (req.getExpireDays() != null) {
                a.setExpiresAt(req.getExpireDays() > 0
                        ? LocalDateTime.now().plusDays(req.getExpireDays()) : null);
            }

            Announcement saved = announcementRepository.save(a);
            translationRepository.deleteByAnnouncementId(saved.getId());
            translateAllLanguages(saved);
            return ResponseEntity.ok(withTranslation(saved, origLang));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ─────────────────────────────────────────────────────────
    // DELETE /api/announcements/{id}
    // ─────────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            if (!announcementRepository.existsById(id))
                throw new RuntimeException("Announcement not found");
            announcementRepository.deleteById(id);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ─────────────────────────────────────────────────────────
    // PATCH /api/announcements/{id}/pin
    // ─────────────────────────────────────────────────────────
    @PatchMapping("/{id}/pin")
    public ResponseEntity<?> togglePin(@PathVariable Long id) {
        try {
            Announcement a = announcementRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Announcement not found"));
            a.setIsPinned(a.getIsPinned() != null && a.getIsPinned() == 1 ? 0 : 1);
            return ResponseEntity.ok(announcementRepository.save(a));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ─────────────────────────────────────────────────────────
    // POST /api/announcements/admin/retranslate-all
    // ─────────────────────────────────────────────────────────
    @PostMapping("/admin/retranslate-all")
    public ResponseEntity<?> retranslateAll() {
        List<Announcement> all = announcementRepository.findAllByOrderByCreatedAtDesc();
        int success = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        for (Announcement a : all) {
            try {
                translationRepository.deleteByAnnouncementId(a.getId());
                translateAllLanguages(a);
                success++;
            } catch (Exception e) {
                failed++;
                errors.add("id=" + a.getId() + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total",   all.size());
        result.put("success", success);
        result.put("failed",  failed);
        result.put("errors",  errors);
        result.put("message", "Done: " + success + "/" + all.size() + " translated");
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────
    // HELPER — translate to all 6 langs
    // ─────────────────────────────────────────────────────────
    private void translateAllLanguages(Announcement a) {
        String origLang    = a.getOriginalLanguage() != null ? a.getOriginalLanguage() : "en";
        String origTitle   = a.getTitle()   != null ? a.getTitle()   : "";
        String origContent = a.getContent() != null ? a.getContent() : "";

        for (String lang : ALL_LANGS) {
            if (lang.equals(origLang)) continue;
            try {
                String tTitle   = translationProvider.translate(origTitle,   origLang, lang);
                String tContent = translationProvider.translate(origContent, origLang, lang);
                AnnouncementTranslation t = new AnnouncementTranslation();
                t.setAnnouncementId(a.getId());
                t.setLanguageCode(lang);
                t.setTranslatedTitle(tTitle);
                t.setTranslatedContent(tContent);
                translationRepository.save(t);
            } catch (Exception e) {
                System.err.println("[Translate] skip lang=" + lang
                        + " annId=" + a.getId() + " err=" + e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // HELPER — build response with translatedTitle/Content + authorName
    // ─────────────────────────────────────────────────────────
    private Map<String, Object> withTranslation(Announcement a, String userLang) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id",               a.getId());
        map.put("authorId",         a.getAuthorId());
        map.put("authorName",       getAuthorName(a.getAuthorId()));  // ✅ name ထည့်
        map.put("targetScope",      a.getTargetScope());
        map.put("targetId",         a.getTargetId());
        map.put("priority",         a.getPriority());
        map.put("isPinned",         a.getIsPinned());
        map.put("originalLanguage", a.getOriginalLanguage());
        map.put("expiresAt",        a.getExpiresAt());
        map.put("createdAt",        a.getCreatedAt());
        map.put("title",            a.getTitle());
        map.put("content",          a.getContent());

        String origLang = a.getOriginalLanguage() != null ? a.getOriginalLanguage() : "en";
        if (userLang.equals(origLang)) {
            map.put("translatedTitle",   a.getTitle());
            map.put("translatedContent", a.getContent());
        } else {
            Optional<AnnouncementTranslation> t =
                    translationRepository.findByAnnouncementIdAndLanguageCode(a.getId(), userLang);
            map.put("translatedTitle",   t.map(AnnouncementTranslation::getTranslatedTitle).orElse(a.getTitle()));
            map.put("translatedContent", t.map(AnnouncementTranslation::getTranslatedContent).orElse(a.getContent()));
        }
        return map;
    }

    // ─────────────────────────────────────────────────────────
    // Request DTO
    // ─────────────────────────────────────────────────────────
    @Data
    public static class CreateRequest {
        private String  title;
        private String  content;
        private String  targetScope;
        private Long    targetId;
        private String  priority;
        private Integer expireDays;
    }
}