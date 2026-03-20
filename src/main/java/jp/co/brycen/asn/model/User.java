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
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    // ⚠️ role String ဖြုတ်ပြီ — DB မှာ role column မရှိ
    // role_id FK → user_roles table သုံးမယ်
    @Column(name = "role_id")
    private Long roleId;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "branch_id")
    private Long branchId;

    @Column(name = "department_id")
    private Long departmentId;
    // FK → departments.id

    @Column(name = "preferred_language")
    private String preferredLanguage = "en";
    // en, ja, my, vi, ko, km

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "profile_image")
    private String profileImage;

    private String phone;

    // ── last_seen — online status ──────────────────────────
    @Column(name = "last_seen")
    private LocalDateTime lastSeen;
    // online = lastSeen within 5 minutes

    @Column(name = "created_at")
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