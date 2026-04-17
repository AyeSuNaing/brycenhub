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
        private String projectKey;
        private String description;
        private String category;
        private String tags;
        private String color;
        private String priority;
        private String visibility;
        @NotNull(message = "Branch ID is required")
        private Long branchId;
        private Long pmId;
        private Long clientId;
        private LocalDate startDate;
        private LocalDate endDate;
        private Long budget;
        private String originalLanguage;
    }

    @Data
    public static class UpdateProjectRequest {
        private String title;
        private String description;
        private String category;
        private String tags;
        private String color;
        private String status;
        private String priority;
        private String healthStatus;
        private Integer healthScore;
        private String visibility;
        private Long pmId;
        private Long clientId;
        private LocalDate startDate;
        private LocalDate endDate;
        private Long budget;
        private Integer progress;
    }

    @Data
    public static class AddMemberRequest {
        @NotNull(message = "User ID is required")
        private Long userId;
        @NotBlank(message = "Role is required")
        private String roleInProject;
    }

    @Data
    public static class MemberResponse {
        private Long    id;
        private Long    userId;
        private String  userName;
        private String  initial;
        private String  roleInProject;
        private String  displayName;   // ← user_roles.display_name (DB မှ တိုက်ရိုက်)
        private String  status;
        private String  color;
        private long    tasks;
        private boolean online;
    }
}