package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * finance_categories — Master list of expense/income categories.
 * scope = GLOBAL  → available to all branches (branch_id = NULL)
 * scope = BRANCH  → visible to specific branch only
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "finance_categories")
public class FinanceCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 10)
    private String icon;                    // emoji — e.g. 💰 🏢 💡

    @Column(nullable = false, length = 10)
    private String type;                    // EXPENSE | INCOME

    @Column(nullable = false, length = 10)
    private String scope = "GLOBAL";        // GLOBAL | BRANCH

    @Column(name = "branch_id")
    private Long branchId;                  // NULL = global

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (scope    == null) scope    = "GLOBAL";
        if (isActive == null) isActive = true;
    }
}
