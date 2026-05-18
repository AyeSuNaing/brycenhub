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
 *   staff_cost  = Σ (salary_in_usd × durationMonths) per ACTIVE staff member
 *   profit_loss = project.budget(USD) - staff_cost(USD)
 *
 * Fixes (2026-05-18):
 *   ✅ FIX 1 — Currency convert: VND/MMK/KHR/JPY/KRW → USD ပြောင်း
 *   ✅ FIX 2 — Latest salary only: findCurrentByUserId() သုံး (duplicate မဖြစ်)
 *   ✅ FIX 3 — BOSS/VP/DR member cost မတွက် (project member မဟုတ်တာ skip)
 *              Staff roles only: PM, LEADER, UI_UX, DEVELOPER, QA
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/projects")
@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'VICE_PRESIDENT')")
public class ProjectProfitLossController {

    private static final int    SCALE = 2;
    private static final RoundingMode ROUND = RoundingMode.HALF_UP;

    // ── Staff roles ပဲ cost တွက်မယ် — BOSS/VP/DR မပါ ──────────────
    private static final Set<String> STAFF_ROLES = new HashSet<>(Arrays.asList(
        "PROJECT_MANAGER", "LEADER", "UI_UX", "DEVELOPER", "QA"
    ));

    // ── Exchange rates → USD (approximate, hardcoded) ──────────────
    // Update လိုရင် DB table ထားနိုင်သည်
    private static final Map<String, BigDecimal> TO_USD_RATE = new HashMap<>();
    static {
        TO_USD_RATE.put("USD", BigDecimal.ONE);
        TO_USD_RATE.put("JPY", new BigDecimal("155.00"));   // 155 JPY = 1 USD
        TO_USD_RATE.put("KHR", new BigDecimal("4100.00"));  // 4100 KHR = 1 USD
        TO_USD_RATE.put("MMK", new BigDecimal("2100.00"));  // 2100 MMK = 1 USD
        TO_USD_RATE.put("VND", new BigDecimal("25000.00")); // 25000 VND = 1 USD
        TO_USD_RATE.put("KRW", new BigDecimal("1380.00"));  // 1380 KRW = 1 USD
    }

    @Autowired private ProjectRepository            projectRepository;
    @Autowired private ProjectMemberRepository      projectMemberRepository;
    @Autowired private SalaryStructureRepository    salaryStructureRepository;
    @Autowired private UserRepository               userRepository;
    @Autowired private UserRoleRepository           userRoleRepository;
    @Autowired private BranchRepository             branchRepository;
    @Autowired private CountryRepository            countryRepository;
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

        // ── 1. project scope ─────────────────────────────────────────
        List<Project> projects = scopeProjects(caller, role, branchId);

        // ── 2. user → currency cache (userId → currency string) ──────
        //    "currency per user" = user.branch.country.currency
        Map<Long, String> userCurrencyCache = buildUserCurrencyCache();

        // ── 3. Project တစ်ခုချင်း P/L တွက် ───────────────────────────
        List<ProjectPLRow> rows = new ArrayList<>();
        BigDecimal totalBudget    = BigDecimal.ZERO;
        BigDecimal totalStaffCost = BigDecimal.ZERO;
        BigDecimal totalProfit    = BigDecimal.ZERO;
        BigDecimal totalLoss      = BigDecimal.ZERO;
        int profitCount = 0, lossCount = 0, noBudgetCount = 0;

        for (Project p : projects) {
            ProjectPLRow row = buildRow(p, userCurrencyCache);
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
                .comparingInt((ProjectPLRow r) ->
                    r.getBudget() == null || r.getBudget().compareTo(BigDecimal.ZERO) == 0 ? 1 : 0)
                .thenComparingInt(r -> r.isProfit() ? 1 : 0));

        // ── 5. Response ───────────────────────────────────────────────
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
        resp.setCurrency("USD");

        return ResponseEntity.ok(resp);
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════

    private String resolveRole(User caller) {
        if (caller.getRoleId() == null) return "VICE_PRESIDENT";
        return userRoleRepository.findById(caller.getRoleId())
                .map(UserRole::getName)
                .orElse("VICE_PRESIDENT");
    }

    private List<Project> scopeProjects(User caller, String role, Long branchIdFilter) {
        List<Project> all = projectRepository.findAll();

        if ("BOSS".equalsIgnoreCase(role)) {
            if (branchIdFilter != null) {
                return all.stream()
                        .filter(p -> branchIdFilter.equals(p.getBranchId()))
                        .collect(Collectors.toList());
            }
            return all;
        }

        if ("COUNTRY_DIRECTOR".equalsIgnoreCase(role)) {
            Set<Long> assignedCountryIds = directorCountryRepository
                    .findByDirectorId(caller.getId()).stream()
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

        // VICE_PRESIDENT — own branch only
        Long myBranch = caller.getBranchId();
        if (myBranch == null) return Collections.emptyList();
        return all.stream()
                .filter(p -> myBranch.equals(p.getBranchId()))
                .collect(Collectors.toList());
    }

    /**
     * ✅ FIX 1+2 — user တစ်ယောက်ချင်း currency ကို cache လုပ်
     * userId → currency (e.g. "USD", "VND", "MMK")
     * branch → country → currency join
     */
    private Map<Long, String> buildUserCurrencyCache() {
        Map<Long, String> cache = new HashMap<>();
        // Branch → Country → Currency lookup map ကြိုတင် build
        Map<Long, String> branchCurrencyMap = new HashMap<>();
        branchRepository.findAll().forEach(branch -> {
            if (branch.getCountryId() != null) {
                countryRepository.findById(branch.getCountryId()).ifPresent(country -> {
                    String cur = country.getCurrency();
                    branchCurrencyMap.put(branch.getId(), cur != null ? cur : "USD");
                });
            }
        });

        userRepository.findAll().forEach(user -> {
            String currency = "USD";
            if (user.getBranchId() != null) {
                currency = branchCurrencyMap.getOrDefault(user.getBranchId(), "USD");
            }
            cache.put(user.getId(), currency);
        });
        return cache;
    }

    /**
     * ✅ FIX — Local currency amount → USD convert
     * rate table ထဲမရှိရင် USD အနေနဲ့ ဆက်သုံး (safe fallback)
     */
    private BigDecimal toUsd(BigDecimal localAmount, String currency) {
        if (localAmount == null || localAmount.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        if (currency == null || "USD".equalsIgnoreCase(currency)) return localAmount;
        BigDecimal rate = TO_USD_RATE.get(currency.toUpperCase());
        if (rate == null || rate.compareTo(BigDecimal.ZERO) == 0) return localAmount; // fallback = USD
        return localAmount.divide(rate, SCALE, ROUND);
    }

    /** Project တစ်ခုအတွက် P/L row တည်ဆောက် */
    private ProjectPLRow buildRow(Project p, Map<Long, String> userCurrencyCache) {
        ProjectPLRow row = new ProjectPLRow();
        row.setProjectId(p.getId());
        row.setTitle(p.getTitle());
        row.setStatus(p.getStatus());
        row.setProgress(p.getProgress() != null ? p.getProgress() : 0);
        row.setStartDate(p.getStartDate());
        row.setEndDate(p.getEndDate());
        row.setBudget(p.getBudget() != null ? BigDecimal.valueOf(p.getBudget()) : null);

        // ── duration (months) ─────────────────────────────────────────
        int durationDays = calcDurationDays(p.getStartDate(), p.getEndDate());
        row.setDurationDays(durationDays);
        // months = durationDays / 30
        BigDecimal durationMonths = BigDecimal.valueOf(durationDays)
                .divide(BigDecimal.valueOf(30), 4, ROUND);

        // ── ACTIVE members — staff roles ONLY ────────────────────────
        //    ✅ FIX 3: BOSS/VP/DR skip — PM/LEADER/UI_UX/DEV/QA ပဲ တွက်
        List<ProjectMember> members = projectMemberRepository
                .findByProjectIdAndStatus(p.getId(), "ACTIVE")
                .stream()
                .filter(m -> m.getRoleInProject() != null
                          && STAFF_ROLES.contains(m.getRoleInProject().toUpperCase()))
                .collect(Collectors.toList());

        row.setStaffCount(members.size());

        // ── staff cost (USD) ──────────────────────────────────────────
        BigDecimal staffCostUsd = BigDecimal.ZERO;
        List<StaffCostDetail> details = new ArrayList<>();

        for (ProjectMember m : members) {
            // ✅ FIX 2: findCurrentByUserId() — latest record ONLY (no duplicate sum)
            Optional<SalaryStructure> salaryOpt =
                    salaryStructureRepository.findCurrentByUserId(m.getUserId());
            if (!salaryOpt.isPresent()) continue;

            BigDecimal localSalary = salaryOpt.get().getBaseSalary();
            if (localSalary == null || localSalary.compareTo(BigDecimal.ZERO) == 0) continue;

            // ✅ FIX 1: local currency → USD convert
            String currency = userCurrencyCache.getOrDefault(m.getUserId(), "USD");
            BigDecimal salaryUsd = toUsd(localSalary, currency);

            // cost = salaryUsd × durationMonths
            BigDecimal memberCostUsd = salaryUsd.multiply(durationMonths).setScale(SCALE, ROUND);
            staffCostUsd = staffCostUsd.add(memberCostUsd);

            // detail breakdown
            StaffCostDetail detail = new StaffCostDetail();
            userRepository.findById(m.getUserId()).ifPresent(u -> {
                detail.setUserId(u.getId());
                detail.setName(u.getName());
                detail.setInitial(u.getName() != null && !u.getName().isEmpty()
                        ? String.valueOf(u.getName().charAt(0)).toUpperCase() : "?");
            });
            detail.setRoleInProject(m.getRoleInProject());
            detail.setLocalCurrency(currency);
            detail.setLocalSalary(localSalary);
            detail.setSalaryUsd(salaryUsd);
            detail.setMonths(durationMonths);
            detail.setCostUsd(memberCostUsd);
            details.add(detail);
        }

        row.setStaffCost(staffCostUsd.setScale(SCALE, ROUND));
        row.setStaffDetails(details);

        // ── profit / loss ─────────────────────────────────────────────
        if (row.getBudget() != null && row.getBudget().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal pl = row.getBudget().subtract(staffCostUsd).setScale(SCALE, ROUND);
            row.setProfitLoss(pl);
            row.setProfit(pl.compareTo(BigDecimal.ZERO) >= 0);
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

    /** start~end ကြား calendar days */
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
        private BigDecimal netProfitLoss;
        private BigDecimal totalProfit;
        private BigDecimal totalLoss;
        private int profitCount;
        private int lossCount;
        private int noBudgetCount;
        private int totalProjects;
        private String currency; // always "USD"
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
        private BigDecimal budget;        // USD, null = မသတ်မှတ်ရသေး
        private BigDecimal staffCost;     // USD (currency-converted)
        private BigDecimal profitLoss;    // USD, null = budget မရှိ
        private BigDecimal profitPercent; // %, null = budget မရှိ
        private boolean   isProfit;
        private List<StaffCostDetail> staffDetails;
    }

    @Data
    public static class StaffCostDetail {
        private Long   userId;
        private String name;
        private String initial;
        private String roleInProject;
        // currency info
        private String     localCurrency; // e.g. "VND"
        private BigDecimal localSalary;   // original amount (e.g. 25,000,000 VND)
        private BigDecimal salaryUsd;     // converted USD (e.g. 1,000)
        private BigDecimal months;        // project duration in months
        private BigDecimal costUsd;       // salaryUsd × months
    }
}