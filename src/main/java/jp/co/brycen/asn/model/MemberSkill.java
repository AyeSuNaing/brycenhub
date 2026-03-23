package jp.co.brycen.asn.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * member_skills table
 * users 1:N — skill တစ်ခုချင်း row ခွဲသိမ်း
 */
@Entity
@Table(name = "member_skills")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "skill_name", nullable = false, length = 100)
    private String skillName;       // Original language

    @Column(name = "skill_name_en", nullable = false, length = 100)
    private String skillNameEn;     // EN standard — AI query

    @Column(name = "skill_level", length = 10)
    private String skillLevel;      // BEGINNER | MID | SENIOR | null

    @Column(name = "input_type", length = 10)
    private String inputType = "MANUAL";  // CV | MANUAL

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
