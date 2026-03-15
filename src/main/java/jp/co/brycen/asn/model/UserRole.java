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
@Table(name = "user_roles")
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
    // BOSS, VICE_PRESIDENT, COUNTRY_DIRECTOR, ADMIN,
    // PROJECT_MANAGER, LEADER, DEVELOPER, UI_UX, QA, CLIENT

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false)
    private Integer level;
    // 1=BOSS, 2=VICE_PRESIDENT/COUNTRY_DIRECTOR, 3=ADMIN ...

    @Column(nullable = false)
    private String color;
    // hex color e.g. #ef4444 — used for inline badge style

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
