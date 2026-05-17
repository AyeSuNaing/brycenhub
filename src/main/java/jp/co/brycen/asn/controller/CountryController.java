package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.CountryBranchDto;
import jp.co.brycen.asn.model.Country;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.CountryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/countries")
public class CountryController {

    @Autowired
    private CountryService countryService;

    // ── Super Admin: ADMIN role (roleId=4) + branchId = NULL ─────
    // role String မရှိ — roleId Long ကိုပဲ သုံးရမည်
    private static final Long ADMIN_ROLE_ID = 4L;

    private boolean isSuperAdmin(User user) {
        if (user == null) return false;
        return ADMIN_ROLE_ID.equals(user.getRoleId())
            && user.getBranchId() == null;
    }

    // Branch Admin check (ADMIN + branchId != null → block)
    private boolean isBranchAdmin(User user) {
        if (user == null) return false;
        return ADMIN_ROLE_ID.equals(user.getRoleId())
            && user.getBranchId() != null;
    }

    // ============================================================
    // GET /api/countries — All authenticated users
    // ============================================================
    @GetMapping
    public ResponseEntity<List<Country>> getAllCountries() {
        return ResponseEntity.ok(countryService.getAllCountries());
    }

    // ============================================================
    // GET /api/countries/{id}
    // ============================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getCountryById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(countryService.getCountryById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // POST /api/countries — BOSS or Super Admin only
    // Branch Admin (ADMIN + branchId != null) → 403
    // ============================================================
    @PostMapping
    @PreAuthorize("hasAnyRole('BOSS', 'ADMIN')")
    public ResponseEntity<?> createCountry(
            @Valid @RequestBody CountryBranchDto.CountryRequest request,
            @AuthenticationPrincipal User caller) {

        if (isBranchAdmin(caller)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse("Super Admin access required", false));
        }

        try {
            return ResponseEntity.ok(countryService.createCountry(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/countries/{id} — BOSS or Super Admin only
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'ADMIN')")
    public ResponseEntity<?> updateCountry(
            @PathVariable Long id,
            @Valid @RequestBody CountryBranchDto.CountryRequest request,
            @AuthenticationPrincipal User caller) {

        if (isBranchAdmin(caller)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse("Super Admin access required", false));
        }

        try {
            return ResponseEntity.ok(countryService.updateCountry(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DELETE /api/countries/{id} — BOSS or Super Admin only
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'ADMIN')")
    public ResponseEntity<?> deleteCountry(
            @PathVariable Long id,
            @AuthenticationPrincipal User caller) {

        if (isBranchAdmin(caller)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse("Super Admin access required", false));
        }

        try {
            countryService.deleteCountry(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Country deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}