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
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "sprint_id")
    private Long sprintId;

    @Column(name = "parent_task_id")
    private Long parentTaskId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "original_language")
    private String originalLanguage = "en";

    private String status = "TODO";
    // TODO, IN_PROGRESS, IN_REVIEW, DONE

    private String priority = "MEDIUM";
    // LOW, MEDIUM, HIGH, URGENT

    private String label;

    @Column(name = "assignee_id")
    private Long assigneeId;          // ← DB: assignee_id

    @Column(name = "reporter_id")
    private Long reporterId;          // ← DB: reporter_id (created_by)

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "estimated_hours")
    private Double estimatedHours;    // ← DB: decimal(6,2)

    @Column(name = "actual_hours")
    private Double actualHours;       // ← DB: decimal(6,2)

    @Column(name = "position")
    private Integer position = 0;     // ← DB: position (sort_order)

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
