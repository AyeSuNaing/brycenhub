package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class LeaveRequestDto {

    // ── CREATE (Staff submit) ────────────────────────────────────
    @Data
    public static class CreateRequest {

        @NotBlank(message = "Leave type is required")
        private String leaveType;
        // ANNUAL / SICK / UNPAID

        @NotNull(message = "Start date is required")
        private LocalDate startDate;

        @NotNull(message = "End date is required")
        private LocalDate endDate;

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
        private Long      id;
        private Long      userId;
        private String    userName;
        private String    userInitial;
        private String    userColor;
        private String    leaveType;
        // ANNUAL / SICK / UNPAID
        private LocalDate startDate;
        private LocalDate endDate;
        private Integer   totalDays;
        private String    reason;
        private String    status;
        // PENDING / APPROVED / REJECTED
        private LocalDateTime createdAt;
    }

    // ── TODAY LEAVE response ─────────────────────────────────────
    @Data
    public static class TodayLeaveResponse {
        private Long      userId;
        private String    userName;
        private String    userInitial;
        private String    userColor;
        private String    leaveType;
        private LocalDate endDate;
        private Boolean   isToday;
        // true = today | false = tomorrow (preview)
    }
}
