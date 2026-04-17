package jp.co.brycen.asn.model;

import lombok.Data;
import javax.persistence.*;

@Data
@Entity
@Table(name = "project_db_tables",
       uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "table_name"}))
public class ProjectDbTable {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "frame_name")
    private String frameName;

    @Column(name = "table_name", nullable = false, length = 100)
    private String tableName;

    @Column(name = "columns", columnDefinition = "TEXT")
    private String columns; // JSON

    @Column(name = "description", length = 300)
    private String description;
}
