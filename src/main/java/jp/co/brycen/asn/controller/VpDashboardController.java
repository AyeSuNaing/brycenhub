package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import java.util.function.BiFunction;

@RestController
@RequestMapping("/api/vp/dashboard")
@PreAuthorize("hasAnyRole('VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
public class VpDashboardController {

    @Autowired private UserRepository          userRepository;
    @Autowired private UserRoleRepository      userRoleRepository;
    @Autowired private BranchRepository        branchRepository;
    @Autowired private OtRequestRepository     otRequestRepository;
    @Autowired private LeaveRequestRepository  leaveRequestRepository;
    @Autowired private BranchExpenseRepository branchExpenseRepository;
    @Autowired private ProjectRepository       projectRepository;
    @Autowired private TaskRepository          taskRepository;
    @Autowired private SalaryHistoryRepository salaryHistoryRepository;
    @Autowired private DepartmentRepository    departmentRepository;
    @Autowired private DirectorCountryRepository directorCountryRepository;

    // ── Helpers ──────────────────────────────────────────────────
    private String getInitial(String name) {
        return (name != null && !name.isEmpty())
                ? String.valueOf(name.charAt(0)).toUpperCase() : "?";
    }
 // ── DR helpers ──
    private String getRoleName(User user) {
        if (user.getRoleId() == null) return "";
        return userRoleRepository.findById(user.getRoleId())
                .map(UserRole::getName).orElse("");
    }

    private List<Long> getDrBranchIds(User dr) {
        List<Long> branchIds = new ArrayList<>();
        directorCountryRepository.findByDirectorId(dr.getId()).forEach(dc ->
            branchRepository.findByCountryId(dc.getCountryId())
                .forEach(b -> branchIds.add(b.getId()))
        );
        return branchIds;
    }

    private List<Long> getScopedUserIds(User caller) {
        if ("COUNTRY_DIRECTOR".equals(getRoleName(caller))) {
            List<Long> userIds = new ArrayList<>();
            for (Long bid : getDrBranchIds(caller)) {
                userRepository.findByBranchId(bid).stream().map(User::getId).forEach(userIds::add);
            }
            return userIds;
        }
        Long branchId = caller.getBranchId();
        if (branchId == null) return Collections.emptyList();
        return userRepository.findByBranchId(branchId).stream().map(User::getId).collect(Collectors.toList());
    }
    
    private List<Long> getScopedBranchIds(User caller) {
        String role = getRoleName(caller);
        if ("BOSS".equals(role)) {
            return branchRepository.findAll().stream()
                .map(Branch::getId)
                .collect(Collectors.toList());
        }
        if ("COUNTRY_DIRECTOR".equals(role)) {
            return getDrBranchIds(caller);
        }
        Long branchId = caller.getBranchId();
        return branchId != null
            ? Collections.singletonList(branchId)
            : Collections.emptyList();
    }
    
    private String getAvatarColor(Long id) {
        String[] colors = { "#16a34a", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#0891b2" };
        return colors[(int) (Math.abs(id == null ? 0 : id) % colors.length)];
    }
    private boolean sameBranch(User vp, Long targetUserId) {
        User target = userRepository.findById(targetUserId).orElse(null);
        if (target == null) return false;
        if ("COUNTRY_DIRECTOR".equals(getRoleName(vp))) {
            return getDrBranchIds(vp).contains(target.getBranchId());
        }
        return vp.getBranchId() != null && vp.getBranchId().equals(target.getBranchId());
    }
    private boolean sameExpenseBranch(User vp, BranchExpense exp) {
        return vp.getBranchId() != null && vp.getBranchId().equals(exp.getBranchId());
    }

    // ✅ Role sort order — Management ကို အပေါ်ဆုံး
    private int getRoleOrder(String rawRole) {
        if (rawRole == null) return 99;
        switch (rawRole.toUpperCase()) {
            case "BOSS":             return 1;
            case "COUNTRY_DIRECTOR": return 2;
            case "VICE_PRESIDENT":   return 3;
            case "ADMIN":            return 4;
            case "PROJECT_MANAGER":  return 5;
            case "LEADER":           return 6;
            case "UI_UX":            return 7;
            case "DEVELOPER":        return 8;
            case "QA":               return 9;
            default:                 return 99;
        }
    }

    // ── Shared helper: group SalaryHistory list → SalaryPeriodSummary list ──
    private List<SalaryPeriodSummary> groupToPeriodSummary(
            List<SalaryHistory> rows, Long branchId) {

        Map<String, List<SalaryHistory>> grouped = rows.stream()
        		.collect(Collectors.groupingBy(s ->
        	    s.getPayPeriod() + "|" + (s.getBranchId() != null ? s.getBranchId() : 0)));

        return grouped.entrySet().stream().map(entry -> {
            String period   = entry.getKey();
            List<SalaryHistory> periodRows = entry.getValue();
            String currency = periodRows.get(0).getCurrency() != null
                ? periodRows.get(0).getCurrency() : "USD";
            String status   = periodRows.get(0).getStatus() != null
                ? periodRows.get(0).getStatus() : "UNKNOWN";

            BigDecimal totalGross = periodRows.stream()
                .map(s -> s.getGrossSalary() != null ? s.getGrossSalary() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalTax = periodRows.stream()
                .map(s -> s.getTaxAmount() != null ? s.getTaxAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalNet = periodRows.stream()
                .map(s -> s.getNetSalary() != null ? s.getNetSalary() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            SalaryPeriodSummary s = new SalaryPeriodSummary();
            s.setBranchId(branchId);
            s.setPayPeriod(period);
            s.setCurrency(currency);
            s.setStatus(status);
            s.setStaffCount(periodRows.size());
            s.setTotalGross(totalGross);
            s.setTotalTax(totalTax);
            s.setTotalNet(totalNet);
            return s;
        })
        .sorted(Comparator.comparing(SalaryPeriodSummary::getPayPeriod).reversed())
        .collect(Collectors.toList());
    }

    // ============================================================
    // ① STATS
    // ============================================================
    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        int year  = LocalDate.now().getYear();
        int month = LocalDate.now().getMonthValue();
        LocalDate today = LocalDate.now();

        if (branchId == null) return ResponseEntity.ok(new StatsResponse());

        StatsResponse r = new StatsResponse();
        r.setTotalStaff(userRepository.countByBranchIdAndIsActiveAndRoleIdNot(branchId, true, 10L));
        r.setPendingLeave(leaveRequestRepository.countByBranchIdAndStatus(branchId, "PENDING"));
        r.setPendingOT(otRequestRepository.countByBranchIdAndStatus(branchId, "PENDING"));

        long pendingSalaryPeriods = salaryHistoryRepository.findAll().stream()
            .filter(s -> branchId.equals(s.getBranchId()))
            .filter(s -> "PENDING_APPROVAL".equals(s.getStatus()))
            .map(SalaryHistory::getPayPeriod)
            .filter(Objects::nonNull)
            .distinct()
            .count();
        r.setPendingSalary(pendingSalaryPeriods);
        r.setTotalPending(r.getPendingLeave() + r.getPendingOT() + r.getPendingSalary() + r.getPendingExpense());

        BigDecimal otHours = otRequestRepository.sumApprovedOtHoursByBranch(branchId, year, month);
        r.setMonthlyOTHours(otHours != null ? otHours : BigDecimal.ZERO);
        r.setOnLeaveToday(leaveRequestRepository.findTodayLeaveByBranch(branchId, today).size());
        r.setActiveProjects(projectRepository.findByBranchId(branchId).stream()
                .filter(p -> "ACTIVE".equals(p.getStatus())).count());

        BigDecimal spend = branchExpenseRepository.sumApprovedByBranchAndMonth(branchId, year, month);
        r.setMonthlySpend(spend != null ? spend : BigDecimal.ZERO);
        BigDecimal salarySpend = branchExpenseRepository.sumApprovedByBranchTypeMonth(branchId, "SALARY", year, month);
        r.setMonthlySalarySpend(salarySpend != null ? salarySpend : BigDecimal.ZERO);
        BigDecimal expenseSpend = branchExpenseRepository.sumApprovedByBranchTypeMonth(branchId, "EXPENSE", year, month);
        r.setMonthlyExpenseSpend(expenseSpend != null ? expenseSpend : BigDecimal.ZERO);
        r.setCurrentMonth(LocalDate.now().getMonth().name());

        return ResponseEntity.ok(r);
    }

    // ============================================================
    // ② LEAVE REQUESTS
    // ============================================================
    @GetMapping("/leave-requests")
    public ResponseEntity<List<LeaveRow>> getLeaveRequests(
            @AuthenticationPrincipal User vp,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        List<Long> branchUserIds = getScopedUserIds(vp);
        if (branchUserIds.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        LocalDate fromDate = (from != null && !from.isEmpty()) ? LocalDate.parse(from) : null;
        LocalDate toDate   = (to   != null && !to.isEmpty())   ? LocalDate.parse(to)   : null;
        boolean allStatus  = (status == null || status.isEmpty() || "ALL".equals(status));

        List<LeaveRequest> list;
        if (fromDate != null && toDate != null) {
            if (allStatus) {
                list = leaveRequestRepository.findByUserIdInAndStartDateBetweenOrderByCreatedAtDesc(
                    branchUserIds, fromDate, toDate);
            } else {
                list = leaveRequestRepository.findByUserIdInAndStatusAndStartDateBetweenOrderByCreatedAtDesc(
                    branchUserIds, status, fromDate, toDate);
            }
        } else {
            if (allStatus) {
                list = leaveRequestRepository.findByUserIdInOrderByCreatedAtDesc(branchUserIds);
            } else {
                list = leaveRequestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(branchUserIds, status);
            }
        }

        Map<Long, User>     uCache = new HashMap<>();
        Map<Long, UserRole> rCache = new HashMap<>();

        List<LeaveRow> result = list.stream().map(lv -> {
            User u = uCache.computeIfAbsent(lv.getUserId(),
                    id -> userRepository.findById(id).orElse(null));
            String roleName = "Staff";
            if (u != null && u.getRoleId() != null) {
                UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                        id -> userRoleRepository.findById(id).orElse(null));
                if (ur != null) roleName = ur.getDisplayName();
            }
            LeaveRow row = new LeaveRow();
            row.setId(lv.getId());
            row.setUserId(lv.getUserId());
            row.setUserName(u != null ? u.getName() : "Unknown");
            row.setUserInitial(u != null ? getInitial(u.getName()) : "?");
            row.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
            row.setUserRole(roleName);
            row.setLeaveType(lv.getLeaveType());
            row.setStartDate(lv.getStartDate());
            row.setEndDate(lv.getEndDate());
            row.setTotalDays(lv.getTotalDays());
            row.setReason(lv.getReason());
            row.setStatus(lv.getStatus());
            row.setCreatedAt(lv.getCreatedAt());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ③ OT REQUESTS
    // ============================================================
    @GetMapping("/ot-requests")
    public ResponseEntity<List<OtRow>> getOtRequests(
            @AuthenticationPrincipal User vp,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

    	List<Long> branchUserIds = getScopedUserIds(vp);
        if (branchUserIds.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        LocalDate fromDate = (from != null && !from.isEmpty()) ? LocalDate.parse(from) : null;
        LocalDate toDate   = (to   != null && !to.isEmpty())   ? LocalDate.parse(to)   : null;
        boolean allStatus  = (status == null || status.isEmpty() || "ALL".equals(status));

        List<OtRequest> list;
        if (fromDate != null && toDate != null) {
            if (allStatus) {
                list = otRequestRepository.findByUserIdInAndWorkDateBetweenOrderByWorkDateDesc(
                    branchUserIds, fromDate, toDate);
            } else {
                list = otRequestRepository.findByUserIdInAndStatusAndWorkDateBetweenOrderByWorkDateDesc(
                    branchUserIds, status, fromDate, toDate);
            }
        } else {
            if (allStatus) {
                list = otRequestRepository.findByUserIdInOrderByCreatedAtDesc(branchUserIds);
            } else {
                list = otRequestRepository.findByUserIdInAndStatusOrderByCreatedAtDesc(branchUserIds, status);
            }
        }

        Map<Long, User>     uCache = new HashMap<>();
        Map<Long, Project>  pCache = new HashMap<>();
        Map<Long, UserRole> rCache = new HashMap<>();

        List<OtRow> result = list.stream().map(ot -> {
            User u = uCache.computeIfAbsent(ot.getUserId(),
                    id -> userRepository.findById(id).orElse(null));
            Project p = ot.getProjectId() != null
                    ? pCache.computeIfAbsent(ot.getProjectId(),
                            id -> projectRepository.findById(id).orElse(null))
                    : null;
            String roleName = "Staff";
            if (u != null && u.getRoleId() != null) {
                UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                        id -> userRoleRepository.findById(id).orElse(null));
                if (ur != null) roleName = ur.getDisplayName();
            }
            OtRow row = new OtRow();
            row.setId(ot.getId());
            row.setUserId(ot.getUserId());
            row.setUserName(u != null ? u.getName() : "Unknown");
            row.setUserInitial(u != null ? getInitial(u.getName()) : "?");
            row.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
            row.setUserRole(roleName);
            row.setWorkDate(ot.getWorkDate());
            row.setDayType(ot.getDayType());
            row.setOtHours(ot.getOtHours());
            row.setOtRate(ot.getOtRate());
            row.setProjectId(ot.getProjectId());
            row.setProjectName(p != null ? p.getTitle() : null);
            row.setReason(ot.getReason());
            row.setStatus(ot.getStatus());
            row.setCreatedAt(ot.getCreatedAt());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ④ BRANCH EXPENSES
    // ============================================================
    @GetMapping("/branch-expenses")
    public ResponseEntity<List<ExpenseRow>> getBranchExpenses(
            @AuthenticationPrincipal User vp,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type) {

        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        List<BranchExpense> list;
        boolean allStatus = (status == null || status.isEmpty() || "ALL".equals(status));

        if (allStatus && type != null && !type.isEmpty()) {
            list = branchExpenseRepository.findByBranchIdAndExpenseTypeOrderByCreatedAtDesc(branchId, type);
        } else if (allStatus) {
            list = branchExpenseRepository.findByBranchIdOrderByCreatedAtDesc(branchId);
        } else if (type != null && !type.isEmpty()) {
            list = branchExpenseRepository.findByBranchIdAndStatusAndExpenseTypeOrderByCreatedAtDesc(branchId, status, type);
        } else {
            list = branchExpenseRepository.findByBranchIdAndStatusOrderByCreatedAtDesc(branchId, status);
        }

        Map<Long, User> uCache = new HashMap<>();
        List<ExpenseRow> result = list.stream().map(e -> {
            User creator = e.getCreatedBy() != null
                    ? uCache.computeIfAbsent(e.getCreatedBy(), id -> userRepository.findById(id).orElse(null))
                    : null;
            ExpenseRow row = new ExpenseRow();
            row.setId(e.getId());
            row.setBranchId(e.getBranchId());
            row.setCategoryId(e.getCategoryId());
            row.setAmount(e.getAmount());
            row.setCurrency(e.getCurrency());
            row.setDescription(e.getDescription());
            row.setExpenseType(e.getExpenseType());
            row.setReceiptUrl(e.getReceiptUrl());
            row.setDate(e.getDate());
            row.setStatus(e.getStatus());
            row.setCreatedBy(e.getCreatedBy());
            row.setCreatedByName(creator != null ? creator.getName() : null);
            row.setCreatedAt(e.getCreatedAt());
            return row;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ⑤ APPROVE / REJECT — LEAVE
    // ============================================================
    @PatchMapping("/leave-requests/{id}/approve")
    public ResponseEntity<?> approveLeave(@PathVariable Long id, @AuthenticationPrincipal User vp) {
        try {
            LeaveRequest lv = leaveRequestRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Leave request not found"));
            if (!sameBranch(vp, lv.getUserId()))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            lv.setStatus("APPROVED");
            lv.setApprovedBy(vp.getId());
            lv.setApprovedAt(LocalDateTime.now());
            leaveRequestRepository.save(lv);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Leave approved", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    @PatchMapping("/leave-requests/{id}/reject")
    public ResponseEntity<?> rejectLeave(@PathVariable Long id,
                                         @RequestBody(required = false) RejectBody body,
                                         @AuthenticationPrincipal User vp) {
        try {
            LeaveRequest lv = leaveRequestRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Leave request not found"));
            if (!sameBranch(vp, lv.getUserId()))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            lv.setStatus("REJECTED");
            lv.setApprovedBy(vp.getId());
            lv.setApprovedAt(LocalDateTime.now());
            lv.setRejectReason(body != null ? body.getReason() : null);
            leaveRequestRepository.save(lv);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Leave rejected", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑥ APPROVE / REJECT — OT
    // ============================================================
    @PatchMapping("/ot-requests/{id}/approve")
    public ResponseEntity<?> approveOt(@PathVariable Long id, @AuthenticationPrincipal User vp) {
        try {
            OtRequest ot = otRequestRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("OT request not found"));
            if (!sameBranch(vp, ot.getUserId()))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            ot.setStatus("APPROVED");
            ot.setApprovedBy(vp.getId());
            ot.setApprovedAt(LocalDateTime.now());
            otRequestRepository.save(ot);
            return ResponseEntity.ok(new AuthDto.MessageResponse("OT approved", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    @PatchMapping("/ot-requests/{id}/reject")
    public ResponseEntity<?> rejectOt(@PathVariable Long id,
                                      @RequestBody(required = false) RejectBody body,
                                      @AuthenticationPrincipal User vp) {
        try {
            OtRequest ot = otRequestRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("OT request not found"));
            if (!sameBranch(vp, ot.getUserId()))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            ot.setStatus("REJECTED");
            ot.setApprovedBy(vp.getId());
            ot.setApprovedAt(LocalDateTime.now());
            ot.setRejectReason(body != null ? body.getReason() : null);
            otRequestRepository.save(ot);
            return ResponseEntity.ok(new AuthDto.MessageResponse("OT rejected", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑦ APPROVE / REJECT — EXPENSE
    // ============================================================
    @PatchMapping("/branch-expenses/{id}/approve")
    public ResponseEntity<?> approveExpense(@PathVariable Long id, @AuthenticationPrincipal User vp) {
        try {
            BranchExpense exp = branchExpenseRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Expense not found"));
            if (!sameExpenseBranch(vp, exp))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            exp.setStatus("APPROVED");
            exp.setApprovedBy(vp.getId());
            exp.setApprovedAt(LocalDateTime.now());
            branchExpenseRepository.save(exp);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Expense approved", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    @PatchMapping("/branch-expenses/{id}/reject")
    public ResponseEntity<?> rejectExpense(@PathVariable Long id,
                                            @RequestBody(required = false) RejectBody body,
                                            @AuthenticationPrincipal User vp) {
        try {
            BranchExpense exp = branchExpenseRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Expense not found"));
            if (!sameExpenseBranch(vp, exp))
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
            exp.setStatus("REJECTED");
            exp.setApprovedBy(vp.getId());
            exp.setApprovedAt(LocalDateTime.now());
            exp.setRejectReason(body != null ? body.getReason() : null);
            branchExpenseRepository.save(exp);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Expense rejected", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑧ SALARY APPROVALS
    // ============================================================
    @GetMapping("/salary-approvals")
    public ResponseEntity<List<SalaryPeriodSummary>> getSalaryApprovals(
            @AuthenticationPrincipal User vp) {
    	List<Long> branchIds = getScopedBranchIds(vp);
        if (branchIds.isEmpty()) return ResponseEntity.ok(Collections.emptyList());
        List<SalaryHistory> pending = salaryHistoryRepository.findAll().stream()
            .filter(s -> branchIds.contains(s.getBranchId()))
            .filter(s -> "PENDING_APPROVAL".equals(s.getStatus()))
            .collect(Collectors.toList());
        if (pending.isEmpty()) return ResponseEntity.ok(Collections.emptyList());
        return ResponseEntity.ok(groupToPeriodSummary(pending, branchIds.get(0)));
    }

    // ============================================================
    // ⑨ SALARY HISTORY
    // ============================================================
    @GetMapping("/salary-history")
    public ResponseEntity<List<SalaryPeriodSummary>> getSalaryHistory(
            @AuthenticationPrincipal User vp) {
    	List<Long> branchIds = getScopedBranchIds(vp);
        if (branchIds.isEmpty()) return ResponseEntity.ok(Collections.emptyList());
        List<SalaryHistory> all = salaryHistoryRepository.findAll().stream()
            .filter(s -> branchIds.contains(s.getBranchId()))
//            .filter(s -> "PENDING_APPROVAL".equals(s.getStatus())) 
            .collect(Collectors.toList());
        if (all.isEmpty()) return ResponseEntity.ok(Collections.emptyList());
        return ResponseEntity.ok(groupToPeriodSummary(all, branchIds.get(0)));
    }

    // ============================================================
    // ⑩ BRANCH PROJECTS
    // ============================================================
    @GetMapping("/branch-projects")
    public ResponseEntity<List<ProjectRow>> getBranchProjects(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());
        Map<Long, User> uCache = new HashMap<>();
        List<ProjectRow> result = projectRepository.findByBranchId(branchId).stream()
            .filter(p -> "ACTIVE".equals(p.getStatus()) || "PLANNING".equals(p.getStatus()))
            .map(p -> {
                User pm = p.getPmId() != null
                        ? uCache.computeIfAbsent(p.getPmId(), id -> userRepository.findById(id).orElse(null))
                        : null;
                ProjectRow row = new ProjectRow();
                row.setId(p.getId());
                row.setTitle(p.getTitle());
                row.setStatus(p.getStatus());
                row.setProgress(p.getProgress() != null ? p.getProgress() : 0);
                row.setStartDate(p.getStartDate());
                row.setEndDate(p.getEndDate());
                row.setPmId(p.getPmId());
                row.setPmName(pm != null ? pm.getName() : "Unassigned");
                row.setPmInitial(pm != null ? getInitial(pm.getName()) : "?");
                row.setPmColor(pm != null ? getAvatarColor(pm.getId()) : "#64748b");
                row.setColor(p.getColor());
                return row;
            }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ⑪ BRANCH MEMBERS
    // ✅ Management (BOSS/CD/VP) — company-wide (all branches)
    // ✅ Team — same branch only
    // ============================================================
    @GetMapping("/branch-members")
    public ResponseEntity<List<MemberRow>> getBranchMembers(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        Set<String> mgmtRoleNames = new HashSet<>(Arrays.asList("BOSS", "COUNTRY_DIRECTOR", "VICE_PRESIDENT"));
        Map<Long, UserRole> rCache = new HashMap<>();

        // ── Helper: User → MemberRow ─────────────────────────
        BiFunction<User, Boolean, MemberRow> toRow = (u, isMgmt) -> {
            String roleName    = "Staff";
            String rawRoleName = "";
            if (u.getRoleId() != null) {
                UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                        id -> userRoleRepository.findById(id).orElse(null));
                if (ur != null) {
                    roleName    = ur.getDisplayName();
                    rawRoleName = ur.getName() != null ? ur.getName().toUpperCase() : "";
                }
            }
            long taskCount = taskRepository.findByAssigneeId(u.getId()).stream()
                    .filter(t -> !"DONE".equals(t.getStatus())).count();
            boolean online = u.getLastSeen() != null
                    && ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;
            MemberRow row = new MemberRow();
            row.setId(u.getId());
            row.setName(u.getName());
            row.setEmail(u.getEmail());
            row.setInitial(getInitial(u.getName()));
            row.setRole(roleName);
            row.setRawRole(rawRoleName);
            row.setRoleId(u.getRoleId());
            row.setColor(getAvatarColor(u.getId()));
            row.setTaskCount(taskCount);
            row.setOnline(online);
            row.setManagement(isMgmt);
            row.setLastSeen(u.getLastSeen());
            return row;
        };

        // ── 1. Management — company-wide (all branches) ───────
        List<MemberRow> mgmtRows = userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> !u.getId().equals(vp.getId()))
                .filter(u -> {
                    if (u.getRoleId() == null) return false;
                    UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                            id -> userRoleRepository.findById(id).orElse(null));
                    return ur != null && mgmtRoleNames.contains(ur.getName().toUpperCase());
                })
                .map(u -> toRow.apply(u, true))
                .sorted(Comparator.comparingInt(r -> getRoleOrder(r.getRawRole())))
                .collect(Collectors.toList());

        // ── 2. Team — same branch, exclude management roles ───
        List<MemberRow> teamRows = userRepository.findStaffByBranchIdAndRoleIdNot(branchId, 10L).stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> !u.getId().equals(vp.getId()))
                .filter(u -> {
                    if (u.getRoleId() == null) return true;
                    UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                            id -> userRoleRepository.findById(id).orElse(null));
                    return ur == null || !mgmtRoleNames.contains(ur.getName().toUpperCase());
                })
                .map(u -> toRow.apply(u, false))
                .sorted((a, b) -> {
                    int ra = getRoleOrder(a.getRawRole());
                    int rb = getRoleOrder(b.getRawRole());
                    if (ra != rb) return Integer.compare(ra, rb);
                    return Long.compare(b.getTaskCount(), a.getTaskCount());
                })
                .collect(Collectors.toList());

        // ── Combine: Management first, then Team ──────────────
        List<MemberRow> result = new ArrayList<>();
        result.addAll(mgmtRows);
        result.addAll(teamRows);

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ⑫ DEPARTMENTS
    // ============================================================
    @GetMapping("/departments")
    public ResponseEntity<List<DepartmentRow>> getDepartments(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());
        return ResponseEntity.ok(Collections.emptyList());
    }

    // ============================================================
    // ⑬ SALARY DETAIL
    // ============================================================
    @GetMapping("/salary-detail")
    public ResponseEntity<List<SalaryDetailRow>> getSalaryDetail(
            @AuthenticationPrincipal User vp,
            @RequestParam String payPeriod) {

        Long branchId = vp.getBranchId();
        if (branchId == null || payPeriod == null || payPeriod.isEmpty())
            return ResponseEntity.ok(Collections.emptyList());

        List<SalaryHistory> rows = salaryHistoryRepository.findAll().stream()
            .filter(s -> branchId.equals(s.getBranchId()))
            .filter(s -> payPeriod.equals(s.getPayPeriod()))
            .collect(Collectors.toList());

        if (rows.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        Map<Long, User>       uCache = new HashMap<>();
        Map<Long, UserRole>   rCache = new HashMap<>();
        Map<Long, Department> dCache = new HashMap<>();

        List<SalaryDetailRow> result = rows.stream().map(s -> {
            User u = s.getUserId() != null
                ? uCache.computeIfAbsent(s.getUserId(), id -> userRepository.findById(id).orElse(null))
                : null;
            String roleName = "Staff";
            String deptName = "—";
            if (u != null && u.getRoleId() != null) {
                UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                    id -> userRoleRepository.findById(id).orElse(null));
                if (ur != null) roleName = ur.getDisplayName();
            }
            if (u != null && u.getDepartmentId() != null) {
                Department dept = dCache.computeIfAbsent(u.getDepartmentId(),
                    id -> departmentRepository.findById(id).orElse(null));
                if (dept != null) deptName = dept.getName();
            }
            SalaryDetailRow r = new SalaryDetailRow();
            r.setId(s.getId());
            r.setUserId(s.getUserId());
            r.setUserName(u != null ? u.getName() : "Unknown");
            r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
            r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
            r.setRole(roleName);
            r.setDepartment(deptName);
            r.setPayPeriod(s.getPayPeriod());
            r.setBaseSalary(s.getBaseSalary());
            r.setWorkingDays(s.getWorkingDays());
            r.setActualDays(s.getActualDays());
            r.setEarnedSalary(s.getEarnedSalary());
            r.setOtAmount(s.getOtAmount());
            r.setBonuses(s.getBonuses());
            r.setDeductions(s.getDeductions());
            r.setGrossSalary(s.getGrossSalary());
            r.setTaxAmount(s.getTaxAmount());
            r.setNetSalary(s.getNetSalary());
            r.setCurrency(s.getCurrency());
            r.setStatus(s.getStatus());
            return r;
        })
        .sorted(Comparator.comparing((SalaryDetailRow r) -> r.getDepartment() == null ? "zzz" : r.getDepartment())
                          .thenComparing(SalaryDetailRow::getUserName))
        .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // DTOs
    // ============================================================
    @Data public static class StatsResponse {
        private long totalStaff, activeProjects, pendingLeave, pendingOT;
        private long pendingSalary, pendingExpense, totalPending, onLeaveToday;
        private BigDecimal monthlyOTHours, monthlySpend, monthlySalarySpend, monthlyExpenseSpend;
        private String currentMonth;
    }
    @Data public static class LeaveRow {
        private Long id, userId;
        private String userName, userInitial, userColor, userRole;
        private String leaveType, reason, status;
        private LocalDate startDate, endDate;
        private Integer totalDays;
        private LocalDateTime createdAt;
    }
    @Data public static class OtRow {
        private Long id, userId, projectId;
        private String userName, userInitial, userColor, userRole;
        private String dayType, projectName, reason, status;
        private LocalDate workDate;
        private BigDecimal otHours, otRate;
        private LocalDateTime createdAt;
    }
    @Data public static class ExpenseRow {
        private Long id, branchId, categoryId, createdBy;
        private BigDecimal amount;
        private String currency, description, expenseType, receiptUrl, status, createdByName;
        private LocalDate date;
        private LocalDateTime createdAt;
    }
    @Data public static class ProjectRow {
        private Long id;
        private String title, status, pmName, pmInitial, pmColor, color;
        private Integer progress;
        private LocalDate startDate, endDate;
        private Long pmId;
    }
    @Data public static class MemberRow {
        private Long id, roleId;
        private String name, email, initial, role, rawRole, color;
        private long taskCount;
        private boolean online;
        private boolean management;
        private LocalDateTime lastSeen;
    }
    @Data public static class DepartmentRow {
        private Long id;
        private String name;
    }
    @Data public static class RejectBody { private String reason; }

    @Data public static class SalaryPeriodSummary {
        private Long branchId;
        private String payPeriod, currency, status;
        private int staffCount;
        private BigDecimal totalGross = BigDecimal.ZERO;
        private BigDecimal totalTax   = BigDecimal.ZERO;
        private BigDecimal totalNet   = BigDecimal.ZERO;
    }

    @Data public static class SalaryDetailRow {
        private Long id, userId;
        private String userName, userInitial, userColor;
        private String role, department, payPeriod, currency, status;
        private Integer workingDays, actualDays;
        private BigDecimal baseSalary   = BigDecimal.ZERO;
        private BigDecimal earnedSalary = BigDecimal.ZERO;
        private BigDecimal otAmount     = BigDecimal.ZERO;
        private BigDecimal bonuses      = BigDecimal.ZERO;
        private BigDecimal deductions   = BigDecimal.ZERO;
        private BigDecimal grossSalary  = BigDecimal.ZERO;
        private BigDecimal taxAmount    = BigDecimal.ZERO;
        private BigDecimal netSalary    = BigDecimal.ZERO;
    }
}