package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class SalaryStructureDto {

    // ─────────────────────────────────────────────
    // CREATE request
    // ─────────────────────────────────────────────
    @Data
    public static class CreateRequest {
        @NotNull(message = "user_id is required")
        private Long userId;

        @NotNull(message = "base_salary is required")
        @DecimalMin(value = "0.00", message = "base_salary must be >= 0")
        private BigDecimal baseSalary;

        @NotNull(message = "effective_date is required")
        private LocalDate effectiveDate;

        private String note;
    }

    // ─────────────────────────────────────────────
    // Staff list row — each row = 1 user + their current salary (or null)
    // ─────────────────────────────────────────────
    @Data
    public static class StaffSalaryRow {
        private Long userId;
        private String name;
        private String roleName;
        private String roleDisplayName;
        private String roleColor;
        private String departmentName;
        private Long branchId;
        private String branchName;

        // Current salary (null if not set)
        private Long currentId;
        private BigDecimal currentSalary;
        private LocalDate currentEffectiveDate;
        private String currentNote;

        // Counts
        private Integer historyCount;

        // Currency (derived from branch→country)
        private String currency;
    }

    // ─────────────────────────────────────────────
    // History modal item
    // ─────────────────────────────────────────────
    @Data
    public static class HistoryItem {
        private Long id;
        private BigDecimal baseSalary;
        private LocalDate effectiveDate;
        private String note;
        private Long createdBy;
        private String createdByName;
        private LocalDateTime createdAt;
    }

    // ─────────────────────────────────────────────
    // Stats response
    // ─────────────────────────────────────────────
    @Data
    public static class StatsResponse {
        private long totalStaff;
        private long withSalary;
        private long withoutSalary;
        private BigDecimal avgSalary;
        private BigDecimal totalMonthly;
        private String currency;
    }
}
