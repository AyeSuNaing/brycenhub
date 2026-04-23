package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * salary_history — Monthly payroll record (one row per user per pay period).
 *
 * <p>Historical snapshot — once calculated, values stay.
 * Status flow: DRAFT → HR_REVIEWED → CONFIRMED → PAID</p>
 *
 * <p>Pay period example: "2026-03" means Feb 25, 2026 → Mar 24, 2026.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "salary_history",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "pay_period"}))
public class SalaryHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "branch_id", nullable = false)
    private Long branchId;

    // ── Pay period ──────────────────────────────────────────
    /** Format "YYYY-MM" (e.g. "2026-03") */
    @Column(name = "pay_period", nullable = false, length = 7)
    private String payPeriod;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    // ── Calculation snapshot ────────────────────────────────
    @Column(name = "base_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "working_days", nullable = false)
    private Integer workingDays;

    @Column(name = "actual_days", nullable = false)
    private Integer actualDays;

    @Column(name = "daily_rate", nullable = false, precision = 15, scale = 2)
    private BigDecimal dailyRate;

    @Column(name = "earned_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal earnedSalary;

    @Column(name = "ot_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal otAmount;

    @Column(name = "deductions", nullable = false, precision = 15, scale = 2)
    private BigDecimal deductions;

    @Column(name = "bonuses", nullable = false, precision = 15, scale = 2)
    private BigDecimal bonuses;

    @Column(name = "gross_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal grossSalary;

    @Column(name = "tax_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "net_salary", nullable = false, precision = 15, scale = 2)
    private BigDecimal netSalary;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    /** DRAFT | HR_REVIEWED | CONFIRMED | PAID */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "note", length = 500)
    private String note;
    
	
	/** VP/Boss rejection reason — cleared on resubmit */
	@Column(name = "reject_reason", length = 500)
	private String rejectReason;   // ← ဒါ ထပ်ထည့်

    // ── Audit ───────────────────────────────────────────────
    @Column(name = "calculated_by")
    private Long calculatedBy;

    @Column(name = "calculated_at")
    private LocalDateTime calculatedAt;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status    == null) status    = "DRAFT";
        // BigDecimal safety defaults
        if (otAmount   == null) otAmount   = BigDecimal.ZERO;
        if (deductions == null) deductions = BigDecimal.ZERO;
        if (bonuses    == null) bonuses    = BigDecimal.ZERO;
        if (taxAmount  == null) taxAmount  = BigDecimal.ZERO;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
