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
@Table(name = "announcements")
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "original_language")
    private String originalLanguage = "en";

    @Column(name = "target_scope")
    private String targetScope;
    // GLOBAL | BRANCH | PROJECT | ROLE

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "is_pinned")
    private Integer isPinned = 0;

    @Column(name = "priority")
    private String priority = "NORMAL";
    // NORMAL | IMPORTANT | URGENT

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    // NULL = never expire
    // SET  = auto-hide after this datetime

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}