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
    // FK → users.id

    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "original_language")
    private String originalLanguage = "en";

    @Column(name = "target_scope")
    private String targetScope;
    // GLOBAL, BRANCH, PROJECT, ROLE

    @Column(name = "target_id")
    private Long targetId;
    // branch_id or project_id depending on target_scope

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
