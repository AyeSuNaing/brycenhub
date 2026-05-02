package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.SalaryStructureDto;
import jp.co.brycen.asn.model.SalaryStructure;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.CountryRepository;
import jp.co.brycen.asn.repository.DepartmentRepository;
import jp.co.brycen.asn.repository.SalaryStructureRepository;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/salary-structures")
public class SalaryStructureController {

    @Autowired private SalaryStructureRepository salaryRepo;
    @Autowired private UserRepository            userRepo;
    @Autowired private UserRoleRepository        roleRepo;
    @Autowired private DepartmentRepository      deptRepo;
    @Autowired private BranchRepository          branchRepo;
    @Autowired private CountryRepository         countryRepo;

    // ═══════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════
    private String roleNameOf(User u) {
        if (u == null || u.getRoleId() == null) return "";
        return roleRepo.findById(u.getRoleId()).map(r -> r.getName()).orElse("");
    }

    private boolean isGlobalAdmin(User u) {
        String r = roleNameOf(u);
        return "BOSS".equals(r) || "COUNTRY_DIRECTOR".equals(r);
    }

    private String resolveCurrency(Long branchId) {
        if (branchId == null) return "USD";
        return branchRepo.findById(branchId)
                .map(b -> countryRepo.findById(b.getCountryId())
                        .map(c -> c.getCurrency() != null ? c.getCurrency() : "USD")
                        .orElse("USD"))
                .orElse("USD");
    }

    private boolean canManageUser(User admin, User target) {
        if (admin == null || target == null) return false;
        if (isGlobalAdmin(admin)) return true;
        return admin.getBranchId() != null
            && admin.getBranchId().equals(target.getBranchId());
    }

    // ═══════════════════════════════════════════════════
    // STAFF LIST (main table)
    // GET /api/salary-structures/staff-list
    // ═══════════════════════════════════════════════════
    @GetMapping("/staff-list")
    @PreAuthorize("hasAnyRole('ADMIN', 'VP', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getStaffList(@AuthenticationPrincipal User admin) {

        boolean global = isGlobalAdmin(admin);
        Long adminBranchId = admin.getBranchId();
        Long clientRoleId = 10L;

        List<User> users;
        if (global) {
            users = userRepo.findAll();
        } else if (adminBranchId != null) {
            users = userRepo.findStaffByBranchIdAndRoleIdNot(adminBranchId, clientRoleId);
        } else {
            users = new ArrayList<>();
        }

        users = users.stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> u.getRoleId() == null || !u.getRoleId().equals(clientRoleId))
                .collect(java.util.stream.Collectors.toList());

        List<SalaryStructure> allCurrent = global
                ? salaryRepo.findAllCurrent()
                : (adminBranchId != null
                    ? salaryRepo.findAllCurrentByBranch(adminBranchId)
                    : new ArrayList<>());

        Map<Long, SalaryStructure> currentByUser = new HashMap<>();
        for (SalaryStructure s : allCurrent) currentByUser.put(s.getUserId(), s);

        List<SalaryStructureDto.StaffSalaryRow> rows = new ArrayList<>();
        for (User u : users) {
            SalaryStructureDto.StaffSalaryRow r = new SalaryStructureDto.StaffSalaryRow();
            r.setUserId(u.getId());
            r.setName(u.getName());
            r.setBranchId(u.getBranchId());

            if (u.getRoleId() != null) {
                roleRepo.findById(u.getRoleId()).ifPresent(role -> {
                    r.setRoleName(role.getName());
                    r.setRoleDisplayName(role.getDisplayName());
                    r.setRoleColor(role.getColor());
                });
            }
            if (u.getDepartmentId() != null) {
                deptRepo.findById(u.getDepartmentId()).ifPresent(d -> r.setDepartmentName(d.getName()));
            }
            if (u.getBranchId() != null) {
                branchRepo.findById(u.getBranchId()).ifPresent(b -> {
                    r.setBranchName(b.getName());
                    if (b.getCountryId() != null) {
                        countryRepo.findById(b.getCountryId()).ifPresent(c -> {
                            r.setCurrency(c.getCurrency() != null ? c.getCurrency() : "USD");
                        });
                    }
                });
            }
            if (r.getCurrency() == null) r.setCurrency("USD");

            SalaryStructure cur = currentByUser.get(u.getId());
            if (cur != null) {
                r.setCurrentId(cur.getId());
                r.setCurrentSalary(cur.getBaseSalary());
                r.setCurrentEffectiveDate(cur.getEffectiveDate());
                r.setCurrentNote(cur.getNote());
            }

            int hist = salaryRepo.findHistoryByUserId(u.getId()).size();
            r.setHistoryCount(hist);
            rows.add(r);
        }

        rows.sort((a, b) -> {
            String nameA = a.getName() != null ? a.getName() : "";
            String nameB = b.getName() != null ? b.getName() : "";
            return nameA.compareToIgnoreCase(nameB);
        });

        return ResponseEntity.ok(rows);
    }

    // ═══════════════════════════════════════════════════
    // STATS
    // GET /api/salary-structures/stats
    // ═══════════════════════════════════════════════════
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'VP', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal User admin) {

        boolean global = isGlobalAdmin(admin);
        Long branchId  = admin.getBranchId();
        Long clientRoleId = 10L;

        long totalStaff;
        if (global) {
            totalStaff = userRepo.countByIsActiveAndRoleIdNot(true, clientRoleId);
        } else if (branchId != null) {
            totalStaff = userRepo.countByBranchIdAndIsActiveAndRoleIdNot(branchId, true, clientRoleId);
        } else {
            totalStaff = 0;
        }

        List<SalaryStructure> currents = global
                ? salaryRepo.findAllCurrent()
                : (branchId != null ? salaryRepo.findAllCurrentByBranch(branchId) : new ArrayList<>());

        BigDecimal total = BigDecimal.ZERO;
        for (SalaryStructure s : currents) { total = total.add(s.getBaseSalary()); }
        BigDecimal avg = currents.isEmpty()
                ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(currents.size()), 2, RoundingMode.HALF_UP);

        SalaryStructureDto.StatsResponse res = new SalaryStructureDto.StatsResponse();
        res.setTotalStaff(totalStaff);
        res.setWithSalary(currents.size());
        res.setWithoutSalary(Math.max(0, totalStaff - currents.size()));
        res.setAvgSalary(avg);
        res.setTotalMonthly(total);
        res.setCurrency(resolveCurrency(branchId));

        return ResponseEntity.ok(res);
    }

    // ═══════════════════════════════════════════════════
    // HISTORY for one user
    // GET /api/salary-structures/history/{userId}
    // ✅ FIX: isAuthenticated() — own user ကိုယ်တိုင် ကြည့်လို့ရ
    // ═══════════════════════════════════════════════════
    @GetMapping("/history/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getHistory(
            @PathVariable Long userId,
            @AuthenticationPrincipal User admin) {

        User target = userRepo.findById(userId).orElse(null);
        if (target == null) {
            return ResponseEntity.status(404)
                    .body(new AuthDto.MessageResponse("User not found", false));
        }

        // ✅ Own user → always allow (member မိမိ salary ကြည့်ခွင့်)
        if (admin.getId().equals(userId)) {
            // fall through — no permission check needed
        } else if (!isGlobalAdmin(admin) && !canManageUser(admin, target)) {
            // Still allow VIEW within same branch
            if (admin.getBranchId() == null || !admin.getBranchId().equals(target.getBranchId())) {
                return ResponseEntity.status(403)
                        .body(new AuthDto.MessageResponse("Access denied", false));
            }
        }

        List<SalaryStructure> list = salaryRepo.findHistoryByUserId(userId);

        Map<Long, String> nameCache = new HashMap<>();
        List<SalaryStructureDto.HistoryItem> items = list.stream().map(s -> {
            SalaryStructureDto.HistoryItem it = new SalaryStructureDto.HistoryItem();
            it.setId(s.getId());
            it.setBaseSalary(s.getBaseSalary());
            it.setEffectiveDate(s.getEffectiveDate());
            it.setNote(s.getNote());
            it.setCreatedBy(s.getCreatedBy());
            it.setCreatedAt(s.getCreatedAt());

            if (s.getCreatedBy() != null) {
                String cached = nameCache.get(s.getCreatedBy());
                if (cached == null) {
                    cached = userRepo.findById(s.getCreatedBy())
                            .map(User::getName).orElse("Unknown");
                    nameCache.put(s.getCreatedBy(), cached);
                }
                it.setCreatedByName(cached);
            }
            return it;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(items);
    }

    // ═══════════════════════════════════════════════════
    // CREATE (append-only — new salary record)
    // POST /api/salary-structures
    // ═══════════════════════════════════════════════════
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> create(
            @Valid @RequestBody SalaryStructureDto.CreateRequest req,
            @AuthenticationPrincipal User admin) {

        User target = userRepo.findById(req.getUserId()).orElse(null);
        if (target == null) {
            return ResponseEntity.status(404)
                    .body(new AuthDto.MessageResponse("User not found", false));
        }
        if (!canManageUser(admin, target)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse("Access denied — not in your branch", false));
        }

        SalaryStructure s = new SalaryStructure();
        s.setUserId(req.getUserId());
        s.setBaseSalary(req.getBaseSalary());
        s.setEffectiveDate(req.getEffectiveDate());
        s.setNote(req.getNote());
        s.setCreatedBy(admin.getId());

        return ResponseEntity.ok(salaryRepo.save(s));
    }

    // ═══════════════════════════════════════════════════
    // DELETE one history record
    // DELETE /api/salary-structures/{id}
    // ═══════════════════════════════════════════════════
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User admin) {

        SalaryStructure s = salaryRepo.findById(id).orElse(null);
        if (s == null) {
            return ResponseEntity.status(404)
                    .body(new AuthDto.MessageResponse("Not found", false));
        }
        User target = userRepo.findById(s.getUserId()).orElse(null);
        if (!canManageUser(admin, target)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse("Access denied", false));
        }
        salaryRepo.delete(s);
        return ResponseEntity.ok(new AuthDto.MessageResponse("Deleted", true));
    }
}