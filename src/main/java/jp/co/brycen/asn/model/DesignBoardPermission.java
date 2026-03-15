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
@Table(name = "design_board_permissions")
public class DesignBoardPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "board_id", nullable = false)
    private Long boardId;
    // FK → design_boards.id

    @Column(name = "user_id", nullable = false)
    private Long userId;
    // FK → users.id

    @Column(name = "permission_type", nullable = false)
    private String permissionType = "VIEW";
    // VIEW   = read-only canvas access
    // COMMENT = can leave comments
    // EDIT   = can modify canvas
    // ADMIN  = full control

    @Column(name = "granted_by")
    private Long grantedBy;
    // FK → users.id (who gave this permission)

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    // null = permanent | not null = temporary access

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
