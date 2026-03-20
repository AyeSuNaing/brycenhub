package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "member_skills")
public class MemberSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "skill_name", nullable = false)
    private String skillName;
    // original language (ja: iOSエンジニア)

    @Column(name = "skill_name_en", nullable = false)
    private String skillNameEn;
    // EN standard (AI query: iOS (Swift))

    @Column(name = "skill_level")
    private String skillLevel;
    // BEGINNER / MID / SENIOR (nullable)

    @Column(name = "input_type")
    private String inputType = "MANUAL";
    // CV / MANUAL

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
