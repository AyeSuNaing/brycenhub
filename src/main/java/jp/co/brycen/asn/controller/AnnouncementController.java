package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Announcement;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.AnnouncementRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * POST   /api/announcements          ← create
 * GET    /api/announcements          ← list
 * PUT    /api/announcements/{id}     ← update
 * DELETE /api/announcements/{id}     ← delete
 * PATCH  /api/announcements/{id}/pin ← toggle pin
 */
@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementRepository announcementRepository;

    // ── POST /api/announcements ──────────────────────────────
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

            // ✅ originalLanguage — use request value or user's preferredLanguage
            String origLang = req.getOriginalLanguage() != null
                ? req.getOriginalLanguage()
                : (user.getPreferredLanguage() != null ? user.getPreferredLanguage() : "en");
            a.setOriginalLanguage(origLang);

            if (req.getExpireDays() != null && req.getExpireDays() > 0) {
                a.setExpiresAt(LocalDateTime.now().plusDays(req.getExpireDays()));
            } else {
                a.setExpiresAt(null);
            }

            return ResponseEntity.ok(announcementRepository.save(a));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse("Failed: " + e.getMessage(), false));
        }
    }

    // ── GET /api/announcements ───────────────────────────────
    @GetMapping
    public ResponseEntity<List<Announcement>> getAll(
            @AuthenticationPrincipal User user) {
        Long branchId = user.getBranchId();
        if (branchId == null) {
            return ResponseEntity.ok(
                announcementRepository.findByTargetScopeOrderByCreatedAtDesc("GLOBAL"));
        }
        return ResponseEntity.ok(
            announcementRepository.findByTargetScopeAndTargetIdOrderByCreatedAtDesc(
                "BRANCH", branchId));
    }

    // ── PUT /api/announcements/{id} ──────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody CreateRequest req,
            @AuthenticationPrincipal User user) {
        try {
            Announcement a = announcementRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Announcement not found"));

            if (req.getTitle()        != null) a.setTitle(req.getTitle());
            if (req.getContent()      != null) a.setContent(req.getContent());
            if (req.getPriority()     != null) a.setPriority(req.getPriority());
            if (req.getTargetScope()  != null) a.setTargetScope(req.getTargetScope());
            if (req.getOriginalLanguage() != null) a.setOriginalLanguage(req.getOriginalLanguage());

            if (req.getExpireDays() != null) {
                a.setExpiresAt(req.getExpireDays() > 0
                    ? LocalDateTime.now().plusDays(req.getExpireDays())
                    : null);
            }

            return ResponseEntity.ok(announcementRepository.save(a));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ── DELETE /api/announcements/{id} ──────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
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

    // ── PATCH /api/announcements/{id}/pin ───────────────────
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

    // ── Request DTO ─────────────────────────────────────────
    @Data
    public static class CreateRequest {
        private String  title;
        private String  content;
        private String  targetScope;
        private Long    targetId;
        private String  priority;
        private Integer expireDays;
        private String  originalLanguage;  // ✅ NEW — en/ja/my/km/vi/ko
    }
}