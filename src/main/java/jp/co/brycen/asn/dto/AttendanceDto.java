package jp.co.brycen.asn.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class AttendanceDto {

    // ── Single parsed row from Excel ──────────────
    @Data
    public static class ParsedRow {
        private int rowNumber;          // Excel row (1-based, for admin to locate)
        private String email;
        private String name;            // from Excel (informational)
        private LocalDate workDate;
        private LocalTime timeIn;
        private LocalTime timeOut;

        // Match result
        private Long userId;            // null if no match
        private String matchedName;     // from DB
        private String matchedRole;
        private String matchedBranch;
        private String status;          // MATCHED / UNMATCHED / DUPLICATE / INVALID
        private String message;         // error/warning detail
    }

    // ── Upload response (preview) ─────────────────
    @Data
    public static class PreviewResponse {
        private int totalRows;
        private int matchedCount;
        private int unmatchedCount;
        private int duplicateCount;
        private int invalidCount;
        private List<ParsedRow> rows;
    }

    // ── Confirm save request ──────────────────────
    @Data
    public static class ConfirmSaveRequest {
        private List<SaveRow> rows;
    }

    @Data
    public static class SaveRow {
        private Long userId;
        private LocalDate workDate;
        private LocalTime timeIn;
        private LocalTime timeOut;
        private Boolean isDayoff;
        private String note;
    }

    // ── Save response ─────────────────────────────
    @Data
    public static class SaveResponse {
        private int savedCount;
        private int skippedCount;
        private int updatedCount;
        private String message;
    }
}
