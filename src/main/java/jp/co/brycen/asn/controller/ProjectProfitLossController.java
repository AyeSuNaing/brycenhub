package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Project Profit / Loss Controller
 *
 * GET /api/projects/profit-loss
 *   → BOSS    : project အားလုံး (branchId filter optional)
 *   → DR      : assigned countries ထဲက projects
 *   → VP      : own branch projects
 *
 * Formula:
 *   staff_cost  = Σ (member.baseSalary / 22) × projectDurationDays / 30 per ACTIVE member
 *   profit_loss = project.budget - staff_cost
 *
 * Created: 2026-05-17
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/projects")
@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'VICE_PRESIDENT')")
public class ProjectProfitLossController {

    // ─── Standard working days per month (Mon–Fri estimate) ───
    private static final int WORKING_DAYS_PER_MONTH = 22;
    private static final int SCALE = 2;
    private static final RoundingMode ROUND = RoundingMode.HALF_UP;

    @Autowired private ProjectRepository            projectRepository;
    @Autowired private ProjectMemberRepository      projectMemberRepository;
    @Autowired private SalaryStructureRepository    salaryStructureRepository;
    @Autowired private UserRepository               userRepository;
    @Autowired private UserRoleRepository           userRoleRepository;
    @Autowired private BranchRepository             branchRepository;
    @Autowired private DirectorCountryRepository    directorCountryRepository;

    // ════════════════════════════════════════════════════════════
    // GET /api/projects/profit-loss
    // Query params:
    //   branchId (optional) — filter by branch (BOSS only)
    // ════════════════════════════════════════════════════════════
    @GetMapping("/profit-loss")
    public ResponseEntity<ProfitLossResponse> getProfitLoss(
            @AuthenticationPrincipal User caller,
            @RequestParam(required = false) Long branchId) {

        String role = resolveRole(caller);

        // ── 1. ဘယ် projects ကြည့်ခွင့်ရသလဲ ──────────────────────────
        List<Project> projects = scopeProjects(caller, role, branchId);

        // ── 2. salary cache (userId → baseSalary) ─────────────────────
        Map<Long, BigDecimal> salaryCache = buildSalaryCache();

        // ── 3. Project တစ်ခုချင်း P/L တွက် ───────────────────────────
        List<ProjectPLRow> rows = new ArrayList<>();
        BigDecimal totalBudget     = BigDecimal.ZERO;
        BigDecimal totalStaffCost  = BigDecimal.ZERO;
        BigDecimal totalProfit     = BigDecimal.ZERO;
        BigDecimal totalLoss       = BigDecimal.ZERO;
        int profitCount = 0, lossCount = 0, noBudgetCount = 0;

        for (Project p : projects) {
            ProjectPLRow row = buildRow(p, salaryCache);
            rows.add(row);

            if (row.getBudget() == null || row.getBudget().compareTo(BigDecimal.ZERO) == 0) {
                noBudgetCount++;
            } else {
                totalBudget    = totalBudget.add(row.getBudget());
                totalStaffCost = totalStaffCost.add(row.getStaffCost());
                if (row.isProfit()) {
                    totalProfit = totalProfit.add(row.getProfitLoss());
                    profitCount++;
                } else {
                    totalLoss = totalLoss.add(row.getProfitLoss().abs());
                    lossCount++;
                }
            }
        }

        // ── 4. Sort: loss အရင်, ပြီးမှ profit, ပြီးမှ no-budget ───────
        rows.sort(Comparator
                .comparingInt((ProjectPLRow r) -> r.getBudget() == null || r.getBudget().compareTo(BigDecimal.ZERO) == 0 ? 1 : 0)
                .thenComparingInt(r -> r.isProfit() ? 1 : 0));

        // ── 5. Summary ────────────────────────────────────────────────
        ProfitLossResponse resp = new ProfitLossResponse();
        resp.setProjects(rows);
        resp.setTotalBudget(totalBudget);
        resp.setTotalStaffCost(totalStaffCost);
        resp.setNetProfitLoss(totalProfit.subtract(totalLoss));
        resp.setTotalProfit(totalProfit);
        resp.setTotalLoss(totalLoss);
        resp.setProfitCount(profitCount);
        resp.setLossCount(lossCount);
        resp.setNoBudgetCount(noBudgetCount);
        resp.setTotalProjects(rows.size());
        resp.setCurrency("USD"); // multi-branch → USD as common base

        return ResponseEntity.ok(resp);
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════

    /** Role string ကနေ normalize လုပ် */
    private String resolveRole(User caller) {
        if (caller.getRoleId() == null) return "VP";
        return userRoleRepository.findById(caller.getRoleId())
                .map(UserRole::getName)
                .orElse("VP");
    }

    /** Caller role ပေါ်မူတည်ပြီး project scope ဆုံးဖြတ် */
    private List<Project> scopeProjects(User caller, String role, Long branchIdFilter) {
        List<Project> all = projectRepository.findAll();

        // BOSS → company-wide, optional branchId filter
        if ("BOSS".equalsIgnoreCase(role)) {
            if (branchIdFilter != null) {
                return all.stream()
                        .filter(p -> branchIdFilter.equals(p.getBranchId()))
                        .collect(Collectors.toList());
            }
            return all;
        }

        // COUNTRY_DIRECTOR → assigned countries ထဲက branches
        if ("COUNTRY_DIRECTOR".equalsIgnoreCase(role)) {
            Set<Long> assignedCountryIds = directorCountryRepository
                    .findByDirectorId(caller.getId())
                    .stream()
                    .map(dc -> dc.getCountryId())
                    .collect(Collectors.toSet());

            Set<Long> allowedBranchIds = branchRepository.findAll().stream()
                    .filter(b -> assignedCountryIds.contains(b.getCountryId()))
                    .map(Branch::getId)
                    .collect(Collectors.toSet());

            return all.stream()
                    .filter(p -> p.getBranchId() != null && allowedBranchIds.contains(p.getBranchId()))
                    .collect(Collectors.toList());
        }

        // VICE_PRESIDENT → own branch only
        Long myBranch = caller.getBranchId();
        if (myBranch == null) return Collections.emptyList();
        return all.stream()
                .filter(p -> myBranch.equals(p.getBranchId()))
                .collect(Collectors.toList());
    }

    /** company-wide salary cache (userId → latest baseSalary) */
    private Map<Long, BigDecimal> buildSalaryCache() {
        List<SalaryStructure> all = salaryStructureRepository.findAllCurrent();
        Map<Long, BigDecimal> cache = new HashMap<>();
        for (SalaryStructure s : all) {
            cache.put(s.getUserId(), s.getBaseSalary());
        }
        return cache;
    }

    /** Project တစ်ခုအတွက် P/L row တည်ဆောက် */
    private ProjectPLRow buildRow(Project p, Map<Long, BigDecimal> salaryCache) {
        ProjectPLRow row = new ProjectPLRow();
        row.setProjectId(p.getId());
        row.setTitle(p.getTitle());
        row.setStatus(p.getStatus());
        row.setProgress(p.getProgress() != null ? p.getProgress() : 0);
        row.setStartDate(p.getStartDate());
        row.setEndDate(p.getEndDate());
        row.setBudget(p.getBudget() != null ? BigDecimal.valueOf(p.getBudget()) : null);

        // ── project duration (days) ─────────────────────────────────
        int durationDays = calcDurationDays(p.getStartDate(), p.getEndDate());
        row.setDurationDays(durationDays);

        // ── ACTIVE member list ──────────────────────────────────────
        List<ProjectMember> members = projectMemberRepository
                .findByProjectIdAndStatus(p.getId(), "ACTIVE");
        row.setStaffCount(members.size());

        // ── staff cost: Σ (baseSalary / 22) × (durationDays / 30) ──
        BigDecimal staffCost = BigDecimal.ZERO;
        List<StaffCostDetail> details = new ArrayList<>();

        for (ProjectMember m : members) {
            BigDecimal salary = salaryCache.get(m.getUserId());
            if (salary == null || salary.compareTo(BigDecimal.ZERO) == 0) continue;

            // daily rate = baseSalary / 22 working days
            BigDecimal dailyRate = salary.divide(
                    BigDecimal.valueOf(WORKING_DAYS_PER_MONTH), SCALE, ROUND);

            // months worked ≈ durationDays / 30
            BigDecimal months = BigDecimal.valueOf(durationDays)
                    .divide(BigDecimal.valueOf(30), SCALE, ROUND);

            // member cost = dailyRate × WORKING_DAYS_PER_MONTH × months
            BigDecimal memberCost = dailyRate
                    .multiply(BigDecimal.valueOf(WORKING_DAYS_PER_MONTH))
                    .multiply(months)
                    .setScale(SCALE, ROUND);

            staffCost = staffCost.add(memberCost);

            // detail breakdown
            StaffCostDetail detail = new StaffCostDetail();
            userRepository.findById(m.getUserId()).ifPresent(u -> {
                detail.setUserId(u.getId());
                detail.setName(u.getName());
                detail.setInitial(u.getName() != null && !u.getName().isEmpty()
                        ? String.valueOf(u.getName().charAt(0)).toUpperCase() : "?");
            });
            detail.setRoleInProject(m.getRoleInProject());
            detail.setBaseSalary(salary);
            detail.setDailyRate(dailyRate);
            detail.setMonths(months);
            detail.setCost(memberCost);
            details.add(detail);
        }

        row.setStaffCost(staffCost.setScale(SCALE, ROUND));
        row.setStaffDetails(details);

        // ── profit / loss ───────────────────────────────────────────
        if (row.getBudget() != null && row.getBudget().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal pl = row.getBudget().subtract(staffCost).setScale(SCALE, ROUND);
            row.setProfitLoss(pl);
            row.setProfit(pl.compareTo(BigDecimal.ZERO) >= 0);
            // profit % = (pl / budget) × 100
            BigDecimal pct = pl.divide(row.getBudget(), 4, ROUND)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(SCALE, ROUND);
            row.setProfitPercent(pct);
        } else {
            row.setProfitLoss(null);
            row.setProfit(false);
            row.setProfitPercent(null);
        }

        return row;
    }

    /** start~end ကြား working days estimate */
    private int calcDurationDays(LocalDate start, LocalDate end) {
        if (start == null) return 0;
        LocalDate effectiveEnd = (end != null) ? end : LocalDate.now();
        long days = ChronoUnit.DAYS.between(start, effectiveEnd);
        return (int) Math.max(0, days);
    }

    // ════════════════════════════════════════════════════════════
    // DTOs
    // ════════════════════════════════════════════════════════════

    @Data
    public static class ProfitLossResponse {
        private List<ProjectPLRow> projects;
        private BigDecimal totalBudget;
        private BigDecimal totalStaffCost;
        private BigDecimal netProfitLoss;   // totalProfit - totalLoss
        private BigDecimal totalProfit;
        private BigDecimal totalLoss;
        private int profitCount;
        private int lossCount;
        private int noBudgetCount;
        private int totalProjects;
        private String currency;
    }

    @Data
    public static class ProjectPLRow {
        private Long      projectId;
        private String    title;
        private String    status;
        private int       progress;
        private LocalDate startDate;
        private LocalDate endDate;
        private int       durationDays;
        private int       staffCount;
        private BigDecimal budget;       // null = မသတ်မှတ်ရသေး
        private BigDecimal staffCost;
        private BigDecimal profitLoss;   // null = budget မရှိ
        private BigDecimal profitPercent;// null = budget မရှိ
        private boolean   isProfit;
        private List<StaffCostDetail> staffDetails;
    }

    @Data
    public static class StaffCostDetail {
        private Long      userId;
        private String    name;
        private String    initial;
        private String    roleInProject;
        private BigDecimal baseSalary;
        private BigDecimal dailyRate;
        private BigDecimal months;
        private BigDecimal cost;
    }
}
