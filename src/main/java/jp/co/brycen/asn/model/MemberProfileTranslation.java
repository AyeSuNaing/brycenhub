package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * member_profile_translations — on-demand translation cache
 * education + experience_detail + projects_json per language
 * Pattern: task_translations / comment_translations 와 동일
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "member_profile_translations")
public class MemberProfileTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "language_code", nullable = false, length = 5)
    private String languageCode;
    // en / ja / my / km / vi / ko

    @Column(columnDefinition = "TEXT")
    private String education;
    // translated education text

    @Column(name = "experience_detail", columnDefinition = "TEXT")
    private String experienceDetail;
    // translated experience summary

    @Column(name = "projects_json", columnDefinition = "TEXT")
    private String projectsJson;
    // translated projects JSON array string

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
