package jp.co.brycen.asn.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Payroll Phase 2 — Payslip view + Approval workflow.
 *
 * <p>Status transitions:
 * <pre>
 *   DRAFT  →  HR_REVIEWED  →  CONFIRMED  →  PAID
 *   Admin     Admin            VP/Dir/Boss   Admin
 * </pre>
 * </p>
 */
public class PayrollApprovalDto {

    // ═══════════════════════════════════════════════════════════
    // ① ACTION REQUEST — used for all state transitions
    // ═══════════════════════════════════════════════════════════
    @Data
    public static class ActionRequest {
        /** Optional note for audit trail (e.g. "Approved after HR review"). */
        @Size(max = 500, message = "note max 500 chars")
        private String note;
    }

    // ═══════════════════════════════════════════════════════════
    // ② PAYSLIP RESPONSE — full breakdown for one record
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayslipResponse {
        // Record
        private Long       id;
        private String     payPeriod;
        private LocalDate  periodStart;
        private LocalDate  periodEnd;

        // Staff
        private Long       userId;
        private String     userName;
        private String     userEmail;
        private String     userPhone;
        private String     roleDisplayName;
        private String     roleColor;
        private String     departmentName;

        // Branch / company
        private Long       branchId;
        private String     branchName;
        private String     countryName;

        // Calculation breakdown
        private BigDecimal baseSalary;
        private Integer    workingDays;
        private Integer    actualDays;
        private BigDecimal dailyRate;
        private BigDecimal earnedSalary;
        private BigDecimal otAmount;
        private BigDecimal deductions;
        private BigDecimal bonuses;
        private BigDecimal grossSalary;
        private BigDecimal taxAmount;
        private BigDecimal netSalary;
        private String     currency;

        // Status & audit trail
        private String         status;             // DRAFT/HR_REVIEWED/CONFIRMED/PAID
        private String         note;
        private LocalDateTime  calculatedAt;
        private String         calculatedByName;
        private LocalDateTime  confirmedAt;
        private String         confirmedByName;
        private LocalDateTime  paidAt;
    }

    // ═══════════════════════════════════════════════════════════
    // ③ HISTORY LIST ROW — for admin/boss history view
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryRow {
        private Long       id;
        private Long       userId;
        private String     userName;
        private String     roleDisplayName;
        private String     roleColor;
        private String     departmentName;
        private String     payPeriod;
        private LocalDate  periodStart;
        private LocalDate  periodEnd;
        private BigDecimal baseSalary;
        private BigDecimal otAmount;
        private BigDecimal deductions;
        private BigDecimal grossSalary;
        private BigDecimal taxAmount;
        private BigDecimal netSalary;
        private String     currency;
        private String     status;
        private LocalDateTime paidAt;
        private Long       branchId;
        private String     branchName;
    }

    // ═══════════════════════════════════════════════════════════
    // ④ HISTORY LIST RESPONSE — grouped by period
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryResponse {
        private List<String>    availablePeriods;  // DESC sorted list "2026-03", "2026-02", ...
        private String          selectedPeriod;
        private String          currency;
        // Summary for the selected period
        private Integer         totalRecords;
        private Integer         draftCount;
        private Integer         hrReviewedCount;
        private Integer         confirmedCount;
        private Integer         paidCount;
        private BigDecimal      totalGross;
        private BigDecimal      totalTax;
        private BigDecimal      totalNet;
        private List<HistoryRow> rows;
    }

    // ═══════════════════════════════════════════════════════════
    // ⑤ ACTION RESPONSE — returned after state transition
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionResponse {
        private Long    id;
        private String  previousStatus;
        private String  newStatus;
        private String  message;
        private LocalDateTime actedAt;
    }
}
