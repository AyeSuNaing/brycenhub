package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class UserDto {

    // CREATE user request
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

        private Long roleId;        // ← NEW: FK → user_roles.id
        private Long clientId;      // ← NEW: FK → clients.id (null = staff)

        private String preferredLanguage = "en";
        private String phone;
        private String profileImage;
    }

    // UPDATE user request
    @Data
    public static class UpdateUserRequest {
        private String name;
        private String phone;
        private String profileImage;
        private String preferredLanguage;
        private Long branchId;
        private String role;
        private Long roleId;        // ← NEW
        private Long clientId;      // ← NEW
    }

    // Change password request
    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "New password is required")
        private String newPassword;
    }
}
