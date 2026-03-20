package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.UserDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    // ============================================================
    // GET /api/users
    // BOSS + COUNTRY_DIRECTOR + ADMIN
    // ============================================================
    @GetMapping
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // ============================================================
    // GET /api/users/by-branch/{branchId}
    // ============================================================
    @GetMapping("/by-branch/{branchId}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<List<User>> getUsersByBranch(
            @PathVariable Long branchId) {
        return ResponseEntity.ok(userService.getUsersByBranch(branchId));
    }

    // ============================================================
    // GET /api/users/staff-list
    // Dashboard staff list — with role name + skills
    // ============================================================
    @GetMapping("/staff-list")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<List<UserDto.UserResponse>> getStaffList(
            @AuthenticationPrincipal User admin) {

        System.out.println(">>> admin id: " + admin.getId());
        System.out.println(">>> admin branchId: " + admin.getBranchId());
        
        
        return ResponseEntity.ok(
            userService.getUsersByBranchAsResponse(admin.getBranchId())
        );
    }

    // ============================================================
    // GET /api/users/{id}
    // ============================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(userService.getUserById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // POST /api/users
    // BOSS + COUNTRY_DIRECTOR + ADMIN
    // ============================================================
    @PostMapping
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> createUser(
            @Valid @RequestBody UserDto.CreateUserRequest request) {
        try {
            User user = userService.createUser(request);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/users/{id}
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody UserDto.UpdateUserRequest request) {
        try {
            return ResponseEntity.ok(userService.updateUser(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/users/{id}/activate
    // ============================================================
    @PutMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> activateUser(@PathVariable Long id) {
        try {
            userService.activateUser(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("User activated", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/users/{id}/deactivate
    // ============================================================
    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> deactivateUser(@PathVariable Long id) {
        try {
            userService.deactivateUser(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("User deactivated", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/users/{id}/change-password
    // BOSS + ADMIN only
    // ============================================================
    @PutMapping("/{id}/change-password")
    @PreAuthorize("hasAnyRole('BOSS', 'ADMIN')")
    public ResponseEntity<?> changePassword(
            @PathVariable Long id,
            @Valid @RequestBody UserDto.ChangePasswordRequest request) {
        try {
            userService.changePassword(id, request.getNewPassword());
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Password changed", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DELETE /api/users/{id}
    // BOSS only
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('BOSS')")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            userService.deleteUser(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("User deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}