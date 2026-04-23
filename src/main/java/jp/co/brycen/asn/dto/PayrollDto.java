package jp.co.brycen.asn.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for Payroll Wizard (Preview → Save flow).
 *
 * <p>Phase 1: Simple — net = gross − tax (no deductions/bonuses UI yet).
 * Phase 2+ will add editable adjustments.</p>
 */
public class PayrollDto {

    // ═══════════════════════════════════════════════════════════
    // ① PREVIEW REQUEST
    // POST /api/payroll/preview
    // ═══════════════════════════════════════════════════════════
    @Data
    public static class PreviewRequest {

        @NotNull(message = "branchId is required")
        private Long branchId;

        /** Format "YYYY-MM" — e.g. "2026-03" */
        @NotBlank(message = "payPeriod is required")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "payPeriod must match YYYY-MM")
        private String payPeriod;
    }

    // ═══════════════════════════════════════════════════════════
    // ② PREVIEW RESPONSE — one row per staff
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreviewRow {
        // Identity
        private Long    userId;
        private String  userName;
        private String  email;
        private String  roleDisplayName;
        private String  roleColor;
        private String  departmentName;

        // Period
        private String     payPeriod;
        private LocalDate  periodStart;
        private LocalDate  periodEnd;

        // Inputs
        private BigDecimal baseSalary;
        private Integer    workingDays;
        private Integer    actualDays;

        // Calculated
        private BigDecimal dailyRate;
        private BigDecimal earnedSalary;
        private BigDecimal otAmount;
        private BigDecimal deductions;     // Phase 1 = 0
        private BigDecimal bonuses;        // Phase 1 = 0
        private BigDecimal grossSalary;
        private BigDecimal taxAmount;
        private BigDecimal netSalary;

        // Currency + flags
        private String     currency;

        /** NONE | MISSING_SALARY | NO_ATTENDANCE | ALREADY_SAVED */
        private String     warning;

        private String     warningMessage;

        /** true if a salary_history record already exists (upsert target) */
        private boolean    existsInDb;

        /** Current salary_history status if existsInDb (DRAFT/HR_REVIEWED/CONFIRMED/PAID) */
        private String     currentStatus;
    }

    // ═══════════════════════════════════════════════════════════
    // ③ PREVIEW RESPONSE — full payload
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PreviewResponse {
        private String     payPeriod;
        private LocalDate  periodStart;
        private LocalDate  periodEnd;
        private Long       branchId;
        private String     branchName;
        private String     currency;

        // Summary
        private Integer    totalStaff;
        private Integer    calculableStaff;   // workingDays > 0 AND baseSalary > 0
        private Integer    warningStaff;
        private BigDecimal totalGross;
        private BigDecimal totalTax;
        private BigDecimal totalNet;

        private List<PreviewRow> rows;
    }

    // ═══════════════════════════════════════════════════════════
    // ④ SAVE REQUEST — admin confirms rows
    // POST /api/payroll/save
    // ═══════════════════════════════════════════════════════════
    @Data
    public static class SaveRequest {

        @NotNull(message = "branchId is required")
        private Long branchId;

        @NotBlank(message = "payPeriod is required")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "payPeriod must match YYYY-MM")
        private String payPeriod;

        /** If null → save ALL calculable rows; if provided → save only these user IDs. */
        private List<Long> userIds;

        /** DRAFT | HR_REVIEWED — initial status when saving (default DRAFT). */
        private String initialStatus;
    }

    // ═══════════════════════════════════════════════════════════
    // ⑤ SAVE RESPONSE
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveResponse {
        private int savedCount;
        private int updatedCount;
        private int skippedCount;
        private List<String> skippedReasons;
        private LocalDateTime savedAt;
    }
}
