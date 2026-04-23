package jp.co.brycen.asn.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for batch-level approval workflow.
 *
 * <p>A <b>batch</b> = all salary_history rows for the same (branchId, payPeriod).
 * Actions apply to the whole batch in one call — 400+ rows safe.</p>
 */
public class PayrollBatchDto {

    // ═══════════════════════════════════════════════════════════
    // ① BATCH ACTION REQUEST — shared by submit/approve/reject/pay
    // ═══════════════════════════════════════════════════════════
    @Data
    public static class BatchActionRequest {
        @NotNull(message = "branchId is required")
        private Long branchId;

        @NotBlank(message = "payPeriod is required")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "payPeriod must match YYYY-MM")
        private String payPeriod;

        /** Optional note for submit/approve. REQUIRED for reject. */
        @Size(max = 500, message = "note max 500 chars")
        private String note;
    }

    // ═══════════════════════════════════════════════════════════
    // ② BATCH ACTION RESPONSE
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchActionResponse {
        private Long       branchId;
        private String     branchName;
        private String     payPeriod;
        private String     previousStatus;   // Most common previous status
        private String     newStatus;
        private int        affectedRows;
        private int        skippedRows;
        private List<String> skippedReasons;
        private String     message;
        private LocalDateTime actedAt;
    }

    // ═══════════════════════════════════════════════════════════
    // ③ PENDING BATCH SUMMARY — VP/Boss inbox item
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingBatch {
        private Long       branchId;
        private String     branchName;
        private String     countryName;
        private String     payPeriod;
        private LocalDate  periodStart;
        private LocalDate  periodEnd;

        private int        staffCount;
        private BigDecimal totalGross;
        private BigDecimal totalTax;
        private BigDecimal totalNet;
        private String     currency;

        /** When admin submitted (earliest updated_at of pending rows). */
        private LocalDateTime submittedAt;

        /** Admin who submitted (from calculated_by of first row). */
        private String     submittedByName;

        /** Optional note from admin (reused note column). */
        private String     submitNote;
    }

    // ═══════════════════════════════════════════════════════════
    // ④ PENDING BATCHES RESPONSE
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingBatchesResponse {
        private int totalBatches;
        private int totalStaff;
        private List<PendingBatch> batches;
    }

    // ═══════════════════════════════════════════════════════════
    // ⑤ BATCH STATUS SUMMARY — History page header
    // ═══════════════════════════════════════════════════════════
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchStatusSummary {
        private Long   branchId;
        private String payPeriod;
        /** DRAFT | PENDING_APPROVAL | CONFIRMED | PAID | MIXED (fallback) */
        private String dominantStatus;

        private int draftCount;
        private int pendingCount;
        private int confirmedCount;
        private int paidCount;

        /** Reject reason if currently in DRAFT after rejection (null otherwise). */
        private String lastRejectReason;

        /** What actions are allowed from current state. */
        private boolean canSubmit;         // true if any DRAFT rows
        private boolean canApprove;        // true if any PENDING_APPROVAL rows
        private boolean canReject;         // same as canApprove
        private boolean canMarkPaid;       // true if any CONFIRMED rows
    }
}
