package jp.co.brycen.asn.model;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "project_rules")
public class ProjectRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    private Source source;

    @Column(name = "source_file_url", length = 500)
    private String sourceFileUrl;        // uploaded file path (any format)

    @Column(name = "source_file_type", length = 10)
    private String sourceFileType;       // "pdf" | "docx" | "xlsx" | "txt"

    @Column(name = "position")
    private Integer position;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isActive   == null) isActive  = true;
        if (position   == null) position  = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ── Enums ─────────────────────────────────────────────────────
    public enum Category {
        CODING_STANDARDS,
        PROCESS_RULES,
        GENERAL
    }

    public enum Source {
        PDF,
        DOCX,
        XLSX,
        TXT,
        MANUAL,
        AI_GENERATED
    }
}
