package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.UserDto;
import jp.co.brycen.asn.dto.UserFullProfileDto;
import jp.co.brycen.asn.model.AttendanceLog;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.Task;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.AttendanceLogRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import jp.co.brycen.asn.service.ProfileTranslationService;
import jp.co.brycen.asn.service.ProjectService;
import jp.co.brycen.asn.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

	@Autowired private UserService userService;
	@Autowired private ProfileTranslationService profileTranslationService;
	@Autowired private ProjectService projectService;
	@Autowired private TaskRepository taskRepository;
	@Autowired private AttendanceLogRepository attendanceLogRepository;
	@Autowired private UserRoleRepository userRoleRepository;

	// ============================================================
	// GET /api/users
	// ============================================================
	@GetMapping
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<List<User>> getAllUsers() {
		return ResponseEntity.ok(userService.getAllUsers());
	}

	// ============================================================
	// GET /api/users/by-branch/{branchId}
	// ============================================================
	@GetMapping("/by-branch/{branchId}")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<List<User>> getUsersByBranch(@PathVariable Long branchId) {
		return ResponseEntity.ok(userService.getUsersByBranch(branchId));
	}

	// ============================================================
	// GET /api/users/staff-panel
	// ============================================================
	@GetMapping("/staff-panel")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<List<UserDto.UserResponse>> getStaffPanel(
	        @AuthenticationPrincipal User caller) {
	    return ResponseEntity.ok(userService.getStaffPanelList(caller));
	}

	// ============================================================
	// GET /api/users/staff-list
	// ============================================================
	@GetMapping("/staff-list")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER', 'VICE_PRESIDENT')")
	public ResponseEntity<List<UserDto.UserResponse>> getStaffList(@AuthenticationPrincipal User admin) {
		return ResponseEntity.ok(userService.getUsersByBranchAsResponse(admin.getBranchId()));
	}

	// ============================================================
	// GET /api/users/all-staff
	// ============================================================
	@GetMapping("/all-staff")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER', 'VICE_PRESIDENT')")
	public ResponseEntity<List<UserDto.UserResponse>> getAllStaff() {
	    return ResponseEntity.ok(userService.getAllStaffAsResponse());
	}

	// ============================================================
	// GET /api/users/check-email?email=xxx
	// ============================================================
	@GetMapping("/check-email")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> checkEmail(@RequestParam String email) {
		boolean exists = userService.existsByEmail(email);
		return ResponseEntity.ok(java.util.Map.of("exists", exists));
	}

	// ============================================================
	// GET /api/users/{id}
	// ============================================================
	@GetMapping("/{id}")
	public ResponseEntity<?> getUserById(@PathVariable Long id) {
		try {
			return ResponseEntity.ok(userService.getUserById(id));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// POST /api/users
	// ============================================================
	@PostMapping
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> createUser(@Valid @RequestBody UserDto.CreateUserRequest request) {
		try {
			User user = userService.createUser(request);
			return ResponseEntity.ok(user);
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// PUT /api/users/{id}
	// ============================================================
	@PutMapping("/{id}")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody UserDto.UpdateUserRequest request) {
		try {
			return ResponseEntity.ok(userService.updateUser(id, request));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// PUT /api/users/{id}/activate
	// ============================================================
	@PutMapping("/{id}/activate")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> activateUser(@PathVariable Long id) {
		try {
			userService.activateUser(id);
			return ResponseEntity.ok(new AuthDto.MessageResponse("User activated", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// PUT /api/users/{id}/deactivate
	// ============================================================
	@PutMapping("/{id}/deactivate")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> deactivateUser(@PathVariable Long id) {
		try {
			userService.deactivateUser(id);
			return ResponseEntity.ok(new AuthDto.MessageResponse("User deactivated", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// PUT /api/users/{id}/change-password
	// ============================================================
	@PutMapping("/{id}/change-password")
	@PreAuthorize("isAuthenticated() and (#id == authentication.principal.id or hasAnyRole('BOSS', 'ADMIN'))")
	public ResponseEntity<?> changePassword(@PathVariable Long id,
			@Valid @RequestBody UserDto.ChangePasswordRequest request) {
		try {
			userService.changePassword(id, request.getNewPassword());
			return ResponseEntity.ok(new AuthDto.MessageResponse("Password changed", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// DELETE /api/users/{id}
	// ============================================================
	@DeleteMapping("/{id}")
	@PreAuthorize("hasRole('BOSS')")
	public ResponseEntity<?> deleteUser(@PathVariable Long id) {
		try {
			userService.deleteUser(id);
			return ResponseEntity.ok(new AuthDto.MessageResponse("User deleted", true));
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ============================================================
	// GET /api/users/{id}/full-profile?lang=en
	// ============================================================
	@GetMapping("/{id}/full-profile")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> getFullProfile(@PathVariable Long id,
			@RequestParam(value = "lang", defaultValue = "en") String lang) {
		try {
			UserFullProfileDto profile = userService.getFullProfile(id);
			if (!"en".equals(lang)) {
				profileTranslationService.applyTranslation(profile, lang);
			}
			return ResponseEntity.ok(profile);
		} catch (RuntimeException e) {
			return ResponseEntity.badRequest().body(new AuthDto.MessageResponse(e.getMessage(), false));
		}
	}

	// ================================================================
	// GET /api/users/{id}/current-work
	// ================================================================
	@GetMapping("/{id}/current-work")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> getCurrentWork(@PathVariable Long id) {
	    try {
	        List<Project> projects = projectService.getMyActiveProjects(id);
	        List<Map<String, Object>> projectList = projects.stream().map(p -> {
	            Map<String, Object> m = new LinkedHashMap<>();
	            m.put("id",       p.getId());
	            m.put("title",    p.getTitle());
	            m.put("status",   p.getStatus());
	            m.put("progress", p.getProgress() != null ? p.getProgress() : 0);
	            return m;
	        }).collect(Collectors.toList());

	        List<Map<String, Object>> taskList = taskRepository.findByAssigneeId(id)
	            .stream()
	            .filter(t -> !"DONE".equals(t.getStatus()))
	            .map(t -> {
	                Map<String, Object> m = new LinkedHashMap<>();
	                m.put("id",        t.getId());
	                m.put("title",     t.getTitle());
	                m.put("status",    t.getStatus());
	                m.put("priority",  t.getPriority());
	                m.put("dueDate",   t.getDueDate());
	                m.put("projectId", t.getProjectId());
	                return m;
	            }).collect(Collectors.toList());

	        return ResponseEntity.ok(Map.of("projects", projectList, "tasks", taskList));
	    } catch (Exception e) {
	        return ResponseEntity.ok(Map.of("projects", List.of(), "tasks", List.of()));
	    }
	}

	// ================================================================
	// GET /api/users/{id}/attendance?from=&to=
	// ================================================================
	@GetMapping("/{id}/attendance")
	@PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'VICE_PRESIDENT')")
	public ResponseEntity<?> getAttendance(
	        @PathVariable Long id,
	        @RequestParam String from,
	        @RequestParam String to) {
	    try {
	        LocalDate fromDate = LocalDate.parse(from);
	        LocalDate toDate   = LocalDate.parse(to);
	        List<AttendanceLog> logs =
	            attendanceLogRepository.findByUserIdAndWorkDateBetween(id, fromDate, toDate);
	        List<Map<String, Object>> result = logs.stream()
	            .sorted(Comparator.comparing(AttendanceLog::getWorkDate))
	            .map(a -> {
	                Map<String, Object> m = new LinkedHashMap<>();
	                m.put("workDate", a.getWorkDate());
	                m.put("timeIn",   a.getTimeIn());
	                m.put("timeOut",  a.getTimeOut());
	                m.put("isDayoff", a.getIsDayoff());
	                m.put("note",     a.getNote());
	                m.put("source",   a.getSource());
	                return m;
	            }).collect(Collectors.toList());
	        return ResponseEntity.ok(result);
	    } catch (Exception e) {
	        return ResponseEntity.ok(List.of());
	    }
	}

	// ================================================================
	// PATCH /api/users/{id}/attendance/{date}
	// Admin/Boss/CD → ဘယ် user မဆို edit ရ
	// Member        → self ပဲ edit ရ
	// ================================================================
	@PatchMapping("/{id}/attendance/{date}")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<?> updateAttendance(
	        @PathVariable Long id,
	        @PathVariable String date,
	        @RequestBody Map<String, Object> body,
	        @AuthenticationPrincipal User caller) {
	    try {
	        // Permission check
	        boolean isSelf = caller.getId().equals(id);
	        String callerRoleName = "";
	        if (caller.getRoleId() != null) {
	            callerRoleName = userRoleRepository.findById(caller.getRoleId())
	                .map(r -> r.getName()).orElse("");
	        }
	        boolean isAdmin = List.of("ADMIN", "BOSS", "COUNTRY_DIRECTOR")
	            .contains(callerRoleName);

	        if (!isSelf && !isAdmin) {
	            return ResponseEntity.status(403)
	                .body(new AuthDto.MessageResponse("Access denied", false));
	        }

	        // Find or create
	        LocalDate workDate = LocalDate.parse(date);
	        AttendanceLog log = attendanceLogRepository
	            .findByUserIdAndWorkDate(id, workDate)
	            .orElse(null);

	        if (log == null) {
	            log = new AttendanceLog();
	            log.setUserId(id);
	            log.setWorkDate(workDate);
	        }
	        log.setSource("MANUAL");

	        // Apply fields
	        if (body.containsKey("timeIn")) {
	            String v = (String) body.get("timeIn");
	            log.setTimeIn(v != null && !v.isEmpty() ? LocalTime.parse(v) : null);
	        }
	        if (body.containsKey("timeOut")) {
	            String v = (String) body.get("timeOut");
	            log.setTimeOut(v != null && !v.isEmpty() ? LocalTime.parse(v) : null);
	        }
	        if (body.containsKey("isDayoff")) {
	            log.setIsDayoff(Boolean.parseBoolean(body.get("isDayoff").toString()));
	        }
	        if (body.containsKey("note")) {
	            log.setNote((String) body.get("note"));
	        }

	        attendanceLogRepository.save(log);
	        return ResponseEntity.ok(Map.of("success", true));
	    } catch (Exception e) {
	        return ResponseEntity.badRequest()
	            .body(new AuthDto.MessageResponse(e.getMessage(), false));
	    }
	}
}