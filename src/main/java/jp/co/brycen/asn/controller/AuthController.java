package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.AuthService;
import jp.co.brycen.asn.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserService userService;

    // ============================================================
    // POST /api/auth/login
    // ============================================================
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthDto.LoginRequest request) {
        try {
            AuthDto.LoginResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // GET /api/auth/me
    // ============================================================
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal User user) {
        try {
            User currentUser = authService.getCurrentUser(user.getId());
            currentUser.setPassword(null);
            return ResponseEntity.ok(currentUser);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/auth/language
    // ============================================================
    @PutMapping("/language")
    public ResponseEntity<?> updateLanguage(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody AuthDto.UpdateLanguageRequest request) {
        try {
            AuthDto.MessageResponse response =
                    authService.updateLanguage(user.getId(), request.getLanguage());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/auth/heartbeat
    // ✅ Update lastSeen → keeps user "Online" status active
    // Frontend calls every 60s while browser is open
    // ============================================================
    @PutMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        userService.updateLastSeen(user.getId());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}