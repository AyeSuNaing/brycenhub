package jp.co.brycen.asn.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

public class ProjectDesignDto {

    // ── Save Request (from Design Tool after generate) ──
    @Data
    public static class SaveRequest {
        private Long projectId;
        private String frameName;
        private Long generatedBy;
        private List<FileItem> files;
        private List<ApiEndpoint> apiEndpoints;
        private List<DbTable> dbTables;
    }

    @Data
    public static class FileItem {
        private String fileName;
        private String fileContent;
    }

    @Data
    public static class ApiEndpoint {
        private String method;
        private String url;
        private String description;
    }

    @Data
    public static class DbTable {
        private String tableName;
        private String columns; // JSON string
        private String description;
    }

    // ── Response ──
    @Data
    public static class GeneratedFileResponse {
        private Long id;
        private Long projectId;
        private String frameName;
        private LocalDateTime generatedAt;
        private List<FileItem> files;
        private List<ApiEndpoint> apiEndpoints;
        private List<DbTable> dbTables;
    }
}
