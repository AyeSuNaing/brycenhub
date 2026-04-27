package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.PayrollDto;
import jp.co.brycen.asn.dto.PayrollApprovalDto;
import jp.co.brycen.asn.dto.PayrollBatchDto;
import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PayrollCalculatorService — Phase 1+2+3+Finance+Announcement
 *
 * Announcement flow:
 *   save()         → "📝 Payroll Calculated"
 *   submitBatch()  → "⏳ Payroll Submitted for Approval"
 *   approveBatch() → "✅ Payroll Approved"
 *   rejectBatch()  → "🔄 Payroll Under Review"
 *   markBatchPaid()→ "💰 Salary Paid"
 *
 * All announcements: target_scope=BRANCH, target_id=branchId
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PayrollCalculatorService {

    private static final int          MONEY_SCALE = 2;
    private static final RoundingMode ROUND       = RoundingMode.HALF_UP;

    private static final String STATUS_DRAFT            = "DRAFT";
    private static final String STATUS_PENDING_APPROVAL = "PENDING_APPROVAL";
    private static final String STATUS_CONFIRMED        = "CONFIRMED";
    private static final String STATUS_PAID             = "PAID";

    private static final String SALARY_CATEGORY_NAME = "Salary";
    private static final String SALARY_CATEGORY_ICON = "💰";

    // ── Repositories ──────────────────────────────────────────
    private final UserRepository              userRepo;
    private final BranchRepository            branchRepo;
    private final CountryRepository           countryRepo;
    private final SalaryStructureRepository   salaryRepo;
    private final AttendanceLogRepository     attendanceRepo;
    private final OtRequestRepository         otRepo;
    private final PublicHolidayRepository     holidayRepo;
    private final TaxBracketRepository        taxRepo;
    private final SalaryHistoryRepository     historyRepo;
    private final UserRoleRepository          userRoleRepo;
    private final DepartmentRepository        departmentRepo;
    private final FinanceCategoryRepository   categoryRepo;
    private final BranchExpenseRepository     branchExpenseRepo;
    private final AnnouncementRepository      announcementRepo;   // ← NEW

    // ═══════════════════════════════════════════════════════════
    // PHASE 1 — PREVIEW + SAVE
    // ═══════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public PayrollDto.PreviewResponse preview(Long branchId, String payPeriod) {
        LocalDate periodStart = resolvePeriodStart(payPeriod);
        LocalDate periodEnd   = resolvePeriodEnd(payPeriod);

        Branch branch = branchRepo.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found: " + branchId));

        Long   countryId = branch.getCountryId();
        String currency  = resolveCurrency(countryId);
        int    workingDays = calculateWorkingDays(periodStart, periodEnd, countryId);

        List<TaxBracket> brackets = taxRepo.findByCountryIdOrderByMinSalaryAsc(countryId);

        Map<Long, UserRole>   roleCache = userRoleRepo.findAll().stream()
                .collect(Collectors.toMap(UserRole::getId, r -> r));
        Map<Long, Department> deptCache = departmentRepo.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d));

        final Long CLIENT_ROLE_ID = 10L;
        List<User> staff = userRepo.findByBranchIdAndIsActive(branchId, true).stream()
                .filter(u -> u.getRoleId() == null || !CLIENT_ROLE_ID.equals(u.getRoleId()))
                .collect(Collectors.toList());

        List<PayrollDto.PreviewRow> rows = new ArrayList<>();
        for (User u : staff) {
            rows.add(buildRow(u, periodStart, periodEnd, payPeriod,
                    workingDays, currency, brackets, roleCache, deptCache));
        }

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalTax   = BigDecimal.ZERO;
        BigDecimal totalNet   = BigDecimal.ZERO;
        int calculable = 0, warnings = 0;
        for (PayrollDto.PreviewRow r : rows) {
            if ("NONE".equals(r.getWarning())) {
                calculable++;
                totalGross = totalGross.add(nz(r.getGrossSalary()));
                totalTax   = totalTax.add(nz(r.getTaxAmount()));
                totalNet   = totalNet.add(nz(r.getNetSalary()));
            } else {
                warnings++;
            }
        }

        return new PayrollDto.PreviewResponse(
                payPeriod, periodStart, periodEnd,
                branchId, branch.getName(), currency,
                rows.size(), calculable, warnings,
                totalGross, totalTax, totalNet, rows);
    }

    @Transactional
    public PayrollDto.SaveResponse save(PayrollDto.SaveRequest req, Long adminId) {
        PayrollDto.PreviewResponse preview = preview(req.getBranchId(), req.getPayPeriod());

        Set<Long>  filter        = req.getUserIds() == null ? null : new HashSet<>(req.getUserIds());
        String     initialStatus = req.getInitialStatus() == null ? STATUS_DRAFT : req.getInitialStatus();

        int saved = 0, updated = 0, skipped = 0;
        List<String> skipReasons = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (PayrollDto.PreviewRow row : preview.getRows()) {
            if (filter != null && !filter.contains(row.getUserId())) continue;
            if (!"NONE".equals(row.getWarning())) {
                skipped++;
                skipReasons.add(row.getUserName() + ": " + row.getWarningMessage());
                continue;
            }

            Optional<SalaryHistory> existing =
                    historyRepo.findByUserIdAndPayPeriod(row.getUserId(), row.getPayPeriod());

            if (existing.isPresent()) {
                SalaryHistory sh = existing.get();
                if (STATUS_CONFIRMED.equals(sh.getStatus()) || STATUS_PAID.equals(sh.getStatus())) {
                    skipped++;
                    skipReasons.add(row.getUserName() + ": already " + sh.getStatus());
                    continue;
                }
                applyRowToEntity(sh, row, preview.getBranchId());
                sh.setCalculatedBy(adminId);
                sh.setCalculatedAt(now);
                if (!STATUS_PENDING_APPROVAL.equals(sh.getStatus())) {
                    sh.setStatus(STATUS_DRAFT);
                    sh.setRejectReason(null);
                }
                historyRepo.save(sh);
                updated++;
            } else {
                SalaryHistory sh = new SalaryHistory();
                applyRowToEntity(sh, row, preview.getBranchId());
                sh.setStatus(initialStatus);
                sh.setCalculatedBy(adminId);
                sh.setCalculatedAt(now);
                historyRepo.save(sh);
                saved++;
            }
        }

        // 📢 Announcement — Step 1: Payroll Calculated
        if ((saved + updated) > 0) {
            int      staffCount = saved + updated;
            String   branchName = preview.getBranchName();
            String   currency   = preview.getCurrency();
            BigDecimal gross    = preview.getTotalGross();

            postAnnouncement(
                adminId,
                req.getBranchId(),
                "📝 " + formatPeriodLabel(req.getPayPeriod()) + " Payroll Calculated",
                "HR is preparing payroll for " + staffCount + " staff · "
                    + branchName + " · " + currency + " "
                    + gross.setScale(MONEY_SCALE, ROUND).toPlainString() + " total gross",
                "NORMAL"
            );
        }

        return new PayrollDto.SaveResponse(saved, updated, skipped, skipReasons, now);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2 — PAYSLIP + HISTORY
    // ═══════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public PayrollApprovalDto.PayslipResponse getPayslip(Long id) {
        SalaryHistory sh = historyRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Record not found: " + id));

        PayrollApprovalDto.PayslipResponse res = new PayrollApprovalDto.PayslipResponse();
        res.setId(sh.getId());
        res.setPayPeriod(sh.getPayPeriod());
        res.setPeriodStart(sh.getPeriodStart());
        res.setPeriodEnd(sh.getPeriodEnd());

        userRepo.findById(sh.getUserId()).ifPresent(u -> {
            res.setUserId(u.getId());
            res.setUserName(u.getName());
            res.setUserEmail(u.getEmail());
            res.setUserPhone(u.getPhone());
            if (u.getRoleId() != null) {
                userRoleRepo.findById(u.getRoleId()).ifPresent(r -> {
                    res.setRoleDisplayName(r.getDisplayName());
                    res.setRoleColor(r.getColor());
                });
            }
            if (u.getDepartmentId() != null) {
                departmentRepo.findById(u.getDepartmentId())
                        .ifPresent(d -> res.setDepartmentName(d.getName()));
            }
        });

        branchRepo.findById(sh.getBranchId()).ifPresent(b -> {
            res.setBranchId(b.getId());
            res.setBranchName(b.getName());
            if (b.getCountryId() != null) {
                countryRepo.findById(b.getCountryId())
                        .ifPresent(c -> res.setCountryName(c.getName()));
            }
        });

        res.setBaseSalary(sh.getBaseSalary());
        res.setWorkingDays(sh.getWorkingDays());
        res.setActualDays(sh.getActualDays());
        res.setDailyRate(sh.getDailyRate());
        res.setEarnedSalary(sh.getEarnedSalary());
        res.setOtAmount(sh.getOtAmount());
        res.setDeductions(sh.getDeductions());
        res.setBonuses(sh.getBonuses());
        res.setGrossSalary(sh.getGrossSalary());
        res.setTaxAmount(sh.getTaxAmount());
        res.setNetSalary(sh.getNetSalary());
        res.setCurrency(sh.getCurrency());
        res.setStatus(sh.getStatus());
        res.setNote(sh.getNote());
        res.setCalculatedAt(sh.getCalculatedAt());
        if (sh.getCalculatedBy() != null) {
            userRepo.findById(sh.getCalculatedBy())
                    .ifPresent(u -> res.setCalculatedByName(u.getName()));
        }
        res.setConfirmedAt(sh.getConfirmedAt());
        if (sh.getConfirmedBy() != null) {
            userRepo.findById(sh.getConfirmedBy())
                    .ifPresent(u -> res.setConfirmedByName(u.getName()));
        }
        res.setPaidAt(sh.getPaidAt());

        return res;
    }

    @Transactional(readOnly = true)
    public PayrollApprovalDto.HistoryResponse getHistory(Long branchId, String payPeriod) {
        List<SalaryHistory> all = (branchId != null)
                ? historyRepo.findAll().stream()
                        .filter(s -> s.getBranchId().equals(branchId))
                        .collect(Collectors.toList())
                : historyRepo.findAll();

        List<String> periods = all.stream()
                .map(SalaryHistory::getPayPeriod)
                .distinct()
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());

        String selected = (payPeriod == null || payPeriod.isEmpty())
                ? (periods.isEmpty() ? null : periods.get(0))
                : payPeriod;

        PayrollApprovalDto.HistoryResponse res = new PayrollApprovalDto.HistoryResponse();
        res.setAvailablePeriods(periods);
        res.setSelectedPeriod(selected);

        if (selected == null) {
            res.setTotalRecords(0);
            res.setRows(new ArrayList<>());
            return res;
        }

        final String finalSelected = selected;
        List<SalaryHistory> filtered = all.stream()
                .filter(s -> finalSelected.equals(s.getPayPeriod()))
                .sorted(Comparator.comparing(SalaryHistory::getUserId))
                .collect(Collectors.toList());

        Map<Long, UserRole>   roleCache   = userRoleRepo.findAll().stream()
                .collect(Collectors.toMap(UserRole::getId, r -> r));
        Map<Long, Department> deptCache   = departmentRepo.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d));
        Map<Long, String>     branchCache = new HashMap<>();

        List<PayrollApprovalDto.HistoryRow> rows = new ArrayList<>();
        BigDecimal gSum = BigDecimal.ZERO, tSum = BigDecimal.ZERO, nSum = BigDecimal.ZERO;
        int dC = 0, hC = 0, cC = 0, pC = 0;
        String currency = "USD";

        for (SalaryHistory sh : filtered) {
            PayrollApprovalDto.HistoryRow row = new PayrollApprovalDto.HistoryRow();
            row.setId(sh.getId());
            row.setUserId(sh.getUserId());
            row.setPayPeriod(sh.getPayPeriod());
            row.setPeriodStart(sh.getPeriodStart());
            row.setPeriodEnd(sh.getPeriodEnd());
            row.setBaseSalary(sh.getBaseSalary());
            row.setOtAmount(sh.getOtAmount());
            row.setDeductions(sh.getDeductions());
            row.setGrossSalary(sh.getGrossSalary());
            row.setTaxAmount(sh.getTaxAmount());
            row.setNetSalary(sh.getNetSalary());
            row.setCurrency(sh.getCurrency());
            row.setStatus(sh.getStatus());
            row.setPaidAt(sh.getPaidAt());
            row.setBranchId(sh.getBranchId());

            userRepo.findById(sh.getUserId()).ifPresent(u -> {
                row.setUserName(u.getName());
                if (u.getRoleId() != null) {
                    UserRole r = roleCache.get(u.getRoleId());
                    if (r != null) { row.setRoleDisplayName(r.getDisplayName()); row.setRoleColor(r.getColor()); }
                }
                if (u.getDepartmentId() != null) {
                    Department d = deptCache.get(u.getDepartmentId());
                    if (d != null) row.setDepartmentName(d.getName());
                }
            });

            String bName = branchCache.computeIfAbsent(sh.getBranchId(),
                    bid -> branchRepo.findById(bid).map(Branch::getName).orElse(""));
            row.setBranchName(bName);
            rows.add(row);

            gSum = gSum.add(nz(sh.getGrossSalary()));
            tSum = tSum.add(nz(sh.getTaxAmount()));
            nSum = nSum.add(nz(sh.getNetSalary()));
            switch (sh.getStatus()) {
                case STATUS_DRAFT:            dC++; break;
                case STATUS_PENDING_APPROVAL: hC++; break;
                case STATUS_CONFIRMED:        cC++; break;
                case STATUS_PAID:             pC++; break;
            }
            currency = sh.getCurrency();
        }

        res.setTotalRecords(rows.size());
        res.setDraftCount(dC);
        res.setHrReviewedCount(hC);
        res.setConfirmedCount(cC);
        res.setPaidCount(pC);
        res.setTotalGross(gSum);
        res.setTotalTax(tSum);
        res.setTotalNet(nSum);
        res.setCurrency(currency);
        res.setRows(rows);
        return res;
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3 — BATCH APPROVAL WORKFLOW
    // ═══════════════════════════════════════════════════════════

    @Transactional
    public PayrollBatchDto.BatchActionResponse submitBatch(
            Long branchId, String payPeriod, String note, Long adminId) {

        List<SalaryHistory> rows = historyRepo.findByBranchAndPeriod(branchId, payPeriod);
        if (rows.isEmpty()) throw new IllegalArgumentException(
                "No payroll records for branch " + branchId + " in " + payPeriod);

        String branchName = branchRepo.findById(branchId).map(Branch::getName).orElse("");
        LocalDateTime now = LocalDateTime.now();

        int affected = 0, skipped = 0;
        List<String> skipReasons = new ArrayList<>();
        String trimmedNote = note == null ? null : note.trim();

        for (SalaryHistory sh : rows) {
            if (!STATUS_DRAFT.equals(sh.getStatus())) {
                skipped++;
                skipReasons.add("User " + sh.getUserId() + ": already " + sh.getStatus());
                continue;
            }
            sh.setStatus(STATUS_PENDING_APPROVAL);
            sh.setRejectReason(null);
            if (trimmedNote != null && !trimmedNote.isEmpty()) sh.setNote(trimmedNote);
            historyRepo.save(sh);
            affected++;
        }

        // 📢 Announcement — Step 2: Submitted for Approval
        if (affected > 0) {
            User admin = userRepo.findById(adminId).orElse(null);
            String adminName = admin != null ? admin.getName() : "HR";

            postAnnouncement(
                adminId, branchId,
                "⏳ " + formatPeriodLabel(payPeriod) + " Payroll Submitted",
                "Submitted by " + adminName + " · " + affected
                    + " staff · Awaiting management approval",
                "NORMAL"
            );
        }

        return new PayrollBatchDto.BatchActionResponse(
                branchId, branchName, payPeriod,
                STATUS_DRAFT, STATUS_PENDING_APPROVAL,
                affected, skipped, skipReasons,
                "Submitted " + affected + " records for approval", now);
    }

    @Transactional
    public PayrollBatchDto.BatchActionResponse approveBatch(
            Long branchId, String payPeriod, String note, Long approverId) {

        List<SalaryHistory> rows = historyRepo.findByBranchAndPeriod(branchId, payPeriod);
        if (rows.isEmpty()) throw new IllegalArgumentException(
                "No payroll records for branch " + branchId + " in " + payPeriod);

        String branchName = branchRepo.findById(branchId).map(Branch::getName).orElse("");
        LocalDateTime now = LocalDateTime.now();

        int affected = 0, skipped = 0;
        List<String> skipReasons = new ArrayList<>();
        String trimmedNote = note == null ? null : note.trim();

        for (SalaryHistory sh : rows) {
            if (!STATUS_PENDING_APPROVAL.equals(sh.getStatus())) {
                skipped++;
                skipReasons.add("User " + sh.getUserId() + ": status " + sh.getStatus());
                continue;
            }
            sh.setStatus(STATUS_CONFIRMED);
            sh.setConfirmedBy(approverId);
            sh.setConfirmedAt(now);
            if (trimmedNote != null && !trimmedNote.isEmpty()) sh.setNote(trimmedNote);
            historyRepo.save(sh);
            affected++;
        }

        // 📢 Announcement — Step 3: Approved
        if (affected > 0) {
            User approver = userRepo.findById(approverId).orElse(null);
            String approverName = approver != null ? approver.getName() : "Management";
            String approverRole = "";
            if (approver != null && approver.getRoleId() != null) {
                approverRole = userRoleRepo.findById(approver.getRoleId())
                        .map(r -> " (" + r.getDisplayName() + ")")
                        .orElse("");
            }

            postAnnouncement(
                approverId, branchId,
                "✅ " + formatPeriodLabel(payPeriod) + " Payroll Approved",
                "Approved by " + approverName + approverRole
                    + " · " + affected + " staff · Payment will be processed shortly",
                "IMPORTANT"
            );
        }

        return new PayrollBatchDto.BatchActionResponse(
                branchId, branchName, payPeriod,
                STATUS_PENDING_APPROVAL, STATUS_CONFIRMED,
                affected, skipped, skipReasons,
                "Approved " + affected + " records — ready for payment", now);
    }

    @Transactional
    public PayrollBatchDto.BatchActionResponse rejectBatch(
            Long branchId, String payPeriod, String reason, Long approverId) {

        if (reason == null || reason.trim().isEmpty())
            throw new IllegalArgumentException("Reject reason is required");

        List<SalaryHistory> rows = historyRepo.findByBranchAndPeriod(branchId, payPeriod);
        if (rows.isEmpty()) throw new IllegalArgumentException(
                "No payroll records for branch " + branchId + " in " + payPeriod);

        String branchName = branchRepo.findById(branchId).map(Branch::getName).orElse("");
        LocalDateTime now = LocalDateTime.now();

        int affected = 0, skipped = 0;
        List<String> skipReasons = new ArrayList<>();
        String trimmedReason = reason.trim();

        for (SalaryHistory sh : rows) {
            if (!STATUS_PENDING_APPROVAL.equals(sh.getStatus())) {
                skipped++;
                skipReasons.add("User " + sh.getUserId() + ": status " + sh.getStatus());
                continue;
            }
            sh.setStatus(STATUS_DRAFT);
            sh.setRejectReason(trimmedReason);
            historyRepo.save(sh);
            affected++;
        }

        // 📢 Announcement — Step 3b: Under Review (reject reason မပါ — staff ကို detail မပြ)
        if (affected > 0) {
            postAnnouncement(
                approverId, branchId,
                "🔄 " + formatPeriodLabel(payPeriod) + " Payroll Under Review",
                "Management has requested revision · HR will recalculate and resubmit",
                "NORMAL"
            );
        }

        return new PayrollBatchDto.BatchActionResponse(
                branchId, branchName, payPeriod,
                STATUS_PENDING_APPROVAL, STATUS_DRAFT,
                affected, skipped, skipReasons,
                "Rejected " + affected + " records — admin will review", now);
    }

    @Transactional
    public PayrollBatchDto.BatchActionResponse markBatchPaid(
            Long branchId, String payPeriod, String note, Long adminId) {

        List<SalaryHistory> rows = historyRepo.findByBranchAndPeriod(branchId, payPeriod);
        if (rows.isEmpty()) throw new IllegalArgumentException(
                "No payroll records for branch " + branchId + " in " + payPeriod);

        String branchName = branchRepo.findById(branchId).map(Branch::getName).orElse("");
        LocalDateTime now = LocalDateTime.now();

        int affected = 0, skipped = 0;
        List<String> skipReasons = new ArrayList<>();
        String trimmedNote = note == null ? null : note.trim();

        BigDecimal batchGross = BigDecimal.ZERO;
        BigDecimal batchNet   = BigDecimal.ZERO;
        LocalDate  periodEnd  = null;
        String     currency   = "USD";
        Long       confirmedBy = null;
        LocalDateTime confirmedAt = null;

        for (SalaryHistory sh : rows) {
            if (!STATUS_CONFIRMED.equals(sh.getStatus())) {
                skipped++;
                skipReasons.add("User " + sh.getUserId() + ": status " + sh.getStatus());
                continue;
            }
            sh.setStatus(STATUS_PAID);
            sh.setPaidAt(now);
            if (trimmedNote != null && !trimmedNote.isEmpty()) sh.setNote(trimmedNote);
            historyRepo.save(sh);
            affected++;

            batchGross = batchGross.add(nz(sh.getGrossSalary()));
            batchNet   = batchNet.add(nz(sh.getNetSalary()));
            if (periodEnd == null) periodEnd = sh.getPeriodEnd();
            if (sh.getCurrency() != null) currency = sh.getCurrency();
            if (confirmedBy == null && sh.getConfirmedBy() != null) {
                confirmedBy = sh.getConfirmedBy();
                confirmedAt = sh.getConfirmedAt();
            }
        }

        if (affected > 0) {
            // Finance sync
            try {
                syncToFinanceExpense(branchId, payPeriod, periodEnd,
                        batchGross, batchNet, currency,
                        affected, confirmedBy, confirmedAt, adminId);
            } catch (Exception e) {
                log.error("[Payroll] Finance sync failed for {}/{}: {}",
                        branchId, payPeriod, e.getMessage(), e);
            }

            // 📢 Announcement — Step 4: Salary Paid
            String paidDate = now.toLocalDate().toString();
            String netStr   = currency + " " + batchNet.setScale(MONEY_SCALE, ROUND).toPlainString();

            postAnnouncement(
                adminId, branchId,
                "💰 " + formatPeriodLabel(payPeriod) + " Salary Paid",
                affected + " staff · " + netStr + " net · Paid on " + paidDate
                    + (trimmedNote != null && !trimmedNote.isEmpty() ? " · " + trimmedNote : ""),
                "IMPORTANT"
            );
        }

        return new PayrollBatchDto.BatchActionResponse(
                branchId, branchName, payPeriod,
                STATUS_CONFIRMED, STATUS_PAID,
                affected, skipped, skipReasons,
                "Marked " + affected + " records as paid", now);
    }

    // ═══════════════════════════════════════════════════════════
    // ANNOUNCEMENT HELPER
    // ═══════════════════════════════════════════════════════════

    /**
     * Post payroll-related announcement to the branch.
     * target_scope = BRANCH, target_id = branchId
     * Error-safe: announcement failure never blocks payroll flow.
     */
	
	private void postAnnouncement(Long authorId, Long branchId,
	                              String title, String content,
	                              String priority) {
	    try {
	        Announcement a = new Announcement();
	        a.setAuthorId(authorId);
	        a.setTitle(title);
	        a.setContent(content);
	        a.setTargetScope("BRANCH");
	        a.setTargetId(branchId);
	        a.setOriginalLanguage("en");
	        a.setIsPinned(0);
	        a.setPriority(priority);
	 
	        // Payroll announcements → 24hr auto-expire
	        a.setExpiresAt(LocalDateTime.now().plusHours(24));
	 
	        announcementRepo.save(a);
	        log.info("[Payroll] Announcement posted — branchId={}, title={}", branchId, title);
	    } catch (Exception e) {
	        log.warn("[Payroll] Announcement failed (non-critical): {}", e.getMessage());
	    }
	}

    // ═══════════════════════════════════════════════════════════
    // FINANCE SYNC
    // ═══════════════════════════════════════════════════════════

    private void syncToFinanceExpense(
            Long branchId, String payPeriod, LocalDate periodEnd,
            BigDecimal totalGross, BigDecimal totalNet, String currency,
            int staffCount, Long confirmedBy, LocalDateTime confirmedAt,
            Long adminId) {

        FinanceCategory category = resolveSalaryCategory(adminId);

        String description = String.format(
                "Payroll %s · %d staff · %s %s net",
                payPeriod, staffCount, currency,
                totalNet.setScale(2, ROUND).toPlainString());

        BranchExpense expense = new BranchExpense();
        expense.setBranchId(branchId);
        expense.setCategoryId(category.getId());
        expense.setAmount(totalGross.setScale(MONEY_SCALE, ROUND));
        expense.setCurrency(currency);
        expense.setDescription(description);
        expense.setExpenseType("SALARY");
        expense.setDate(periodEnd != null ? periodEnd : LocalDate.now());
        expense.setStatus("APPROVED");
        expense.setApprovedBy(confirmedBy);
        expense.setApprovedAt(confirmedAt);
        expense.setCreatedBy(adminId);

        branchExpenseRepo.save(expense);
        log.info("[Payroll] Finance sync OK — branch={}, period={}, amount={} {}",
                branchId, payPeriod, totalGross, currency);
    }

    private FinanceCategory resolveSalaryCategory(Long adminId) {
        List<FinanceCategory> candidates = categoryRepo
                .findByTypeAndScopeAndIsActive("EXPENSE", "GLOBAL", Boolean.TRUE);

        return candidates.stream()
                .filter(c -> c.getName() != null
                        && c.getName().toLowerCase().contains("salary"))
                .findFirst()
                .orElseGet(() -> {
                    log.info("[Payroll] Auto-creating 'Salary' category");
                    FinanceCategory c = new FinanceCategory();
                    c.setName(SALARY_CATEGORY_NAME);
                    c.setIcon(SALARY_CATEGORY_ICON);
                    c.setType("EXPENSE");
                    c.setScope("GLOBAL");
                    c.setBranchId(null);
                    c.setIsActive(Boolean.TRUE);
                    c.setCreatedBy(adminId);
                    return categoryRepo.save(c);
                });
    }

    // ═══════════════════════════════════════════════════════════
    // BATCH STATUS + PENDING BATCHES
    // ═══════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public PayrollBatchDto.BatchStatusSummary getBatchStatus(Long branchId, String payPeriod) {
        List<SalaryHistory> rows = historyRepo.findByBranchAndPeriod(branchId, payPeriod);

        PayrollBatchDto.BatchStatusSummary s = new PayrollBatchDto.BatchStatusSummary();
        s.setBranchId(branchId);
        s.setPayPeriod(payPeriod);

        if (rows.isEmpty()) { s.setDominantStatus("NONE"); return s; }

        int dC = 0, pC = 0, cC = 0, paidC = 0;
        String lastReject = null;
        for (SalaryHistory sh : rows) {
            switch (sh.getStatus()) {
                case STATUS_DRAFT:            dC++;
                    if (lastReject == null && sh.getRejectReason() != null)
                        lastReject = sh.getRejectReason();
                    break;
                case STATUS_PENDING_APPROVAL: pC++;    break;
                case STATUS_CONFIRMED:        cC++;    break;
                case STATUS_PAID:             paidC++; break;
            }
        }
        s.setDraftCount(dC);
        s.setPendingCount(pC);
        s.setConfirmedCount(cC);
        s.setPaidCount(paidC);
        s.setLastRejectReason(lastReject);

        int max = Math.max(Math.max(dC, pC), Math.max(cC, paidC));
        if      (max == paidC && paidC > 0) s.setDominantStatus(STATUS_PAID);
        else if (max == cC    && cC > 0)    s.setDominantStatus(STATUS_CONFIRMED);
        else if (max == pC    && pC > 0)    s.setDominantStatus(STATUS_PENDING_APPROVAL);
        else                                 s.setDominantStatus(STATUS_DRAFT);

        s.setCanSubmit(dC > 0);
        s.setCanApprove(pC > 0);
        s.setCanReject(pC > 0);
        s.setCanMarkPaid(cC > 0);
        return s;
    }

    @Transactional(readOnly = true)
    public PayrollBatchDto.PendingBatchesResponse getPendingBatches(Long branchScope) {
        List<SalaryHistory> pending = historyRepo.findAll().stream()
                .filter(s -> STATUS_PENDING_APPROVAL.equals(s.getStatus()))
                .filter(s -> branchScope == null || branchScope.equals(s.getBranchId()))
                .collect(Collectors.toList());

        Map<String, List<SalaryHistory>> grouped = pending.stream()
                .collect(Collectors.groupingBy(s -> s.getBranchId() + "|" + s.getPayPeriod()));

        Map<Long, String> branchCache  = new HashMap<>();
        Map<Long, String> countryCache = new HashMap<>();
        Map<Long, String> userNameCache = new HashMap<>();

        List<PayrollBatchDto.PendingBatch> batches = new ArrayList<>();
        int totalStaff = 0;

        for (Map.Entry<String, List<SalaryHistory>> entry : grouped.entrySet()) {
            List<SalaryHistory> list = entry.getValue();
            if (list.isEmpty()) continue;
            SalaryHistory first = list.get(0);

            PayrollBatchDto.PendingBatch b = new PayrollBatchDto.PendingBatch();
            b.setBranchId(first.getBranchId());
            b.setPayPeriod(first.getPayPeriod());
            b.setPeriodStart(first.getPeriodStart());
            b.setPeriodEnd(first.getPeriodEnd());
            b.setCurrency(first.getCurrency());
            b.setStaffCount(list.size());

            BigDecimal gSum = BigDecimal.ZERO, tSum = BigDecimal.ZERO, nSum = BigDecimal.ZERO;
            LocalDateTime latestUpdate = null;
            for (SalaryHistory s : list) {
                gSum = gSum.add(nz(s.getGrossSalary()));
                tSum = tSum.add(nz(s.getTaxAmount()));
                nSum = nSum.add(nz(s.getNetSalary()));
                if (s.getUpdatedAt() != null
                        && (latestUpdate == null || s.getUpdatedAt().isAfter(latestUpdate)))
                    latestUpdate = s.getUpdatedAt();
            }
            b.setTotalGross(gSum);
            b.setTotalTax(tSum);
            b.setTotalNet(nSum);
            b.setSubmittedAt(latestUpdate);
            b.setSubmitNote(first.getNote());

            if (first.getCalculatedBy() != null) {
                String name = userNameCache.computeIfAbsent(first.getCalculatedBy(),
                        uid -> userRepo.findById(uid).map(User::getName).orElse("—"));
                b.setSubmittedByName(name);
            }

            String bName = branchCache.computeIfAbsent(first.getBranchId(), bid ->
                    branchRepo.findById(bid).map(Branch::getName).orElse(""));
            b.setBranchName(bName);

            branchRepo.findById(first.getBranchId()).ifPresent(br -> {
                if (br.getCountryId() != null) {
                    String cName = countryCache.computeIfAbsent(br.getCountryId(), cid ->
                            countryRepo.findById(cid).map(Country::getName).orElse(""));
                    b.setCountryName(cName);
                }
            });

            batches.add(b);
            totalStaff += list.size();
        }

        batches.sort(Comparator.comparing(
                PayrollBatchDto.PendingBatch::getSubmittedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return new PayrollBatchDto.PendingBatchesResponse(batches.size(), totalStaff, batches);
    }

    // ═══════════════════════════════════════════════════════════
    // CORE FORMULAS
    // ═══════════════════════════════════════════════════════════

    public LocalDate resolvePeriodStart(String payPeriod) {
        return YearMonth.parse(payPeriod).minusMonths(1).atDay(25);
    }

    public LocalDate resolvePeriodEnd(String payPeriod) {
        return YearMonth.parse(payPeriod).atDay(24);
    }

    public int calculateWorkingDays(LocalDate start, LocalDate end, Long countryId) {
        int weekdays = 0;
        LocalDate d = start;
        while (!d.isAfter(end)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) weekdays++;
            d = d.plusDays(1);
        }
        List<PublicHoliday> holidays = holidayRepo.findByCountryIdAndDateRange(countryId, start, end);
        long holidayOnWeekday = holidays.stream()
                .filter(h -> h.getHolidayDate().getDayOfWeek() != DayOfWeek.SATURDAY
                        && h.getHolidayDate().getDayOfWeek() != DayOfWeek.SUNDAY)
                .count();
        return Math.max(0, weekdays - (int) holidayOnWeekday);
    }

    public int calculateActualDays(Long userId, LocalDate start, LocalDate end) {
        return attendanceRepo.countWorkedDaysInPeriod(userId, start, end);
    }

    public BigDecimal calculateOtAmount(Long userId, LocalDate start, LocalDate end) {
        BigDecimal sum = otRepo.sumApprovedOtAmount(userId, start, end);
        return sum == null ? BigDecimal.ZERO : sum.setScale(MONEY_SCALE, ROUND);
    }

    public BigDecimal calculateTax(BigDecimal gross, List<TaxBracket> brackets) {
        if (gross == null || gross.signum() <= 0 || brackets == null || brackets.isEmpty())
            return BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (TaxBracket b : brackets) {
            BigDecimal min     = b.getMinSalary() == null ? BigDecimal.ZERO : b.getMinSalary();
            if (gross.compareTo(min) <= 0) break;
            BigDecimal upper   = b.getMaxSalary();
            BigDecimal ceiling = (upper == null) ? gross : gross.min(upper);
            BigDecimal taxable = ceiling.subtract(min);
            if (taxable.signum() <= 0) continue;
            BigDecimal rate    = b.getTaxRate() == null ? BigDecimal.ZERO : b.getTaxRate();
            tax = tax.add(taxable.multiply(rate).divide(BigDecimal.valueOf(100), MONEY_SCALE, ROUND));
            if (upper == null || gross.compareTo(upper) <= 0) break;
        }
        return tax.setScale(MONEY_SCALE, ROUND);
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════

    private PayrollDto.PreviewRow buildRow(User u,
                                           LocalDate start, LocalDate end,
                                           String payPeriod, int workingDays,
                                           String currency, List<TaxBracket> brackets,
                                           Map<Long, UserRole> roleCache,
                                           Map<Long, Department> deptCache) {
        PayrollDto.PreviewRow r = new PayrollDto.PreviewRow();
        r.setUserId(u.getId());
        r.setUserName(u.getName());
        r.setEmail(u.getEmail());

        if (u.getRoleId() != null) {
            UserRole role = roleCache.get(u.getRoleId());
            if (role != null) { r.setRoleDisplayName(role.getDisplayName()); r.setRoleColor(role.getColor()); }
        }
        if (u.getDepartmentId() != null) {
            Department d = deptCache.get(u.getDepartmentId());
            if (d != null) r.setDepartmentName(d.getName());
        }

        r.setPayPeriod(payPeriod);
        r.setPeriodStart(start);
        r.setPeriodEnd(end);
        r.setCurrency(currency);
        r.setWorkingDays(workingDays);

        Optional<SalaryHistory> existing = historyRepo.findByUserIdAndPayPeriod(u.getId(), payPeriod);
        r.setExistsInDb(existing.isPresent());
        existing.ifPresent(sh -> r.setCurrentStatus(sh.getStatus()));

        Optional<SalaryStructure> salaryOpt = salaryRepo.findCurrentByUserId(u.getId());
        if (salaryOpt.isEmpty()) {
            r.setBaseSalary(BigDecimal.ZERO);
            setZeros(r);
            r.setWarning("MISSING_SALARY");
            r.setWarningMessage("No salary_structures record");
            return r;
        }

        BigDecimal baseSalary = salaryOpt.get().getBaseSalary();
        r.setBaseSalary(baseSalary);

        if (workingDays <= 0) {
            setZeros(r);
            r.setWarning("NO_WORKING_DAYS");
            r.setWarningMessage("Working days = 0 in this period");
            return r;
        }

        int actualDays = calculateActualDays(u.getId(), start, end);
        r.setActualDays(actualDays);

        BigDecimal dailyRate = baseSalary.divide(BigDecimal.valueOf(workingDays), MONEY_SCALE, ROUND);
        r.setDailyRate(dailyRate);

        BigDecimal earned = dailyRate.multiply(BigDecimal.valueOf(actualDays)).setScale(MONEY_SCALE, ROUND);
        r.setEarnedSalary(earned);

        BigDecimal ot = calculateOtAmount(u.getId(), start, end);
        r.setOtAmount(ot);
        r.setDeductions(BigDecimal.ZERO);
        r.setBonuses(BigDecimal.ZERO);

        BigDecimal gross = earned.add(ot).setScale(MONEY_SCALE, ROUND);
        r.setGrossSalary(gross);

        BigDecimal tax = calculateTax(gross, brackets);
        r.setTaxAmount(tax);

        BigDecimal net = gross.subtract(tax).setScale(MONEY_SCALE, ROUND);
        r.setNetSalary(net);

        if (actualDays == 0) {
            r.setWarning("NO_ATTENDANCE");
            r.setWarningMessage("No attendance logs in period");
        } else if (existing.isPresent()
                && (STATUS_CONFIRMED.equals(existing.get().getStatus())
                || STATUS_PAID.equals(existing.get().getStatus()))) {
            r.setWarning("ALREADY_SAVED");
            r.setWarningMessage("Already " + existing.get().getStatus() + " — locked");
        } else {
            r.setWarning("NONE");
        }
        return r;
    }

    private void applyRowToEntity(SalaryHistory sh, PayrollDto.PreviewRow row, Long branchId) {
        sh.setUserId(row.getUserId());
        sh.setBranchId(branchId);
        sh.setPayPeriod(row.getPayPeriod());
        sh.setPeriodStart(row.getPeriodStart());
        sh.setPeriodEnd(row.getPeriodEnd());
        sh.setBaseSalary(row.getBaseSalary());
        sh.setWorkingDays(row.getWorkingDays());
        sh.setActualDays(row.getActualDays());
        sh.setDailyRate(row.getDailyRate());
        sh.setEarnedSalary(row.getEarnedSalary());
        sh.setOtAmount(nz(row.getOtAmount()));
        sh.setDeductions(nz(row.getDeductions()));
        sh.setBonuses(nz(row.getBonuses()));
        sh.setGrossSalary(row.getGrossSalary());
        sh.setTaxAmount(nz(row.getTaxAmount()));
        sh.setNetSalary(row.getNetSalary());
        sh.setCurrency(row.getCurrency());
    }

    private String resolveCurrency(Long countryId) {
        if (countryId == null) return "USD";
        return countryRepo.findById(countryId)
                .map(Country::getCurrency)
                .filter(c -> c != null && !c.isEmpty())
                .orElse("USD");
    }

    /** "2026-03" → "March 2026" */
    private String formatPeriodLabel(String payPeriod) {
        try {
            YearMonth ym = YearMonth.parse(payPeriod);
            return ym.getMonth().getDisplayName(
                    java.time.format.TextStyle.FULL,
                    java.util.Locale.ENGLISH) + " " + ym.getYear();
        } catch (Exception e) {
            return payPeriod;
        }
    }

    private void setZeros(PayrollDto.PreviewRow r) {
        r.setActualDays(0);
        r.setDailyRate(BigDecimal.ZERO);
        r.setEarnedSalary(BigDecimal.ZERO);
        r.setOtAmount(BigDecimal.ZERO);
        r.setDeductions(BigDecimal.ZERO);
        r.setBonuses(BigDecimal.ZERO);
        r.setGrossSalary(BigDecimal.ZERO);
        r.setTaxAmount(BigDecimal.ZERO);
        r.setNetSalary(BigDecimal.ZERO);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}