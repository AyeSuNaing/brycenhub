package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Department;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.DepartmentRepository;
import jp.co.brycen.asn.repository.UserRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    // ============================================================
    // GET /api/departments/by-branch/{branchId}
    // ============================================================
    @GetMapping("/by-branch/{branchId}")
    public ResponseEntity<List<Department>> getByBranch(
            @PathVariable Long branchId) {
        return ResponseEntity.ok(
            departmentRepository.findByBranchId(branchId));
    }

    // ============================================================
    // GET /api/departments/my-branch
    // ✅ staffCount ပါသော DeptResponse list ပြန်ပေး
    // ============================================================
    @GetMapping("/my-branch")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<List<DeptResponse>> getMyBranchDepts(
            @AuthenticationPrincipal User admin) {
        Long branchId = admin.getBranchId();
        List<Department> depts = branchId == null
            ? departmentRepository.findAll()
            : departmentRepository.findByBranchId(branchId);

        List<DeptResponse> result = depts.stream().map(d -> {
            DeptResponse r = new DeptResponse();
            r.setId(d.getId());
            r.setBranchId(d.getBranchId());
            r.setName(d.getName());
            r.setDescription(d.getDescription());
            r.setStaffCount(
                userRepository.countByDepartmentIdAndIsActive(d.getId(), true));
            return r;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // POST /api/departments
    // ============================================================
    @PostMapping
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> create(
            @Valid @RequestBody DeptRequest request,
            @AuthenticationPrincipal User admin) {
        try {
            if (departmentRepository.existsByBranchIdAndName(
                    request.getBranchId(), request.getName())) {
                throw new RuntimeException("Department already exists in this branch");
            }
            Department dept = new Department();
            dept.setBranchId(request.getBranchId());
            dept.setName(request.getName());
            dept.setDescription(request.getDescription());
            dept.setCreatedBy(admin.getId());
            return ResponseEntity.ok(departmentRepository.save(dept));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/departments/{id}
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody DeptRequest request) {
        try {
            Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Department not found"));
            if (request.getName() != null)
                dept.setName(request.getName());
            if (request.getDescription() != null)
                dept.setDescription(request.getDescription());
            return ResponseEntity.ok(departmentRepository.save(dept));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DELETE /api/departments/{id}
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            if (!departmentRepository.existsById(id)) {
                throw new RuntimeException("Department not found");
            }
            departmentRepository.deleteById(id);
            return ResponseEntity.ok(
                new AuthDto.MessageResponse("Department deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ── Response DTO ──────────────────────────────────────────────
    @Data
    public static class DeptResponse {
        private Long   id;
        private Long   branchId;
        private String name;
        private String description;
        private long   staffCount;
    }

    // ── Request DTO ───────────────────────────────────────────────
    @Data
    public static class DeptRequest {
        @NotNull(message = "Branch ID is required")
        private Long   branchId;

        @NotBlank(message = "Name is required")
        private String name;

        private String description;
    }
}