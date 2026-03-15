package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

// ===== LOGIN REQUEST =====
// POST /api/auth/login မှာ receive လုပ်တဲ့ data
public class AuthDto {

    @Data
    public static class LoginRequest {
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        private String email;

        @NotBlank(message = "Password is required")
        private String password;
    }

    // ===== LOGIN RESPONSE =====
    // Login အောင်မြင်ရင် ပြန်ပေးတဲ့ data
    @Data
    public static class LoginResponse {
        private String token;
        private Long   userId;
        private String name;
        private String email;
        private String role;
        private Long   branchId;
        private String preferredLanguage;
        private String profileImage;

        public LoginResponse(String token, Long userId, String name,
                             String email, String role, Long branchId,
                             String preferredLanguage, String profileImage) {
            this.token             = token;
            this.userId            = userId;
            this.name              = name;
            this.email             = email;
            this.role              = role;
            this.branchId          = branchId;
            this.preferredLanguage = preferredLanguage;
            this.profileImage      = profileImage;
        }
    }

    // ===== UPDATE LANGUAGE REQUEST =====
    // PUT /api/auth/language မှာ receive လုပ်တဲ့ data
    @Data
    public static class UpdateLanguageRequest {
        @NotBlank(message = "Language is required")
        private String language;
        // en, ja, my, vi, ko, km
    }

    // ===== COMMON RESPONSE =====
    @Data
    public static class MessageResponse {
        private String message;
        private boolean success;

        public MessageResponse(String message, boolean success) {
            this.message = message;
            this.success = success;
        }
    }
}
