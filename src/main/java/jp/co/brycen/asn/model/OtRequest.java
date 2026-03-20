package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ot_requests")
public class OtRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "ot_hours", nullable = false)
    private BigDecimal otHours;

    @Column(name = "day_type", nullable = false)
    private String dayType;
    // WEEKDAY / SATURDAY / SUNDAY / HOLIDAY

    @Column(name = "ot_rate", nullable = false)
    private BigDecimal otRate;
    // 1.5 = WEEKDAY/SATURDAY | 2.0 = SUNDAY/HOLIDAY

    @Column(name = "ot_amount")
    private BigDecimal otAmount;

    @Column(name = "project_id")
    private Long projectId;

    private String reason;

    private String status = "PENDING";
    // PENDING / APPROVED / REJECTED

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "reject_reason")
    private String rejectReason;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (this.dayType != null && this.otRate == null) {
            this.otRate = ("SUNDAY".equals(this.dayType) || "HOLIDAY".equals(this.dayType))
                ? new BigDecimal("2.0")
                : new BigDecimal("1.5");
        }
    }
}
