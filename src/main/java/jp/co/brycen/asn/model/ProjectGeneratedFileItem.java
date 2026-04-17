package jp.co.brycen.asn.model;

import lombok.Data;
import javax.persistence.*;

@Data
@Entity
@Table(name = "project_generated_file_items",
       uniqueConstraints = @UniqueConstraint(columnNames = {"generated_file_id", "file_name"}))
public class ProjectGeneratedFileItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generated_file_id", nullable = false)
    private ProjectGeneratedFile generatedFile;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_content", columnDefinition = "LONGTEXT")
    private String fileContent;
}
