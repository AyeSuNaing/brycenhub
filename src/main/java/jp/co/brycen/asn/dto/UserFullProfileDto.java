package jp.co.brycen.asn.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

// GET /api/users/{id}/full-profile → response DTO
@Data
public class UserFullProfileDto {

    // ── Basic Info ─────────────────────────────
    private Long          id;
    private String        name;
    private String        email;
    private String        phone;
    private Boolean       isActive;
    private String        preferredLanguage;
    private String        profileImage;
    private LocalDateTime lastSeen;

    // ── Role (user_roles join) ──────────────────
    private Long   roleId;
    private String roleName;
    private String roleDisplayName;
    private String roleColor;

    // ── Department (departments join) ───────────
    private Long   departmentId;
    private String departmentName;

    // ── CV / Profile (member_profiles join) ─────
    private Boolean cvAnalyzed;
    private String  cvFileUrl;
    private Integer experienceYears;
    private String  educationEn;
    private String  experienceDetailEn;
    private String  cvOriginalLanguage;
    private String  projectsJson;      // JSON array string → parse in Angular
    private String  socialLinksJson;   // {linkedin,github,twitter,facebook,website,other}

    // ── Skills (member_skills) ───────────────────
    private List<SkillItem> skills;

    @Data
    public static class SkillItem {
        private Long   id;
        private String skillName;
        private String skillNameEn;
        private String skillLevel;   // BEGINNER / MID / SENIOR
        private String inputType;    // CV / MANUAL
    }
}