package jp.co.brycen.asn.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * member_profiles table — users 1:1
 * CV, education, experience
 */
@Entity
@Table(name = "member_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "experience_detail", columnDefinition = "TEXT")
    private String experienceDetail;

    @Column(name = "experience_detail_en", columnDefinition = "TEXT")
    private String experienceDetailEn;

    @Column(columnDefinition = "TEXT")
    private String education;

    @Column(name = "education_en", columnDefinition = "TEXT")
    private String educationEn;

    @Column(name = "cv_file_url", length = 500)
    private String cvFileUrl;

    @Column(name = "cv_analyzed")
    private Boolean cvAnalyzed = false;

    @Column(name = "cv_original_language", length = 5)
    private String cvOriginalLanguage;
    
    @Column(name = "projects_json", columnDefinition = "TEXT")
    private String projectsJson;

    @Column(name = "social_links_json", columnDefinition = "TEXT")
    private String socialLinksJson;

    // CV | MANUAL | BOTH
    @Column(name = "input_type", length = 10)
    private String inputType = "MANUAL";

    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}