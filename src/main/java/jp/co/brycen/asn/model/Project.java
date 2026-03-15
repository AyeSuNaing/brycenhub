package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    // ── NEW ───────────────────────────────────────────────
    @Column(name = "project_key", unique = true)
    private String projectKey;
    // e.g. KH-001, JP-023

    @Column(columnDefinition = "TEXT")
    private String description;

    // ── NEW ───────────────────────────────────────────────
    private String category;
    // Web, Mobile, Desktop, API, Internal

    // ── NEW ───────────────────────────────────────────────
    private String tags;
    // comma separated: "healthcare,responsive,bilingual"

    // ── NEW ───────────────────────────────────────────────
    private String color;
    // hex color e.g. #0891b2 — UI card accent color

    @Column(nullable = false)
    private String status = "PLANNING";
    // PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED

    // ── NEW ───────────────────────────────────────────────
    private String priority = "MEDIUM";
    // LOW, MEDIUM, HIGH, CRITICAL

    // ── NEW ───────────────────────────────────────────────
    @Column(name = "health_status")
    private String healthStatus = "ON_TRACK";
    // ON_TRACK, AT_RISK, DELAYED

    // ── NEW ───────────────────────────────────────────────
    @Column(name = "health_score")
    private Integer healthScore = 5;
    // 1~5 — used for health dots in portfolio view

    // ── NEW ───────────────────────────────────────────────
    private String visibility = "BRANCH";
    // PRIVATE, BRANCH, GROUP

    @Column(name = "pm_id")
    private Long pmId;

    // ── NEW ───────────────────────────────────────────────
    @Column(name = "client_id")
    private Long clientId;
    // FK → clients.id

    @Column(name = "branch_id")
    private Long branchId;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    private Long budget;

    private Integer progress = 0;
    // 0~100%

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "original_language")
    private String originalLanguage = "en";
    
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
