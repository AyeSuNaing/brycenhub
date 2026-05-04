package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.model.Branch;
import jp.co.brycen.asn.model.Country;
import jp.co.brycen.asn.model.BranchExpense;
import jp.co.brycen.asn.repository.*;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/boss/dashboard")
@PreAuthorize("hasRole('BOSS')")
public class BossDashboardController {

    @Autowired private UserRepository          userRepository;
    @Autowired private UserRoleRepository      userRoleRepository;
    @Autowired private BranchRepository        branchRepository;
    @Autowired private CountryRepository       countryRepository;
    @Autowired private ProjectRepository       projectRepository;
    @Autowired private BranchExpenseRepository    branchExpenseRepository;
    @Autowired private jp.co.brycen.asn.repository.SalaryHistoryRepository salaryHistoryRepository;
    @Autowired private jp.co.brycen.asn.repository.TaskRepository          taskRepository;
    @Autowired private jp.co.brycen.asn.repository.ClientRepository        clientRepository;

    private static final Long CLIENT_ROLE_ID = 10L;

    private static final Map<String, String> FLAG_MAP;
    static {
        FLAG_MAP = new HashMap<>();
        FLAG_MAP.put("JP", "\uD83C\uDDEF\uD83C\uDDF5");
        FLAG_MAP.put("MM", "\uD83C\uDDF2\uD83C\uDDF2");
        FLAG_MAP.put("KH", "\uD83C\uDDF0\uD83C\uDDED");
        FLAG_MAP.put("VN", "\uD83C\uDDFB\uD83C\uDDF3");
        FLAG_MAP.put("KR", "\uD83C\uDDF0\uD83C\uDDF7");
        FLAG_MAP.put("US", "\uD83C\uDDFA\uD83C\uDDF8");
    }

    private String getFlagByCode(String code) {
        return code != null ? FLAG_MAP.getOrDefault(code.toUpperCase(), "\uD83C\uDF10") : "\uD83C\uDF10";
    }

    private String getInitial(String name) {
        return (name != null && !name.isEmpty())
            ? String.valueOf(name.charAt(0)).toUpperCase() : "?";
    }

    private String getAvatarColor(Long id) {
        String[] colors = {
            "#16a34a","#0284c7","#7c3aed","#db2777",
            "#ea580c","#0891b2","#d97706","#6366f1"
        };
        return colors[(int)(Math.abs(id == null ? 0 : id) % colors.length)];
    }

    private boolean isOnline(LocalDateTime lastSeen) {
        if (lastSeen == null) return false;
        return lastSeen.isAfter(LocalDateTime.now().minusMinutes(5));
    }

    // ① stats
    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats() {
        long totalStaff     = userRepository.countByIsActiveAndRoleIdNot(true, CLIENT_ROLE_ID);
        long totalBranches  = branchRepository.count();
        long activeProjects = projectRepository.findByStatus("ACTIVE").size();
        StatsResponse res = new StatsResponse();
        res.setTotalStaff(totalStaff);
        res.setTotalBranches(totalBranches);
        res.setActiveProjects(activeProjects);
        return ResponseEntity.ok(res);
    }

    // ② management-members
    @GetMapping("/management-members")
    public ResponseEntity<List<MemberRow>> getManagementMembers() {
        Set<String> mgmtRoles = new HashSet<>(Arrays.asList(
            "BOSS", "COUNTRY_DIRECTOR", "VICE_PRESIDENT", "ADMIN"
        ));
        Map<Long, UserRole> roleCache = new HashMap<>();
        userRoleRepository.findAll().forEach(r -> roleCache.put(r.getId(), r));
        Set<Long> mgmtRoleIds = roleCache.entrySet().stream()
            .filter(e -> mgmtRoles.contains(e.getValue().getName()))
            .map(Map.Entry::getKey).collect(Collectors.toSet());
        if (mgmtRoleIds.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        Map<String, Integer> roleOrder = new HashMap<>();
        roleOrder.put("BOSS", 1); roleOrder.put("COUNTRY_DIRECTOR", 2);
        roleOrder.put("VICE_PRESIDENT", 3); roleOrder.put("ADMIN", 4);

        List<MemberRow> result = userRepository.findAll().stream()
            .filter(u -> u.getRoleId() != null && mgmtRoleIds.contains(u.getRoleId()))
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .map(u -> {
                UserRole ur = roleCache.get(u.getRoleId());
                String branchName = "";
                if (u.getBranchId() != null) {
                    Optional<Branch> br = branchRepository.findById(u.getBranchId());
                    if (br.isPresent()) branchName = br.get().getName();
                }
                MemberRow row = new MemberRow();
                row.setUserId(u.getId());
                row.setName(u.getName());
                row.setEmail(u.getEmail());
                row.setRole(ur != null ? ur.getName() : "Staff");
                row.setRoleDisplay(ur != null ? ur.getDisplayName() : "Staff");
                row.setRoleColor(ur != null ? ur.getColor() : "#64748b");
                row.setBranchName(branchName);
                row.setInitial(getInitial(u.getName()));
                row.setAvatarColor(getAvatarColor(u.getId()));
                row.setOnline(isOnline(u.getLastSeen()));
                row.setManagement(true);
                return row;
            })
            .sorted(Comparator.comparingInt(r -> roleOrder.getOrDefault(r.getRole(), 99)))
            .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ③ branches-with-stats
    @GetMapping("/branches-with-stats")
    public ResponseEntity<List<BranchRow>> getBranchesWithStats() {
        Map<Long, Country> countryCache = new HashMap<>();
        countryRepository.findAll().forEach(c -> countryCache.put(c.getId(), c));

        List<BranchRow> result = branchRepository.findAll().stream().map(b -> {
            long staffCount = userRepository.countByBranchIdAndIsActiveAndRoleIdNot(
                b.getId(), true, CLIENT_ROLE_ID);
            long activeProjCount = projectRepository.findByBranchId(b.getId()).stream()
                .filter(p -> "ACTIVE".equals(p.getStatus())).count();
            Country country = b.getCountryId() != null ? countryCache.get(b.getCountryId()) : null;
            String countryName = country != null ? country.getName() : "";
            String countryCode = country != null ? country.getCode() : "";
            // Country model မှာ flagEmoji field မရှိ → FLAG_MAP သုံး
            String countryFlag = getFlagByCode(countryCode);
            BranchRow row = new BranchRow();
            row.setId(b.getId());
            row.setName(b.getName());
            row.setAddress(b.getAddress());
            row.setCountryId(b.getCountryId());
            row.setCountryName(countryName);
            row.setCountryCode(countryCode);
            row.setCountryFlag(countryFlag);
            row.setStaffCount(staffCount);
            row.setActiveProjects(activeProjCount);
            return row;
        }).sorted(Comparator.comparing(BranchRow::getName)).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ④ GET /api/boss/dashboard/finance-summary
    @GetMapping("/finance-summary")
    public ResponseEntity<Map<String, Object>> getFinanceSummary() {
        // Branch cache
        Map<Long, String> branchNameCache = new HashMap<>();
        branchRepository.findAll().forEach(b -> branchNameCache.put(b.getId(), b.getName()));

        // Payroll cost by branch — from salary_history (PAID + CONFIRMED)
        Map<Long, java.math.BigDecimal> branchPayroll = new HashMap<>();
        salaryHistoryRepository.findAll().stream()
            .filter(s -> "PAID".equals(s.getStatus()) || "CONFIRMED".equals(s.getStatus()))
            .filter(s -> s.getBranchId() != null && s.getGrossSalary() != null)
            .forEach(s -> branchPayroll.merge(
                s.getBranchId(),
                s.getGrossSalary(),
                java.math.BigDecimal::add
            ));

        // Build expenses list per branch
        List<Map<String, Object>> expenseList = branchPayroll.entrySet().stream()
            .map(entry -> {
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("branchId",   entry.getKey());
                row.put("branchName", branchNameCache.getOrDefault(entry.getKey(), "Unknown"));
                row.put("amount",     entry.getValue());
                row.put("currency",   "USD");
                row.put("expenseType","SALARY");
                row.put("status",     "PAID");
                return row;
            })
            .sorted((a, b) -> ((java.math.BigDecimal)b.get("amount"))
                .compareTo((java.math.BigDecimal)a.get("amount")))
            .collect(Collectors.toList());

        // Income = project budgets
        List<Map<String, Object>> incomeList = projectRepository.findAll().stream()
            .filter(p -> p.getBudget() != null && p.getBudget() > 0)
            .map(p -> {
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("id",          p.getId());
                row.put("description", p.getTitle());
                row.put("amount",      p.getBudget());
                row.put("currency",    "USD");
                row.put("status",      p.getStatus());
                return row;
            }).collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("expenses", expenseList);
        result.put("income",   incomeList);
        return ResponseEntity.ok(result);
    }

    // ================================================================
    // ⑦ GET /api/boss/dashboard/projects
    // All active projects enriched with PM + clientName
    // ================================================================
    @GetMapping("/projects")
    public ResponseEntity<List<Map<String, Object>>> getProjects() {
        Map<Long, User> userCache = new HashMap<>();
        Map<Long, jp.co.brycen.asn.model.Client> clientCache = new HashMap<>();
        clientRepository.findAll().forEach(c -> clientCache.put(c.getId(), c));

        List<Map<String, Object>> result = projectRepository.findAll().stream()
            .filter(p -> "ACTIVE".equals(p.getStatus())
                      || "PLANNING".equals(p.getStatus())
                      || "ON_HOLD".equals(p.getStatus()))
            .map(p -> {
                Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("id",        p.getId());
                m.put("title",     p.getTitle());
                m.put("status",    p.getStatus());
                m.put("progress",  p.getProgress() != null ? p.getProgress() : 0);
                m.put("startDate", p.getStartDate());
                m.put("endDate",   p.getEndDate());
                m.put("branchId",  p.getBranchId());
                m.put("budget",    p.getBudget());

                // PM
                if (p.getPmId() != null) {
                    User pm = userCache.computeIfAbsent(p.getPmId(),
                        id -> userRepository.findById(id).orElse(null));
                    if (pm != null) {
                        m.put("pmName",    pm.getName());
                        m.put("pmInitial", pm.getName().substring(0,1).toUpperCase());
                        m.put("pmColor",   getAvatarColor(pm.getId()));
                    }
                } else {
                    m.put("pmName", "Unassigned");
                }

                // Client
                if (p.getClientId() != null) {
                    jp.co.brycen.asn.model.Client client = clientCache.get(p.getClientId());
                    m.put("clientName", client != null ? client.getCompanyName() : null);
                } else {
                    m.put("clientName", null);
                }
                return m;
            }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ⑧ chart-data — company-wide 6-month task chart
    @GetMapping("/chart-data")
    public ResponseEntity<List<Map<String, Object>>> getChartData() {
        List<jp.co.brycen.asn.model.Task> allTasks = taskRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            java.time.LocalDate monthStart = java.time.LocalDate.now().minusMonths(i).withDayOfMonth(1);
            java.time.LocalDate monthEnd   = monthStart.plusMonths(1).minusDays(1);
            long done = 0, inProgress = 0, todo = 0;
            for (jp.co.brycen.asn.model.Task t : allTasks) {
                if (t.getCreatedAt() == null) continue;
                java.time.LocalDate d = t.getCreatedAt().toLocalDate();
                if (d.isBefore(monthStart) || d.isAfter(monthEnd)) continue;
                if ("DONE".equals(t.getStatus()))                                            done++;
                else if ("IN_PROGRESS".equals(t.getStatus()) || "IN_REVIEW".equals(t.getStatus())) inProgress++;
                else                                                                          todo++;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month",      monthStart.format(java.time.format.DateTimeFormatter.ofPattern("MMM")));
            row.put("done",       done);
            row.put("inProgress", inProgress);
            row.put("todo",       todo);
            result.add(row);
        }
        return ResponseEntity.ok(result);
    }

    // ⑥ GET /api/boss/dashboard/task-stats — company-wide task status counts
    @GetMapping("/task-stats")
    public ResponseEntity<Map<String, Object>> getTaskStats() {
        long todo = 0, inProgress = 0, inReview = 0, done = 0;
        for (jp.co.brycen.asn.model.Task t : taskRepository.findAll()) {
            if ("DONE".equals(t.getStatus()))              done++;
            else if ("IN_PROGRESS".equals(t.getStatus()))  inProgress++;
            else if ("IN_REVIEW".equals(t.getStatus()))    inReview++;
            else                                            todo++;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todo",       todo);
        result.put("inProgress", inProgress);
        result.put("inReview",   inReview);
        result.put("done",       done);
        result.put("total",      todo + inProgress + inReview + done);
        return ResponseEntity.ok(result);
    }

    // DTOs
    @Data public static class StatsResponse {
        private long totalStaff, totalBranches, activeProjects;
    }
    @Data public static class MemberRow {
        private Long userId; private String name, email, role, roleDisplay, roleColor, branchName, initial, avatarColor;
        private boolean online, management;
    }
    @Data public static class BranchRow {
        private Long id, countryId; private String name, address, countryName, countryCode, countryFlag;
        private long staffCount, activeProjects;
    }
}