package jp.co.brycen.asn.model;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "project_generated_files",
       uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "frame_name"}))
public class ProjectGeneratedFile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "frame_name", nullable = false)
    private String frameName;

    @Column(name = "generated_by", nullable = false)
    private Long generatedBy;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @OneToMany(mappedBy = "generatedFile", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectGeneratedFileItem> items;

    @PrePersist
    public void prePersist() {
        this.generatedAt = LocalDateTime.now();
    }
}
