package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.LeaveRequestDto;
import jp.co.brycen.asn.dto.OtRequestDto;
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
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/dashboard")
@PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
public class AdminDashboardController {

	@Autowired private UserRepository userRepository;
	@Autowired private BranchRepository branchRepository;
	@Autowired private OtRequestRepository otRequestRepository;
	@Autowired private LeaveRequestRepository leaveRequestRepository;
	@Autowired private PublicHolidayRepository publicHolidayRepository;
	@Autowired private ProjectRepository projectRepository;

	// ── Helpers ──────────────────────────────────────────────────
	private boolean isCompanyAdmin(User admin) { return admin.getBranchId() == null; }
	private String getInitial(String name) {
		return (name != null && !name.isEmpty()) ? String.valueOf(name.charAt(0)).toUpperCase() : "?";
	}
	private String getAvatarColor(Long id) {
		String[] c = {"#16a34a","#0284c7","#7c3aed","#db2777","#ea580c","#0891b2"};
		return c[(int)(id % c.length)];
	}

	// ============================================================
	// ① STATS
	// ============================================================
	@GetMapping("/stats")
	public ResponseEntity<StatsResponse> getStats(@AuthenticationPrincipal User admin) {
		Long branchId  = admin.getBranchId();
		boolean isComp = isCompanyAdmin(admin);
		int year  = LocalDate.now().getYear();
		int month = LocalDate.now().getMonthValue();
		LocalDate today = LocalDate.now();

		long totalStaff = isComp
			? userRepository.countByIsActiveAndRoleIdNot(true, 10L)
			: userRepository.countByBranchIdAndIsActiveAndRoleIdNot(branchId, true, 10L);
		long pendingOT = isComp
			? otRequestRepository.countByStatus("PENDING")
			: otRequestRepository.countByBranchIdAndStatus(branchId, "PENDING");
		BigDecimal totalOTHours = isComp
			? otRequestRepository.sumApprovedOtHours(year, month)
			: otRequestRepository.sumApprovedOtHoursByBranch(branchId, year, month);
		long pendingLeave = isComp
			? leaveRequestRepository.countByStatus("PENDING")
			: leaveRequestRepository.countByBranchIdAndStatus(branchId, "PENDING");
		long todayLeave = isComp
			? leaveRequestRepository.findTodayLeave(today).size()
			: leaveRequestRepository.findTodayLeaveByBranch(branchId, today).size();

		StatsResponse res = new StatsResponse();
		res.setTotalStaff(totalStaff);
		res.setPendingOT(pendingOT);
		res.setTotalOTHours(totalOTHours != null ? totalOTHours : BigDecimal.ZERO);
		res.setLeaveRequests(pendingLeave);
		res.setTodayLeave(todayLeave);
		res.setCurrentMonth(LocalDate.now().getMonth().name());
		res.setPayrollStatus("DRAFT");
		return ResponseEntity.ok(res);
	}

	// ============================================================
	// ② OT REQUESTS — ALL status support
	// ============================================================
	@GetMapping("/ot-requests")
	public ResponseEntity<List<OtRequestDto.Response>> getOtRequests(
			@AuthenticationPrincipal User admin,
			@RequestParam(defaultValue = "PENDING") String status) {

		Long branchId = admin.getBranchId();
		boolean isComp = isCompanyAdmin(admin);

		List<OtRequest> list;
		if ("ALL".equalsIgnoreCase(status)) {
			list = isComp
				? otRequestRepository.findAllByOrderByCreatedAtDesc()
				: otRequestRepository.findByBranchIdAllOrderByCreatedAtDesc(branchId);
		} else {
			list = isComp
				? otRequestRepository.findByStatusOrderByCreatedAtDesc(status)
				: otRequestRepository.findByBranchIdAndStatus(branchId, status);
		}

		Map<Long, User>    uCache = new HashMap<>();
		Map<Long, Project> pCache = new HashMap<>();

		List<OtRequestDto.Response> result = list.stream().map(ot -> {
			User u    = uCache.computeIfAbsent(ot.getUserId(), id -> userRepository.findById(id).orElse(null));
			Project p = ot.getProjectId() != null
				? pCache.computeIfAbsent(ot.getProjectId(), id -> projectRepository.findById(id).orElse(null))
				: null;
			User approver = ot.getApprovedBy() != null
				? uCache.computeIfAbsent(ot.getApprovedBy(), id -> userRepository.findById(id).orElse(null))
				: null;
			OtRequestDto.Response r = new OtRequestDto.Response();
			r.setId(ot.getId());
			r.setUserId(ot.getUserId());
			r.setUserName(u != null ? u.getName() : "Unknown");
			r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
			r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
			r.setWorkDate(ot.getWorkDate());
			r.setDayType(ot.getDayType());
			r.setOtHours(ot.getOtHours());
			r.setOtRate(ot.getOtRate());
			r.setOtAmount(ot.getOtAmount());
			r.setProjectId(ot.getProjectId());
			r.setProjectName(p != null ? p.getTitle() : null);
			r.setReason(ot.getReason());
			r.setStatus(ot.getStatus());
			r.setCreatedAt(ot.getCreatedAt());
			r.setApprovedBy(ot.getApprovedBy());
			r.setApprovedByName(approver != null ? approver.getName() : null);
			r.setApprovedAt(ot.getApprovedAt());
			return r;
		}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// ============================================================
	// ③ APPROVE OT
	// ============================================================
	@PatchMapping("/ot-requests/{id}/approve")
	public ResponseEntity<?> approveOt(@PathVariable Long id, @AuthenticationPrincipal User admin) {
		try {
			OtRequest ot = otRequestRepository.findById(id)
				.orElseThrow(() -> new RuntimeException("OT request not found"));
			if (!isCompanyAdmin(admin)) {
				User staff = userRepository.findById(ot.getUserId()).orElse(null);
				if (staff == null || !admin.getBranchId().equals(staff.getBranchId()))
					return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
			}
			ot.setStatus("APPROVED");
			ot.setApprovedBy(admin.getId());
			ot.setApprovedAt(LocalDateTime.now());
			otRequestRepository.save(ot);
			return ResponseEntity.ok(new AuthDto.MessageResponse("OT approved", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// ④ REJECT OT
	// ============================================================
	@PatchMapping("/ot-requests/{id}/reject")
	public ResponseEntity<?> rejectOt(@PathVariable Long id,
			@RequestBody(required = false) OtRequestDto.RejectRequest body,
			@AuthenticationPrincipal User admin) {
		try {
			OtRequest ot = otRequestRepository.findById(id)
				.orElseThrow(() -> new RuntimeException("OT request not found"));
			if (!isCompanyAdmin(admin)) {
				User staff = userRepository.findById(ot.getUserId()).orElse(null);
				if (staff == null || !admin.getBranchId().equals(staff.getBranchId()))
					return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
			}
			ot.setStatus("REJECTED");
			ot.setApprovedBy(admin.getId());
			ot.setApprovedAt(LocalDateTime.now());
			ot.setRejectReason(body != null ? body.getReason() : null);
			otRequestRepository.save(ot);
			return ResponseEntity.ok(new AuthDto.MessageResponse("OT rejected", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// ⑤ LEAVE REQUESTS — ALL status support
	// ============================================================
	@GetMapping("/leave-requests")
	public ResponseEntity<List<LeaveRequestDto.Response>> getLeaveRequests(
			@AuthenticationPrincipal User admin,
			@RequestParam(defaultValue = "PENDING") String status) {

		Long branchId = admin.getBranchId();
		boolean isComp = isCompanyAdmin(admin);

		List<LeaveRequest> list;
		if ("ALL".equalsIgnoreCase(status)) {
			list = isComp
				? leaveRequestRepository.findAllByOrderByCreatedAtDesc()
				: leaveRequestRepository.findByBranchIdAllOrderByCreatedAtDesc(branchId);
		} else {
			list = isComp
				? leaveRequestRepository.findByStatusOrderByCreatedAtDesc(status)
				: leaveRequestRepository.findByBranchIdAndStatus(branchId, status);
		}

		Map<Long, User> uCache = new HashMap<>();
		List<LeaveRequestDto.Response> result = list.stream().map(lv -> {
			User u = uCache.computeIfAbsent(lv.getUserId(), id -> userRepository.findById(id).orElse(null));
			User approver = lv.getApprovedBy() != null
				? uCache.computeIfAbsent(lv.getApprovedBy(), id -> userRepository.findById(id).orElse(null))
				: null;
			LeaveRequestDto.Response r = new LeaveRequestDto.Response();
			r.setId(lv.getId());
			r.setUserId(lv.getUserId());
			r.setUserName(u != null ? u.getName() : "Unknown");
			r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
			r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
			r.setLeaveType(lv.getLeaveType());
			r.setStartDate(lv.getStartDate());
			r.setEndDate(lv.getEndDate());
			r.setTotalDays(lv.getTotalDays());
			r.setReason(lv.getReason());
			r.setStatus(lv.getStatus());
			r.setCreatedAt(lv.getCreatedAt());
			r.setApprovedBy(lv.getApprovedBy());
			r.setApprovedByName(approver != null ? approver.getName() : null);
			r.setApprovedAt(lv.getApprovedAt());
			return r;
		}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// ============================================================
	// ⑥ APPROVE LEAVE
	// ============================================================
	@PatchMapping("/leave-requests/{id}/approve")
	public ResponseEntity<?> approveLeave(@PathVariable Long id, @AuthenticationPrincipal User admin) {
		try {
			LeaveRequest lv = leaveRequestRepository.findById(id)
				.orElseThrow(() -> new RuntimeException("Leave request not found"));
			if (!isCompanyAdmin(admin)) {
				User staff = userRepository.findById(lv.getUserId()).orElse(null);
				if (staff == null || !admin.getBranchId().equals(staff.getBranchId()))
					return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
			}
			lv.setStatus("APPROVED");
			lv.setApprovedBy(admin.getId());
			lv.setApprovedAt(LocalDateTime.now());
			leaveRequestRepository.save(lv);
			return ResponseEntity.ok(new AuthDto.MessageResponse("Leave approved", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// ⑦ REJECT LEAVE
	// ============================================================
	@PatchMapping("/leave-requests/{id}/reject")
	public ResponseEntity<?> rejectLeave(@PathVariable Long id,
			@RequestBody(required = false) LeaveRequestDto.RejectRequest body,
			@AuthenticationPrincipal User admin) {
		try {
			LeaveRequest lv = leaveRequestRepository.findById(id)
				.orElseThrow(() -> new RuntimeException("Leave request not found"));
			if (!isCompanyAdmin(admin)) {
				User staff = userRepository.findById(lv.getUserId()).orElse(null);
				if (staff == null || !admin.getBranchId().equals(staff.getBranchId()))
					return ResponseEntity.status(403).body(new AuthDto.MessageResponse("Access denied", false));
			}
			lv.setStatus("REJECTED");
			lv.setApprovedBy(admin.getId());
			lv.setApprovedAt(LocalDateTime.now());
			lv.setRejectReason(body != null ? body.getReason() : null);
			leaveRequestRepository.save(lv);
			return ResponseEntity.ok(new AuthDto.MessageResponse("Leave rejected", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// ⑧ TODAY LEAVE
	// ============================================================
	@GetMapping("/today-leave")
	public ResponseEntity<List<LeaveRequestDto.TodayLeaveResponse>> getTodayLeave(
			@AuthenticationPrincipal User admin) {
		LocalDate today    = LocalDate.now();
		LocalDate tomorrow = today.plusDays(1);
		Long branchId      = admin.getBranchId();
		boolean isComp     = isCompanyAdmin(admin);

		List<LeaveRequest> todayList    = isComp ? leaveRequestRepository.findTodayLeave(today)
			: leaveRequestRepository.findTodayLeaveByBranch(branchId, today);
		List<LeaveRequest> tomorrowList = isComp ? leaveRequestRepository.findTomorrowLeave(tomorrow)
			: leaveRequestRepository.findTomorrowLeaveByBranch(branchId, tomorrow);

		Map<Long, User> uCache = new HashMap<>();
		List<LeaveRequestDto.TodayLeaveResponse> result = new ArrayList<>();

		todayList.forEach(lv -> {
			User u = uCache.computeIfAbsent(lv.getUserId(), id -> userRepository.findById(id).orElse(null));
			LeaveRequestDto.TodayLeaveResponse r = new LeaveRequestDto.TodayLeaveResponse();
			r.setUserId(lv.getUserId()); r.setUserName(u != null ? u.getName() : "Unknown");
			r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
			r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
			r.setLeaveType(lv.getLeaveType()); r.setEndDate(lv.getEndDate()); r.setIsToday(true);
			result.add(r);
		});
		tomorrowList.forEach(lv -> {
			User u = uCache.computeIfAbsent(lv.getUserId(), id -> userRepository.findById(id).orElse(null));
			LeaveRequestDto.TodayLeaveResponse r = new LeaveRequestDto.TodayLeaveResponse();
			r.setUserId(lv.getUserId()); r.setUserName(u != null ? u.getName() : "Unknown");
			r.setUserInitial(u != null ? getInitial(u.getName()) : "?");
			r.setUserColor(u != null ? getAvatarColor(u.getId()) : "#64748b");
			r.setLeaveType(lv.getLeaveType()); r.setEndDate(lv.getEndDate()); r.setIsToday(false);
			result.add(r);
		});
		return ResponseEntity.ok(result);
	}

	// ============================================================
	// ⑨ HOLIDAYS
	// ============================================================
	@GetMapping("/holidays")
	public ResponseEntity<List<PublicHoliday>> getHolidays(@AuthenticationPrincipal User admin,
			@RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
		try {
			int y = year  != null ? year  : LocalDate.now().getYear();
			int m = month != null ? month : LocalDate.now().getMonthValue();
			Long countryId = null;
			if (admin.getBranchId() != null)
				countryId = branchRepository.findById(admin.getBranchId()).map(b -> b.getCountryId()).orElse(null);
			List<PublicHoliday> holidays = countryId != null
				? publicHolidayRepository.findByCountryIdAndYearAndMonth(countryId, y, m)
				: publicHolidayRepository.findByYearAndMonth(y, m);
			return ResponseEntity.ok(holidays);
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(null);
		}
	}

	// ── Response DTOs ─────────────────────────────────────────────
	@Data
	public static class StatsResponse {
		private long totalStaff;
		private long pendingOT;
		private BigDecimal totalOTHours;
		private long leaveRequests;
		private long todayLeave;
		private String currentMonth;
		private String payrollStatus;
	}
}