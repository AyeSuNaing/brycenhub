package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;

public class TaskDto {

    @Data
    public static class CreateTaskRequest {
        @NotBlank(message = "Title is required")
        private String title;

        private String description;

        @NotNull(message = "Project ID is required")
        private Long projectId;

        private Long sprintId;
        private Long parentTaskId;
        private String priority = "MEDIUM";
        private String label;
        private Long assigneeId;       // ← assignee_id
        private LocalDate dueDate;
        private Double estimatedHours;
    }

    @Data
    public static class UpdateTaskRequest {
        private String title;
        private String description;
        private String status;
        private String priority;
        private String label;
        private Long assigneeId;       // ← assignee_id
        private Long sprintId;
        private LocalDate dueDate;
        private Double estimatedHours;
        private Double actualHours;
        private Integer position;      // ← position
    }

    @Data
    public static class UpdateStatusRequest {
        @NotBlank(message = "Status is required")
        private String status;
        private Integer position;      // ← position
    }
}
