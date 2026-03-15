package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.CountryBranchDto;
import jp.co.brycen.asn.model.Branch;
import jp.co.brycen.asn.service.BranchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/branches")
public class BranchController {

    @Autowired
    private BranchService branchService;

    // ============================================================
    // GET /api/branches
    // ============================================================
    @GetMapping
    public ResponseEntity<List<Branch>> getAllBranches() {
        return ResponseEntity.ok(branchService.getAllBranches());
    }

    // ============================================================
    // GET /api/branches/by-country/{countryId}
    // ============================================================
    @GetMapping("/by-country/{countryId}")
    public ResponseEntity<List<Branch>> getBranchesByCountry(
            @PathVariable Long countryId) {
        return ResponseEntity.ok(branchService.getBranchesByCountry(countryId));
    }

    // ============================================================
    // GET /api/branches/{id}
    // ============================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getBranchById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(branchService.getBranchById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // POST /api/branches
    // BOSS + COUNTRY_DIRECTOR
    // ============================================================
    @PostMapping
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR')")
    public ResponseEntity<?> createBranch(
            @Valid @RequestBody CountryBranchDto.BranchRequest request) {
        try {
            return ResponseEntity.ok(branchService.createBranch(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/branches/{id}
    // BOSS + COUNTRY_DIRECTOR
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR')")
    public ResponseEntity<?> updateBranch(
            @PathVariable Long id,
            @Valid @RequestBody CountryBranchDto.BranchRequest request) {
        try {
            return ResponseEntity.ok(branchService.updateBranch(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DELETE /api/branches/{id}
    // BOSS only
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('BOSS')")
    public ResponseEntity<?> deleteBranch(@PathVariable Long id) {
        try {
            branchService.deleteBranch(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Branch deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
