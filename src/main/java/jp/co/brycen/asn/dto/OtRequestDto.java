package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class OtRequestDto {

    // ── CREATE (Staff submit) ────────────────────────────────────
    @Data
    public static class CreateRequest {

        @NotNull(message = "Work date is required")
        private LocalDate workDate;

        @NotNull(message = "OT hours is required")
        private BigDecimal otHours;

        @NotNull(message = "Day type is required")
        private String dayType;
        // WEEKDAY / SATURDAY / SUNDAY / HOLIDAY

        private Long projectId;
        private String reason;
    }

    // ── REJECT body ──────────────────────────────────────────────
    @Data
    public static class RejectRequest {
        private String reason;
    }

    // ── RESPONSE (Admin dashboard) ───────────────────────────────
    @Data
    public static class Response {
        private Long       id;
        private Long       userId;
        private String     userName;
        private String     userInitial;
        private String     userColor;
        private LocalDate  workDate;
        private String     dayType;
        private BigDecimal otHours;
        private BigDecimal otRate;
        private BigDecimal otAmount;
        private Long       projectId;
        private String     projectName;
        private String     reason;
        private String     status;
        // PENDING / APPROVED / REJECTED
        private LocalDateTime createdAt;
    }
}
