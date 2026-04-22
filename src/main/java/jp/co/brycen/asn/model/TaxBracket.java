package jp.co.brycen.asn.model;

import lombok.Data;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tax_brackets")
public class TaxBracket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "country_id", nullable = false)
    private Long countryId;

    @Column(name = "min_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal minSalary;

    /** NULL = highest bracket (unlimited upper bound) */
    @Column(name = "max_salary", precision = 15, scale = 2)
    private BigDecimal maxSalary;

    /** Percentage rate, e.g. 10.00 means 10% */
    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
