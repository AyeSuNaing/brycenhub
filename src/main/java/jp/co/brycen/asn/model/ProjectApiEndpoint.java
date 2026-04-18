package jp.co.brycen.asn.model;

import lombok.Data;
import javax.persistence.*;

@Data
@Entity
@Table(name = "project_api_endpoints",
       uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "method", "url"}))
public class ProjectApiEndpoint {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "frame_name")
    private String frameName;

    @Column(name = "method", nullable = false, length = 10)
    private String method;

    @Column(name = "url", nullable = false, length = 500)
    private String url;

    @Column(name = "description", length = 500)
    private String description;

    // ── Request / Response schema ──
    @Column(name = "request_body", columnDefinition = "TEXT")
    private String requestBody;

    @Column(name = "response_body", columnDefinition = "TEXT")
    private String responseBody;

    @Column(name = "path_params", length = 500)
    private String pathParams;

    @Column(name = "query_params", length = 500)
    private String queryParams;

    @Column(name = "status_codes", length = 200)
    private String statusCodes;
}
