package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    // ============================================================
    // POST /api/auth/login
    // Body: { "email": "admin@asn.com", "password": "123456" }
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
    // Header: Authorization: Bearer {token}
    // ============================================================
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal User user) {
        try {
            User currentUser = authService.getCurrentUser(user.getId());
            // password မပြရဘူး
            currentUser.setPassword(null);
            return ResponseEntity.ok(currentUser);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/auth/language
    // Header: Authorization: Bearer {token}
    // Body: { "language": "my" }
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
}
