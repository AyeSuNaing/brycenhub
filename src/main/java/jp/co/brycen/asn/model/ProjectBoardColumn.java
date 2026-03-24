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
@Table(name = "project_board_columns")
public class ProjectBoardColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false, length = 100)
    private String name;
    // "Backlog", "In Progress", "In Review", "Customer Confirm", "Done"

    @Column(name = "status_key", nullable = false, length = 50)
    private String statusKey;
    // "TODO", "IN_PROGRESS", "IN_REVIEW", "PENDING_APPROVAL", "DONE"

    @Column(length = 7)
    private String color = "#6366f1";
    // hex color

    @Column(name = "position")
    private Integer position = 0;

    @Column(name = "is_done")
    private Boolean isDone = false;
    // true = final done column

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
