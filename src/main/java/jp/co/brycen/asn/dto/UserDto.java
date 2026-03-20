package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;

public class UserDto {

    // ── CREATE user request ──────────────────────────────────────
    @Data
    public static class CreateUserRequest {

        @NotBlank(message = "Name is required")
        private String name;

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;

        @NotBlank(message = "Password is required")
        private String password;

        @NotBlank(message = "Role is required")
        private String role;
        // BOSS, VICE_PRESIDENT, COUNTRY_DIRECTOR, ADMIN,
        // PROJECT_MANAGER, LEADER, UI_UX, DEVELOPER, QA, CLIENT

        @NotNull(message = "Branch ID is required")
        private Long branchId;

        private Long   roleId;              // FK → user_roles.id
        private Long   clientId;            // FK → clients.id (null = staff)
        private Long   departmentId;        // FK → departments.id
        private String preferredLanguage = "en";
        private String phone;
        private String profileImage;
    }

    // ── UPDATE user request ──────────────────────────────────────
    @Data
    public static class UpdateUserRequest {
        private String name;
        private String phone;
        private String profileImage;
        private String preferredLanguage;
        private Long   branchId;
        private String role;
        private Long   roleId;
        private Long   clientId;
        private Long   departmentId;        // FK → departments.id
    }

    // ── Change password request ──────────────────────────────────
    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "New password is required")
        private String newPassword;
    }

    // ── Staff List Response (with role name + department + skills) ─
    @Data
    public static class UserResponse {
        private Long          id;
        private String        name;
        private String        email;
        private Long          branchId;
        private Boolean       isActive;
        private String        preferredLanguage;
        private String        profileImage;
        private String        phone;
        private LocalDateTime lastSeen;

        // user_roles join
        private Long   roleId;
        private String roleName;            // DEVELOPER / LEADER...
        private String roleDisplayName;     // "Developer" / "Leader"...
        private String roleColor;           // #6366f1

        // departments join
        private Long   departmentId;
        private String departmentName;      // "Engineering" / "Admin"

        // member_profiles join
        private Boolean cvAnalyzed;         // true = CV uploaded & analyzed

        // member_skills join — top 3 EN standard
        private List<String> skills;        // ["iOS (Swift)", "Angular"]
    }
}