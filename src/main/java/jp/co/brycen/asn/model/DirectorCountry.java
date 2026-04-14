package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Entity
@Table(name = "director_countries")
public class DirectorCountry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "director_id", nullable = false)
    private Long directorId;

    @Column(name = "country_id", nullable = false)
    private Long countryId;

    @Column(name = "role_type")
    private String roleType; // PRIMARY, SECONDARY

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @PrePersist
    protected void onCreate() {
        assignedAt = LocalDateTime.now();
    }
}