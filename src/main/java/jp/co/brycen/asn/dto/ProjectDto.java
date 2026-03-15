package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;

public class ProjectDto {

    @Data
    public static class CreateProjectRequest {

        @NotBlank(message = "Title is required")
        private String title;

        private String projectKey;      // e.g. KH-001
        private String description;
        private String category;        // Web, Mobile, Desktop, API, Internal
        private String tags;            // comma separated
        private String color;           // hex e.g. #0891b2
        private String priority;        // LOW, MEDIUM, HIGH, CRITICAL
        private String visibility;      // PRIVATE, BRANCH, GROUP

        @NotNull(message = "Branch ID is required")
        private Long branchId;

        private Long pmId;
        private Long clientId;          // FK → clients.id
        private LocalDate startDate;
        private LocalDate endDate;
        private Long budget;
    }

    @Data
    public static class UpdateProjectRequest {
        private String title;
        private String description;
        private String category;
        private String tags;
        private String color;
        private String status;          // PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED
        private String priority;        // LOW, MEDIUM, HIGH, CRITICAL
        private String healthStatus;    // ON_TRACK, AT_RISK, DELAYED
        private Integer healthScore;    // 1~5
        private String visibility;      // PRIVATE, BRANCH, GROUP
        private Long pmId;
        private Long clientId;
        private LocalDate startDate;
        private LocalDate endDate;
        private Long budget;
        private Integer progress;       // 0~100
    }

    @Data
    public static class AddMemberRequest {
        @NotNull(message = "User ID is required")
        private Long userId;

        @NotBlank(message = "Role is required")
        private String roleInProject;
        // PROJECT_MANAGER, LEADER, UI_UX, DEVELOPER, QA, CLIENT
    }
}
