package jp.co.brycen.asn.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * CV Analyze API Response DTO
 * Angular add-staff-inline.ts ကို ပြန်ပို့မယ်
 */
public class CvDto {

    // ── Analyze Response ──────────────────────────────────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CvAnalyzeResponse {

        private String detectedLanguage;    // en | ja | my | km | vi | ko
        private String name;                // Detected candidate name
        private String email;               // Detected email (optional)
        private String phone;               // Detected phone (optional)
        private Integer experienceYears;    // e.g. 3
        private String educationOriginal;   // Original language
        private String educationEn;         // EN standard
        private String experienceOriginal;  // Original language
        private String experienceEn;        // EN standard
        private List<SkillItem> skills;       // Detected skills list
        private List<ProjectItem> projects;   // Detected projects list
        private String profilePhotoBase64;    // Base64 photo if found in CV (rare)
        private String profilePhotoUrl;       // Uploaded profile photo URL (future)
        private SocialLinks socialLinks;      // LinkedIn, GitHub, etc.
    }

    // ── Social Links ──────────────────────────────────────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SocialLinks {
        private String linkedin;   // LinkedIn URL or username
        private String github;     // GitHub URL or username
        private String twitter;    // Twitter/X
        private String facebook;   // Facebook
        private String website;    // Personal website / portfolio
        private String other;      // Any other social/link found
    }

    // ── Skill Item ────────────────────────────────────────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SkillItem {
        private String skillName;     // Original language
        private String skillNameEn;   // EN standard (for DB + AI query)
        private String skillLevel;    // BEGINNER | MID | SENIOR | null
    }

    // ── Project Item ──────────────────────────────────────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProjectItem {
        private String title;        // Project name
        private String description;  // Short description
        private String techStack;    // e.g. "Swift, Firebase, MVVM"
        private String duration;     // e.g. "2022 - 2023"
        private String role;         // e.g. "iOS Lead Developer"
    }

    // ── Upload Request (userId + file via multipart) ───────────────
    // Handled by @RequestParam in Controller, no DTO needed

    // ── Save Skills Request (bulk save after confirm) ──────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveSkillsRequest {
        private Long userId;
        private List<SkillSaveItem> skills;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillSaveItem {
        private String name;    // skillNameEn
        private String level;   // BEGINNER | MID | SENIOR | ""
    }
}
