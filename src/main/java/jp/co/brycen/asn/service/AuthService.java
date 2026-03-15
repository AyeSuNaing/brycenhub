package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import jp.co.brycen.asn.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final List<String> VALID_LANGUAGES =
            Arrays.asList("en", "ja", "my", "vi", "ko", "km");

    // Login
    public AuthDto.LoginResponse login(AuthDto.LoginRequest request) {

        // Email စစ်တယ်
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        // Active user စစ်တယ်
        if (!user.getIsActive()) {
            throw new RuntimeException("Account is deactivated. Please contact admin.");
        }

        // Password စစ်တယ်
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        // role_id → UserRole name ယူတယ်
        String roleName = "DEVELOPER"; // default
        if (user.getRoleId() != null) {
            roleName = userRoleRepository.findById(user.getRoleId())
                    .map(UserRole::getName)
                    .orElse("DEVELOPER");
        }

        // JWT Token generate လုပ်တယ်
        String token = jwtUtil.generateToken(user.getEmail(), roleName, user.getId());

        return new AuthDto.LoginResponse(
                token,
                user.getId(),
                user.getName(),
                user.getEmail(),
                roleName,
                user.getBranchId(),
                user.getPreferredLanguage(),
                user.getProfileImage()
        );
    }

    // Get current user info
    public User getCurrentUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Update preferred language
    public AuthDto.MessageResponse updateLanguage(Long userId, String language) {

        if (!VALID_LANGUAGES.contains(language)) {
            throw new RuntimeException("Invalid language. Supported: en, ja, my, vi, ko, km");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPreferredLanguage(language);
        userRepository.save(user);

        return new AuthDto.MessageResponse("Language updated to: " + language, true);
    }
}
