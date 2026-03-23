package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.CvDto;
import jp.co.brycen.asn.model.MemberProfile;
import jp.co.brycen.asn.model.MemberSkill;
import jp.co.brycen.asn.repository.MemberProfileRepository;
import jp.co.brycen.asn.repository.MemberSkillRepository;
import jp.co.brycen.asn.service.CvService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CV Controller
 *
 * POST /api/cv/analyze          ← PDF → Claude analyze → JSON
 * POST /api/cv/upload           ← save file + member_profiles update
 * POST /api/member-skills/bulk  ← save skills after confirm
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class CvController {

    @Autowired private CvService                cvService;
    @Autowired private MemberProfileRepository  profileRepo;
    @Autowired private MemberSkillRepository    skillRepo;

    // ══════════════════════════════════════════════════════════════
    // POST /api/cv/analyze
    // ══════════════════════════════════════════════════════════════
    @PostMapping("/api/cv/analyze")
    public ResponseEntity<?> analyzeCv(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "File is required"));
        }

        String name = file.getOriginalFilename();
        if (name != null) {
            String lower = name.toLowerCase();
            if (!lower.endsWith(".pdf") && !lower.endsWith(".doc") && !lower.endsWith(".docx")) {
                return ResponseEntity.badRequest()
                    .body(Map.of("message", "Only PDF files are supported"));
            }
        }

        try {
            CvDto.CvAnalyzeResponse result = cvService.analyzeCv(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("[CvController] analyzeCv error: " + e.getMessage());
            return ResponseEntity.status(500)
                .body(Map.of("message",
                    e.getMessage() != null ? e.getMessage() : "CV analysis failed"));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // POST /api/cv/upload
    // Multipart: file + userId
    // ══════════════════════════════════════════════════════════════
    @PostMapping("/api/cv/upload")
    public ResponseEntity<?> uploadCv(
            @RequestParam("file")   MultipartFile file,
            @RequestParam("userId") Long userId) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "File is required"));
        }

        try {
            // 1. Save file → uploads/cv/
            String fileUrl = cvService.saveCvFile(file, userId);

            // 2. Analyze CV to get education + experience for DB
            CvDto.CvAnalyzeResponse analyzed = null;
            try {
                analyzed = cvService.analyzeCv(file);
            } catch (Exception e) {
                // analyze fail ဖြစ်ရင် file save ပဲ လုပ်မယ်
                System.err.println("[CvController] Re-analyze failed (non-critical): " + e.getMessage());
            }

            // 3. Update member_profiles
            MemberProfile profile = profileRepo.findByUserId(userId)
                .orElse(new MemberProfile());

            profile.setUserId(userId);
            profile.setCvFileUrl(fileUrl);
            profile.setCvAnalyzed(true);
            profile.setAnalyzedAt(LocalDateTime.now());

            if (analyzed != null) {
                profile.setExperienceYears(analyzed.getExperienceYears());
                profile.setEducation      (analyzed.getEducationOriginal());
                profile.setEducationEn    (analyzed.getEducationEn());
                profile.setExperienceDetail   (analyzed.getExperienceOriginal());
                profile.setExperienceDetailEn (analyzed.getExperienceEn());
                profile.setCvOriginalLanguage (analyzed.getDetectedLanguage());
                if (analyzed.getProjects() != null && !analyzed.getProjects().isEmpty()) {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper =
                            new com.fasterxml.jackson.databind.ObjectMapper();
                        profile.setProjectsJson(mapper.writeValueAsString(analyzed.getProjects()));
                    } catch (Exception ex) {
                        System.err.println("[CvController] projects JSON error: " + ex.getMessage());
                    }
                }

                // ✅ Social Links JSON save
                if (analyzed.getSocialLinks() != null) {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper =
                            new com.fasterxml.jackson.databind.ObjectMapper();
                        profile.setSocialLinksJson(mapper.writeValueAsString(analyzed.getSocialLinks()));
                    } catch (Exception ex) {
                        System.err.println("[CvController] socialLinks JSON error: " + ex.getMessage());
                    }
                }
            }

            // input_type logic
            if (profile.getInputType() == null) {
                profile.setInputType("CV");
            } else if ("MANUAL".equals(profile.getInputType())) {
                profile.setInputType("BOTH");
            }

            profileRepo.save(profile);

            return ResponseEntity.ok(Map.of(
                "message", "CV uploaded successfully",
                "fileUrl", fileUrl
            ));

        } catch (Exception e) {
            System.err.println("[CvController] uploadCv error: " + e.getMessage());
            return ResponseEntity.status(500)
                .body(Map.of("message", "CV upload failed: " + e.getMessage()));
        }
    }

    // ══════════════════════════════════════════════════════════════
    // POST /api/member-skills/bulk
    // Body: { userId, skills: [{name, level}] }
    // ══════════════════════════════════════════════════════════════
    @PostMapping("/api/member-skills/bulk")
    public ResponseEntity<?> saveSkillsBulk(
            @RequestBody CvDto.SaveSkillsRequest request) {

        if (request.getUserId() == null) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "userId is required"));
        }
        if (request.getSkills() == null || request.getSkills().isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "No skills to save", "count", 0));
        }

        try {
            // Delete existing CV skills for this user (re-upload case)
            skillRepo.deleteByUserIdAndInputType(request.getUserId(), "CV");

            // Save new skills
            List<MemberSkill> saved = new ArrayList<>();
            for (CvDto.SkillSaveItem item : request.getSkills()) {
                if (item.getName() == null || item.getName().trim().isEmpty()) continue;

                MemberSkill skill = new MemberSkill();
                skill.setUserId    (request.getUserId());
                skill.setSkillName  (item.getName().trim());
                skill.setSkillNameEn(item.getName().trim());
                skill.setSkillLevel (normalizeLevel(item.getLevel()));
                skill.setInputType  ("CV");
                saved.add(skillRepo.save(skill));
            }

            return ResponseEntity.ok(Map.of(
                "message", "Skills saved successfully",
                "count",   saved.size()
            ));

        } catch (Exception e) {
            System.err.println("[CvController] saveSkills error: " + e.getMessage());
            return ResponseEntity.status(500)
                .body(Map.of("message", "Failed to save skills: " + e.getMessage()));
        }
    }

    // ── Helper ────────────────────────────────────────────────────
    private String normalizeLevel(String level) {
        if (level == null || level.trim().isEmpty()) return null;
        switch (level.toUpperCase().trim()) {
            case "BEGINNER": return "BEGINNER";
            case "MID":      return "MID";
            case "SENIOR":   return "SENIOR";
            default:         return null;
        }
    }
}