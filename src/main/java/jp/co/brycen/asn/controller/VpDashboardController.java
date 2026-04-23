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

/**
 * VP Dashboard Controller
 *
 * Scope:  VICE_PRESIDENT's own branch only (users.branch_id = VP.branch_id)
 * Auth:   VICE_PRESIDENT role required
 *
 * Endpoints (all prefixed with /api/vp/dashboard):
 *   GET  /stats                           — branch KPIs
 *   GET  /pending-approvals               — unified counts (leave+ot+salary+expense)
 *   GET  /leave-requests?status=PENDING   — branch leave list
 *   GET  /ot-requests?status=PENDING      — branch OT list
 *   GET  /branch-expenses?status=PENDING&type=SALARY|EXPENSE
 *   PATCH /leave-requests/{id}/approve
 *   PATCH /leave-requests/{id}/reject
 *   PATCH /ot-requests/{id}/approve
 *   PATCH /ot-requests/{id}/reject
 *   PATCH /branch-expenses/{id}/approve
 *   PATCH /branch-expenses/{id}/reject
 *   GET  /branch-projects                 — active projects in branch
 *   GET  /branch-members                  — active users in branch
 *   GET  /branch-finance                  — finance summary (monthly)
 */
@RestController
@RequestMapping("/api/vp/dashboard")
@PreAuthorize("hasRole('VICE_PRESIDENT')")
public class VpDashboardController {

    @Autowired private UserRepository userRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private OtRequestRepository otRequestRepository;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private BranchExpenseRepository branchExpenseRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
 // @Autowired ထပ်ထည့်
    @Autowired private SalaryHistoryRepository salaryHistoryRepository;

    // ============================================================
    // HELPERS
    // ============================================================

    private String getInitial(String name) {
        return (name != null && !name.isEmpty())
                ? String.valueOf(name.charAt(0)).toUpperCase()
                : "?";
    }

    private String getAvatarColor(Long id) {
        String[] colors = { "#16a34a", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#0891b2" };
        return colors[(int) (Math.abs(id == null ? 0 : id) % colors.length)];
    }

    /**
     * Ensure VP can only touch their own branch's data.
     * If target entity's branch != VP's branch → 403.
     */
    private boolean sameBranch(User vp, Long targetUserId) {
        if (vp.getBranchId() == null) return false;
        User target = userRepository.findById(targetUserId).orElse(null);
        return target != null && vp.getBranchId().equals(target.getBranchId());
    }

    private boolean sameExpenseBranch(User vp, BranchExpense exp) {
        return vp.getBranchId() != null && vp.getBranchId().equals(exp.getBranchId());
    }

    // ============================================================
    // ① STATS
    // GET /api/vp/dashboard/stats
    // ============================================================
    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        int year  = LocalDate.now().getYear();
        int month = LocalDate.now().getMonthValue();
        LocalDate today = LocalDate.now();

        if (branchId == null) {
            return ResponseEntity.ok(new StatsResponse());
        }

        StatsResponse r = new StatsResponse();

        // Staff count (exclude CLIENT role = 10)
        r.setTotalStaff(userRepository.countByBranchIdAndIsActiveAndRoleIdNot(branchId, true, 10L));

        // Pending counts
        r.setPendingLeave(leaveRequestRepository.countByBranchIdAndStatus(branchId, "PENDING"));
        r.setPendingOT(otRequestRepository.countByBranchIdAndStatus(branchId, "PENDING"));
        r.setPendingSalary(salaryHistoryRepository.countByBranchIdAndStatus(branchId, "PENDING_APPROVAL"));

        r.setPendingSalary(salaryHistoryRepository.countByBranchIdAndStatus(branchId, "PENDING_APPROVAL"));
        r.setTotalPending(r.getPendingLeave() + r.getPendingOT() + r.getPendingSalary() + r.getPendingExpense());

        // OT hours this month (approved)
        BigDecimal otHours = otRequestRepository.sumApprovedOtHoursByBranch(branchId, year, month);
        r.setMonthlyOTHours(otHours != null ? otHours : BigDecimal.ZERO);

        // Today on leave
        r.setOnLeaveToday(leaveRequestRepository.findTodayLeaveByBranch(branchId, today).size());

        // Active projects in branch
        r.setActiveProjects(projectRepository.findByBranchId(branchId).stream()
                .filter(p -> "ACTIVE".equals(p.getStatus()))
                .count());

        // Monthly spend (approved expenses)
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
    // GET /api/vp/dashboard/leave-requests?status=PENDING
    // ============================================================
    @GetMapping("/leave-requests")
    public ResponseEntity<List<LeaveRow>> getLeaveRequests(
            @AuthenticationPrincipal User vp,
            @RequestParam(defaultValue = "PENDING") String status) {

        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        List<LeaveRequest> list = leaveRequestRepository.findByBranchIdAndStatus(branchId, status);
        Map<Long, User> uCache = new HashMap<>();
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

            LeaveRow r = new LeaveRow();
            r.setId(lv.getId());
            r.setUserId(lv.getUserId());
            r.setUserName(u != null ? u.getName() : "Unknown");
            r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
            r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
            r.setUserRole(roleName);
            r.setLeaveType(lv.getLeaveType());
            r.setStartDate(lv.getStartDate());
            r.setEndDate(lv.getEndDate());
            r.setTotalDays(lv.getTotalDays());
            r.setReason(lv.getReason());
            r.setStatus(lv.getStatus());
            r.setCreatedAt(lv.getCreatedAt());
            return r;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ③ OT REQUESTS
    // GET /api/vp/dashboard/ot-requests?status=PENDING
    // ============================================================
    @GetMapping("/ot-requests")
    public ResponseEntity<List<OtRow>> getOtRequests(
            @AuthenticationPrincipal User vp,
            @RequestParam(defaultValue = "PENDING") String status) {

        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        List<OtRequest> list = otRequestRepository.findByBranchIdAndStatus(branchId, status);
        Map<Long, User> uCache = new HashMap<>();
        Map<Long, Project> pCache = new HashMap<>();
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

            OtRow r = new OtRow();
            r.setId(ot.getId());
            r.setUserId(ot.getUserId());
            r.setUserName(u != null ? u.getName() : "Unknown");
            r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
            r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
            r.setUserRole(roleName);
            r.setWorkDate(ot.getWorkDate());
            r.setDayType(ot.getDayType());
            r.setOtHours(ot.getOtHours());
            r.setOtRate(ot.getOtRate());
            r.setProjectId(ot.getProjectId());
            r.setProjectName(p != null ? p.getTitle() : null);
            r.setReason(ot.getReason());
            r.setStatus(ot.getStatus());
            r.setCreatedAt(ot.getCreatedAt());
            return r;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ④ BRANCH EXPENSES (SALARY + EXPENSE)
    // GET /api/vp/dashboard/branch-expenses?status=PENDING&type=SALARY
    // ============================================================
    @GetMapping("/branch-expenses")
    public ResponseEntity<List<ExpenseRow>> getBranchExpenses(
            @AuthenticationPrincipal User vp,
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(required = false) String type) {

        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        List<BranchExpense> list = (type != null && !type.isEmpty())
                ? branchExpenseRepository.findByBranchIdAndStatusAndExpenseTypeOrderByCreatedAtDesc(branchId, status, type)
                : branchExpenseRepository.findByBranchIdAndStatusOrderByCreatedAtDesc(branchId, status);

        Map<Long, User> uCache = new HashMap<>();

        List<ExpenseRow> result = list.stream().map(e -> {
            User creator = e.getCreatedBy() != null
                    ? uCache.computeIfAbsent(e.getCreatedBy(),
                            id -> userRepository.findById(id).orElse(null))
                    : null;

            ExpenseRow r = new ExpenseRow();
            r.setId(e.getId());
            r.setBranchId(e.getBranchId());
            r.setCategoryId(e.getCategoryId());
            r.setAmount(e.getAmount());
            r.setCurrency(e.getCurrency());
            r.setDescription(e.getDescription());
            r.setExpenseType(e.getExpenseType());
            r.setReceiptUrl(e.getReceiptUrl());
            r.setDate(e.getDate());
            r.setStatus(e.getStatus());
            r.setCreatedBy(e.getCreatedBy());
            r.setCreatedByName(creator != null ? creator.getName() : null);
            r.setCreatedAt(e.getCreatedAt());
            return r;
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

            if (!sameBranch(vp, lv.getUserId())) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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

            if (!sameBranch(vp, lv.getUserId())) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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

            if (!sameBranch(vp, ot.getUserId())) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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

            if (!sameBranch(vp, ot.getUserId())) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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

            if (!sameExpenseBranch(vp, exp)) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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

            if (!sameExpenseBranch(vp, exp)) {
                return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied — not your branch", false));
            }

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
    // ⑧ BRANCH PROJECTS (enriched with PM info)
    // GET /api/vp/dashboard/branch-projects
    // ============================================================
    @GetMapping("/branch-projects")
    public ResponseEntity<List<ProjectRow>> getBranchProjects(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        List<Project> projects = projectRepository.findByBranchId(branchId);
        Map<Long, User> uCache = new HashMap<>();

        List<ProjectRow> result = projects.stream()
            .filter(p -> "ACTIVE".equals(p.getStatus()) || "PLANNING".equals(p.getStatus()))
            .map(p -> {
                User pm = p.getPmId() != null
                        ? uCache.computeIfAbsent(p.getPmId(),
                                id -> userRepository.findById(id).orElse(null))
                        : null;

                ProjectRow r = new ProjectRow();
                r.setId(p.getId());
                r.setTitle(p.getTitle());
                r.setStatus(p.getStatus());
                r.setProgress(p.getProgress() != null ? p.getProgress() : 0);
                r.setStartDate(p.getStartDate());
                r.setEndDate(p.getEndDate());
                r.setPmId(p.getPmId());
                r.setPmName(pm != null ? pm.getName() : "Unassigned");
                r.setPmInitial(pm != null ? getInitial(pm.getName()) : "?");
                r.setPmColor(pm != null ? getAvatarColor(pm.getId()) : "#64748b");
                r.setColor(p.getColor());
                return r;
            })
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // ⑨ BRANCH MEMBERS
    // GET /api/vp/dashboard/branch-members
    // ============================================================
    @GetMapping("/branch-members")
    public ResponseEntity<List<MemberRow>> getBranchMembers(@AuthenticationPrincipal User vp) {
        Long branchId = vp.getBranchId();
        if (branchId == null) return ResponseEntity.ok(Collections.emptyList());

        // Exclude CLIENT role (10) + self
        List<User> users = userRepository.findStaffByBranchIdAndRoleIdNot(branchId, 10L).stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> !u.getId().equals(vp.getId()))
                .collect(Collectors.toList());

        Map<Long, UserRole> rCache = new HashMap<>();

        List<MemberRow> result = users.stream().map(u -> {
            String roleName = "Staff";
            if (u.getRoleId() != null) {
                UserRole ur = rCache.computeIfAbsent(u.getRoleId(),
                        id -> userRoleRepository.findById(id).orElse(null));
                if (ur != null) roleName = ur.getDisplayName();
            }

            // Active task count
            long taskCount = taskRepository.findByAssigneeId(u.getId()).stream()
                    .filter(t -> !"DONE".equals(t.getStatus()))
                    .count();

            boolean online = u.getLastSeen() != null
                    && ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;

            MemberRow r = new MemberRow();
            r.setId(u.getId());
            r.setName(u.getName());
            r.setEmail(u.getEmail());
            r.setInitial(getInitial(u.getName()));
            r.setRole(roleName);
            r.setRoleId(u.getRoleId());
            r.setColor(getAvatarColor(u.getId()));
            r.setTaskCount(taskCount);
            r.setOnline(online);
            r.setLastSeen(u.getLastSeen());
            return r;
        })
        .sorted((a, b) -> Long.compare(b.getTaskCount(), a.getTaskCount()))
        .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ============================================================
    // RESPONSE DTOs (inner classes)
    // ============================================================

    @Data
    public static class StatsResponse {
        private long       totalStaff;
        private long       activeProjects;
        private long       pendingLeave;
        private long       pendingOT;
        private long       pendingSalary;
        private long       pendingExpense;
        private long       totalPending;
        private BigDecimal monthlyOTHours;
        private long       onLeaveToday;
        private BigDecimal monthlySpend;
        private BigDecimal monthlySalarySpend;
        private BigDecimal monthlyExpenseSpend;
        private String     currentMonth;
    }

    @Data
    public static class LeaveRow {
        private Long          id;
        private Long          userId;
        private String        userName;
        private String        userInitial;
        private String        userColor;
        private String        userRole;
        private String        leaveType;
        private LocalDate     startDate;
        private LocalDate     endDate;
        private Integer       totalDays;
        private String        reason;
        private String        status;
        private LocalDateTime createdAt;
    }

    @Data
    public static class OtRow {
        private Long          id;
        private Long          userId;
        private String        userName;
        private String        userInitial;
        private String        userColor;
        private String        userRole;
        private LocalDate     workDate;
        private String        dayType;
        private BigDecimal    otHours;
        private BigDecimal    otRate;
        private Long          projectId;
        private String        projectName;
        private String        reason;
        private String        status;
        private LocalDateTime createdAt;
    }

    @Data
    public static class ExpenseRow {
        private Long          id;
        private Long          branchId;
        private Long          categoryId;
        private BigDecimal    amount;
        private String        currency;
        private String        description;
        private String        expenseType;
        private String        receiptUrl;
        private LocalDate     date;
        private String        status;
        private Long          createdBy;
        private String        createdByName;
        private LocalDateTime createdAt;
    }

    @Data
    public static class ProjectRow {
        private Long       id;
        private String     title;
        private String     status;
        private Integer    progress;
        private LocalDate  startDate;
        private LocalDate  endDate;
        private Long       pmId;
        private String     pmName;
        private String     pmInitial;
        private String     pmColor;
        private String     color;
    }

    @Data
    public static class MemberRow {
        private Long          id;
        private String        name;
        private String        email;
        private String        initial;
        private String        role;
        private Long          roleId;
        private String        color;
        private long          taskCount;
        private boolean       online;
        private LocalDateTime lastSeen;
    }

    @Data
    public static class RejectBody {
        private String reason;
    }
}
