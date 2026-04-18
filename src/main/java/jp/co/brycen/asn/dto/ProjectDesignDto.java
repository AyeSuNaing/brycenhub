package jp.co.brycen.asn.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

public class ProjectDesignDto {

    @Data
    public static class SaveRequest {
        private Long projectId;
        private Long generatedBy;
        private String frameName;
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
        private String requestBody;
        private String responseBody;
        private String pathParams;
        private String queryParams;
        private String statusCodes;
    }

    @Data
    public static class DbTable {
        private String tableName;
        private String columns;
        private String description;
    }

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

    @Data
    public static class ExtractAndSaveRequest {
        private Long projectId;
        private Long generatedBy;
        private String frameName;
        private List<FileItem> generatedFiles;
    }
}
