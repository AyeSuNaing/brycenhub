package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * SuperAdminDashboardController
 * Route: /api/super-admin/**
 * Access: ADMIN role with branchId = NULL only
 *
 * Endpoints:
 *   GET /api/super-admin/stats           → Dashboard overview stats
 *   GET /api/super-admin/company-overview → All branches summary
 */
@RestController
@RequestMapping("/api/super-admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SuperAdminDashboardController {

    private final UserRepository          userRepository;
    private final BranchRepository        branchRepository;
    private final CountryRepository       countryRepository;
    private final PublicHolidayRepository publicHolidayRepository;
    private final AnnouncementRepository  announcementRepository;

    // ── Role IDs (from user_roles table) ──
    private static final Long ADMIN_ROLE_ID = 4L;

    // ── Permission check: ADMIN + branchId NULL = Super Admin ───
    private boolean isSuperAdmin(User user) {
        if (user == null) return false;
        return ADMIN_ROLE_ID.equals(user.getRoleId()) && user.getBranchId() == null;
    }

    // ── flagEmoji — null safe (Country.flagEmoji field ရှိပြီ) ─────
    private static String flagEmoji(jp.co.brycen.asn.model.Country c) {
        if (c == null) return "🌐";
        return c.getFlagEmoji() != null ? c.getFlagEmoji() : "🌐";
    }

    // ═══════════════════════════════════════════════════════════
    // ① GET /api/super-admin/stats
    //    Dashboard overview — 4 stat cards
    // ═══════════════════════════════════════════════════════════
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal User caller) {
        if (!isSuperAdmin(caller)) {
            return ResponseEntity.status(403)
                .body(new AuthDto.MessageResponse("Super Admin only", false));
        }

        // Total branches
        long totalBranches = branchRepository.count();

        // Total branch admins (ADMIN role + branchId NOT NULL + isActive)
        long totalBranchAdmins = userRepository.findAll().stream()
            .filter(u -> ADMIN_ROLE_ID.equals(u.getRoleId()))
            .filter(u -> u.getBranchId() != null)
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .count();

        // Total staff (all active users except CUSTOMER + Super Admin itself)
        long totalStaff = userRepository.findAll().stream()
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .filter(u -> u.getBranchId() != null) // has branch = real staff
            .count();

        // Active announcements
        long totalAnnouncements = announcementRepository.findAll().stream()
            .filter(a -> {
                if (a.getExpiresAt() == null) return true;
                return a.getExpiresAt().isAfter(java.time.LocalDateTime.now());
            })
            .count();

        StatsResponse res = new StatsResponse();
        res.setTotalBranches(totalBranches);
        res.setTotalBranchAdmins(totalBranchAdmins);
        res.setTotalStaff(totalStaff);
        res.setTotalAnnouncements(totalAnnouncements);

        return ResponseEntity.ok(res);
    }

    // ═══════════════════════════════════════════════════════════
    // ② GET /api/super-admin/company-overview
    //    All branches with stats (card layout)
    // ═══════════════════════════════════════════════════════════
    @GetMapping("/company-overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getCompanyOverview(@AuthenticationPrincipal User caller) {
        if (!isSuperAdmin(caller)) {
            return ResponseEntity.status(403)
                .body(new AuthDto.MessageResponse("Super Admin only", false));
        }

        // Cache countries
        Map<Long, jp.co.brycen.asn.model.Country> countryCache = new HashMap<>();
        countryRepository.findAll().forEach(c -> countryCache.put(c.getId(), c));

        // All users (for counting)
        List<User> allUsers = userRepository.findAll();

        // Branch admin cache: branchId → admin user
        Map<Long, User> branchAdminMap = allUsers.stream()
            .filter(u -> ADMIN_ROLE_ID.equals(u.getRoleId()))
            .filter(u -> u.getBranchId() != null)
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .collect(Collectors.toMap(
                User::getBranchId,
                u -> u,
                (a, b) -> a // keep first if multiple admins
            ));

        // Holiday count cache per country
        Map<Long, Long> holidayCountCache = new HashMap<>();
        publicHolidayRepository.findAll().forEach(h -> {
            if (h.getCountryId() != null) {
                holidayCountCache.merge(h.getCountryId(), 1L, Long::sum);
            }
        });

        List<BranchOverviewRow> result = branchRepository.findAll().stream()
            .map(b -> {
                BranchOverviewRow row = new BranchOverviewRow();
                row.setBranchId(b.getId());
                row.setBranchName(b.getName());
                row.setAddress(b.getAddress());

                // Country info
                if (b.getCountryId() != null) {
                    jp.co.brycen.asn.model.Country c = countryCache.get(b.getCountryId());
                    if (c != null) {
                        row.setCountryId(c.getId());
                        row.setCountryName(c.getName());
                        row.setCountryCode(c.getCode());
                        row.setCountryFlag(flagEmoji(c));
                        row.setHolidayCount(holidayCountCache.getOrDefault(c.getId(), 0L));
                    }
                }

                // Staff count (non-admin, active, in this branch)
                long staffCount = allUsers.stream()
                    .filter(u -> b.getId().equals(u.getBranchId()))
                    .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                    .count();
                row.setStaffCount(staffCount);

                // Admin count + name
                User admin = branchAdminMap.get(b.getId());
                row.setAdminCount(admin != null ? 1L : 0L);
                row.setAdminName(admin != null ? admin.getName() : null);
                row.setAdminEmail(admin != null ? admin.getEmail() : null);

                // Tax bracket count — use TaxBracketRepository if available
                // For now set 0; wire up when TaxBracketRepository is injected
                row.setTaxBracketCount(0L);

                row.setStatus("ACTIVE");
                return row;
            })
            .sorted(Comparator.comparing(BranchOverviewRow::getCountryName,
                Comparator.nullsLast(Comparator.naturalOrder())))
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── Response DTOs ────────────────────────────────────────────

    @Data
    public static class StatsResponse {
        private long totalBranches;
        private long totalBranchAdmins;
        private long totalStaff;
        private long totalAnnouncements;
    }

    @Data
    public static class BranchOverviewRow {
        private Long   branchId;
        private String branchName;
        private String address;
        private Long   countryId;
        private String countryName;
        private String countryCode;
        private String countryFlag;
        private long   staffCount;
        private long   adminCount;
        private String adminName;
        private String adminEmail;
        private long   holidayCount;
        private long   taxBracketCount;
        private String status;
    }
}