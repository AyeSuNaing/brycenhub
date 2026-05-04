package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.PayrollDto;
import jp.co.brycen.asn.dto.PayrollApprovalDto;
import jp.co.brycen.asn.dto.PayrollBatchDto;
import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.model.SalaryHistory;
import jp.co.brycen.asn.repository.SalaryHistoryRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import jp.co.brycen.asn.service.PayrollCalculatorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
@Validated
public class PayrollController {

    private final PayrollCalculatorService payrollService;
    private final SalaryHistoryRepository  historyRepo;
    private final UserRoleRepository       userRoleRepo;

    // ① PREVIEW
    @PostMapping("/preview")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> preview(
            @Valid @RequestBody PayrollDto.PreviewRequest req,
            @AuthenticationPrincipal User admin) {
        if (!canAccessBranch(admin, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.preview(req.getBranchId(), req.getPayPeriod()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] preview", e); return serverError(e.getMessage()); }
    }

    // ② SAVE
    @PostMapping("/save")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> save(
            @Valid @RequestBody PayrollDto.SaveRequest req,
            @AuthenticationPrincipal User admin) {
        if (!canAccessBranch(admin, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.save(req, admin.getId()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] save", e); return serverError(e.getMessage()); }
    }

    // ③ PAYSLIP VIEW
    @GetMapping("/payslip/{id}")
    public ResponseEntity<?> getPayslip(
            @PathVariable Long id,
            @AuthenticationPrincipal User caller) {
        if (caller == null) return forbidden();
        try {
            PayrollApprovalDto.PayslipResponse res = payrollService.getPayslip(id);
            boolean self     = res.getUserId() != null && res.getUserId().equals(caller.getId());
            boolean global   = isGlobalAdmin(caller);
            boolean sameBr   = caller.getBranchId() != null
                            && caller.getBranchId().equals(res.getBranchId());
            boolean managerR = isManagerRole(caller);
            if (!(self || global || (managerR && sameBr))) return forbidden();
            return ResponseEntity.ok(res);
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] payslip", e); return serverError(e.getMessage()); }
    }

    // ④ HISTORY VIEW
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getHistory(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) String payPeriod,
            @AuthenticationPrincipal User admin) {
        if (branchId == null && !isGlobalAdmin(admin)) branchId = admin.getBranchId();
        if (branchId != null && !canAccessBranch(admin, branchId)) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.getHistory(branchId, payPeriod));
        } catch (Exception e) { log.error("[Payroll] history", e); return serverError(e.getMessage()); }
    }

    // ④-B MY HISTORY
    @GetMapping("/my-history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyHistory(@AuthenticationPrincipal User caller) {
        try {
            List<SalaryHistory> records =
                historyRepo.findByUserIdOrderByPeriodEndDesc(caller.getId());
            List<Map<String, Object>> rows = records.stream().map(r -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id",          r.getId());
                m.put("userId",      r.getUserId());
                m.put("payPeriod",   r.getPayPeriod());
                m.put("periodStart", r.getPeriodStart());
                m.put("periodEnd",   r.getPeriodEnd());
                m.put("grossSalary", r.getGrossSalary());
                m.put("taxAmount",   r.getTaxAmount());
                m.put("netSalary",   r.getNetSalary());
                m.put("currency",    r.getCurrency() != null ? r.getCurrency() : "USD");
                m.put("status",      r.getStatus());
                m.put("paidAt",      r.getPaidAt());
                m.put("branchId",    r.getBranchId());
                return m;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            log.error("[Payroll] my-history", e);
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    // ⑤ BATCH STATUS
    @GetMapping("/batch-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getBatchStatus(
            @RequestParam Long branchId,
            @RequestParam String payPeriod,
            @AuthenticationPrincipal User admin) {
        if (!canAccessBranch(admin, branchId)) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.getBatchStatus(branchId, payPeriod));
        } catch (Exception e) { log.error("[Payroll] batch-status", e); return serverError(e.getMessage()); }
    }

    // ⑥ SUBMIT BATCH — DRAFT → PENDING_APPROVAL (ADMIN)
    @PostMapping("/batch/submit")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<?> submitBatch(
            @Valid @RequestBody PayrollBatchDto.BatchActionRequest req,
            @AuthenticationPrincipal User admin) {
        if (!canAccessBranch(admin, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.submitBatch(
                    req.getBranchId(), req.getPayPeriod(), req.getNote(), admin.getId()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] submit batch", e); return serverError(e.getMessage()); }
    }

    // ⑦ APPROVE BATCH — PENDING_APPROVAL → CONFIRMED (VP/Dir/Boss)
    @PostMapping("/batch/approve")
    @PreAuthorize("hasAnyRole('VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> approveBatch(
            @Valid @RequestBody PayrollBatchDto.BatchActionRequest req,
            @AuthenticationPrincipal User approver) {
        if (!canAccessBranch(approver, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.approveBatch(
                    req.getBranchId(), req.getPayPeriod(), req.getNote(), approver.getId()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] approve batch", e); return serverError(e.getMessage()); }
    }

    // ⑧ REJECT BATCH — PENDING_APPROVAL → DRAFT (VP/Dir/Boss)
    @PostMapping("/batch/reject")
    @PreAuthorize("hasAnyRole('VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> rejectBatch(
            @Valid @RequestBody PayrollBatchDto.BatchActionRequest req,
            @AuthenticationPrincipal User approver) {
        if (!canAccessBranch(approver, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.rejectBatch(
                    req.getBranchId(), req.getPayPeriod(), req.getNote(), approver.getId()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] reject batch", e); return serverError(e.getMessage()); }
    }

    // ⑨ MARK BATCH PAID — CONFIRMED → PAID (ADMIN)
    @PostMapping("/batch/mark-paid")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<?> markBatchPaid(
            @Valid @RequestBody PayrollBatchDto.BatchActionRequest req,
            @AuthenticationPrincipal User admin) {
        if (!canAccessBranch(admin, req.getBranchId())) return forbidden();
        try {
            return ResponseEntity.ok(payrollService.markBatchPaid(
                    req.getBranchId(), req.getPayPeriod(), req.getNote(), admin.getId()));
        } catch (IllegalArgumentException e) { return badRequest(e.getMessage()); }
          catch (Exception e) { log.error("[Payroll] mark batch paid", e); return serverError(e.getMessage()); }
    }

    // ⑩ PENDING BATCHES — VP/Dir/Boss inbox
    @GetMapping("/pending-batches")
    @PreAuthorize("hasAnyRole('VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getPendingBatches(@AuthenticationPrincipal User approver) {
        try {
            Long scope = isGlobalAdmin(approver) ? null : approver.getBranchId();
            return ResponseEntity.ok(payrollService.getPendingBatches(scope));
        } catch (Exception e) { log.error("[Payroll] pending-batches", e); return serverError(e.getMessage()); }
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    private boolean isGlobalAdmin(User admin) {
        if (admin == null) return false;
        Long roleId = admin.getRoleId();
        if (roleId == null) return false;
        // ✅ branchId null check ဖယ် — DR မှာ branchId ရှိနိုင်တယ်
        return userRoleRepo.findById(roleId)
            .map(r -> "BOSS".equals(r.getName()) || "COUNTRY_DIRECTOR".equals(r.getName()))
            .orElse(false);
    }

    private boolean isAdminRole(User u) {
        if (u == null || u.getRoleId() == null) return false;
        return userRoleRepo.findById(u.getRoleId())
                .map(r -> "ADMIN".equals(r.getName()))
                .orElse(false);
    }

    private boolean isManagerRole(User u) {
        if (u == null || u.getRoleId() == null) return false;
        return userRoleRepo.findById(u.getRoleId())
                .map(r -> {
                    String n = r.getName();
                    return "ADMIN".equals(n) || "VICE_PRESIDENT".equals(n)
                        || "COUNTRY_DIRECTOR".equals(n) || "BOSS".equals(n);
                })
                .orElse(false);
    }

    private boolean canAccessBranch(User admin, Long branchId) {
        if (admin == null) return false;
        Long roleId = admin.getRoleId();
        String role = (roleId != null)
            ? userRoleRepo.findById(roleId).map(r -> r.getName()).orElse("")
            : "";
        // ✅ BOSS — all branches
        if ("BOSS".equals(role)) return true;
        // ✅ COUNTRY_DIRECTOR — all branches (scope VpDashboardController ထဲ handle ပြီး)
        if ("COUNTRY_DIRECTOR".equals(role)) return true;
        // VP / ADMIN — own branch only
        return admin.getBranchId() != null && admin.getBranchId().equals(branchId);
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
    }
    private ResponseEntity<?> badRequest(String msg) {
        return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(msg, false));
    }
    private ResponseEntity<?> serverError(String msg) {
        return ResponseEntity.status(500).body(new AuthDto.MessageResponse(msg, false));
    }
}