package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.List;

public class TaxBracketDto {

    // ─────────────────────────────────────────────
    // CREATE / UPDATE request
    // ─────────────────────────────────────────────
    @Data
    public static class UpsertRequest {

        /** Optional — if omitted, resolved from admin's branch country */
        private Long countryId;

        @NotNull(message = "min_salary is required")
        @DecimalMin(value = "0.00", message = "min_salary must be >= 0")
        private BigDecimal minSalary;

        /** Optional — NULL means highest bracket (unlimited) */
        private BigDecimal maxSalary;

        @NotNull(message = "tax_rate is required")
        @DecimalMin(value = "0.00", message = "tax_rate must be >= 0")
        private BigDecimal taxRate;
    }

    // ─────────────────────────────────────────────
    // BULK seed request
    // ─────────────────────────────────────────────
    @Data
    public static class BulkRequest {
        /** Optional — if omitted, resolved from admin's branch country */
        private Long countryId;

        @NotNull(message = "brackets list is required")
        private List<BracketItem> brackets;
    }

    @Data
    public static class BracketItem {
        @NotNull private BigDecimal minSalary;
        private BigDecimal maxSalary;   // nullable
        @NotNull private BigDecimal taxRate;
    }

    // ─────────────────────────────────────────────
    // Tax CALCULATOR request/response
    // ─────────────────────────────────────────────
    @Data
    public static class CalcRequest {
        private Long countryId;

        @NotNull
        @DecimalMin(value = "0.00")
        private BigDecimal salary;
    }

    @Data
    public static class CalcResponse {
        private BigDecimal salary;
        private BigDecimal totalTax;
        private BigDecimal effectiveRate;   // totalTax/salary × 100
        private BigDecimal netSalary;
        private List<CalcBreakdown> breakdown;
    }

    @Data
    public static class CalcBreakdown {
        private BigDecimal from;
        private BigDecimal to;              // nullable for highest
        private BigDecimal rate;
        private BigDecimal taxableAmount;   // portion of salary in this bracket
        private BigDecimal taxForBracket;   // taxableAmount × rate
    }

    // ─────────────────────────────────────────────
    // BULK response
    // ─────────────────────────────────────────────
    @Data
    public static class BulkResponse {
        private int created;
        private int replaced;
        private String message;
    }
}
