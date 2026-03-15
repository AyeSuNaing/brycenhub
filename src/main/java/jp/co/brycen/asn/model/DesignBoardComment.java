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
@Table(name = "design_board_comments")
public class DesignBoardComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "board_id", nullable = false)
    private Long boardId;
    // FK → design_boards.id

    @Column(name = "user_id", nullable = false)
    private Long userId;
    // FK → users.id (can be client user)

    @Column(name = "screen_name")
    private String screenName;
    // which screen/page the comment is about
    // Phase 1: dropdown select
    // Phase 2: derived from pos_x, pos_y pin

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "comment_type")
    private String commentType = "FEEDBACK";
    // FEEDBACK, QUESTION, APPROVAL, REJECTION, REVISION

    @Column(name = "status")
    private String status = "OPEN";
    // OPEN, RESOLVED, CLOSED

    @Column(name = "parent_id")
    private Long parentId;
    // null = top-level | not null = reply thread

    // ── Phase 2: pin position (NULL for now) ──────────────
    @Column(name = "pos_x")
    private Double posX;
    // canvas X coordinate — null in Phase 1

    @Column(name = "pos_y")
    private Double posY;
    // canvas Y coordinate — null in Phase 1

    @Column(name = "resolved_by")
    private Long resolvedBy;
    // FK → users.id

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

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
