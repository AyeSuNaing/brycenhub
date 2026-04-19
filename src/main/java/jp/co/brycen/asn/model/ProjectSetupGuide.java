package jp.co.brycen.asn.model;

import lombok.*;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * AI-generated project setup guide for PM kick-off workflow.
 * One guide per project — cached after first generation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "project_setup_guides")
public class ProjectSetupGuide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false, unique = true)
    private Long projectId;

    /**
     * JSON content — structure:
     * {
     *   "summary": "Angular 21 + Spring Boot 3.2 + MySQL",
     *   "steps": [
     *     {
     *       "title": "Prerequisites",
     *       "description": "Verify versions are installed",
     *       "commands": ["node --version", "java --version", ...]
     *     },
     *     ...
     *   ]
     * }
     */
    @Column(name = "content", nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @Column(name = "generated_by", length = 20)
    private String generatedBy;
    // "AI" | "MANUAL"

    @Column(name = "tech_stack_snapshot", columnDefinition = "TEXT")
    private String techStackSnapshot;
    // JSON snapshot of tech stack at generation time — used to detect outdated guide

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (generatedBy == null) generatedBy = "AI";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
