package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import jp.co.brycen.asn.service.ProjectService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard/pm")
@CrossOrigin(origins = "http://localhost:4200")
public class DashboardController {

	@Autowired
	private ProjectRepository projectRepository;
	@Autowired
	private ProjectMemberRepository projectMemberRepository;
	@Autowired
	private TaskRepository taskRepository;
	@Autowired
	private UserRepository userRepository;
	@Autowired
	private UserRoleRepository userRoleRepository;
	@Autowired
	private ActivityLogRepository activityLogRepository;
	@Autowired
	private AnnouncementRepository announcementRepository;
	@Autowired
	private ProjectService projectService;

	// ─────────────────────────────────────────────────────────────────
	// Helper: PM ရဲ့ project ids ယူတယ်
	// ─────────────────────────────────────────────────────────────────

	private List<Long> getProjectIds(Long userId) {
		return projectService.getMyActiveProjects(userId).stream().map(Project::getId).collect(Collectors.toList());
	}

	// ─────────────────────────────────────────────────────────────────
	// Helper: avatar colors (userId % size)
	// ─────────────────────────────────────────────────────────────────
	private static final List<String> AVATAR_COLORS = Arrays.asList("#22c55e", "#3b82f6", "#a855f7", "#06b6d4",
			"#ec4899", "#f97316", "#6366f1", "#14b8a6", "#8b5cf6", "#ef4444", "#0ea5e9", "#84cc16", "#f43f5e",
			"#fb923c", "#a3e635");

	private String getAvatarColor(Long userId) {
		return AVATAR_COLORS.get((int) (userId % AVATAR_COLORS.size()));
	}

	// ─────────────────────────────────────────────────────────────────
	// Helper: time ago
	// ─────────────────────────────────────────────────────────────────
	private String timeAgo(LocalDateTime dt) {
		if (dt == null)
			return "";
		long minutes = ChronoUnit.MINUTES.between(dt, LocalDateTime.now());
		if (minutes < 1)
			return "just now";
		if (minutes < 60)
			return minutes + " min ago";
		long hours = minutes / 60;
		if (hours < 24)
			return hours + " hour ago";
		long days = hours / 24;
		if (days == 1)
			return "Yesterday";
		return days + " days ago";
	}

	// ─────────────────────────────────────────────────────────────────
	// Helper: healthStatus → UI string
	// ─────────────────────────────────────────────────────────────────
	private String toUiStatus(String healthStatus) {
		if (healthStatus == null)
			return "On Track";
		switch (healthStatus) {
		case "AT_RISK":
			return "At Risk";
		case "DELAYED":
			return "Delayed";
		default:
			return "On Track";
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Helper: priority → UI color name
	// ─────────────────────────────────────────────────────────────────
	private String toPriorityColor(String priority) {
		if (priority == null)
			return "amber";
		switch (priority) {
		case "CRITICAL":
		case "HIGH":
			return "red";
		default:
			return "amber";
		}
	}

	// =================================================================
	// ① STATS GET /api/dashboard/pm/stats
	// → { total, active, overdue, members }
	// =================================================================
	@GetMapping("/stats")
	public ResponseEntity<StatsResponse> getStats(@AuthenticationPrincipal User user) {

		// List<Project> projects = projectRepository.findByPmId(user.getId());
		List<Project> projects = projectService.getMyActiveProjects(user.getId());
		List<Long> pIds = projects.stream().map(Project::getId).collect(Collectors.toList());

		long active = projects.stream().filter(p -> "ACTIVE".equals(p.getStatus())).count();

		long overdue = pIds.isEmpty() ? 0 : taskRepository.findOverdueTasks(pIds, LocalDate.now()).size();

		Set<Long> memberIds = new HashSet<>();
		for (Long pid : pIds)
			projectMemberRepository.findByProjectIdAndStatus(pid, "ACTIVE").forEach(m -> memberIds.add(m.getUserId()));

		StatsResponse res = new StatsResponse();
		res.setTotal((long) projects.size());
		res.setActive(active);
		res.setOverdue(overdue);
		res.setMembers((long) memberIds.size());
		return ResponseEntity.ok(res);
	}

	// =================================================================
	// ② ACTIVE PROJECTS GET /api/dashboard/pm/active-projects
	// → [ { name, progress, color } ] ← ActiveProject interface
	// =================================================================
	@GetMapping("/active-projects")
	public ResponseEntity<List<ActiveProjectResponse>> getActiveProjects(@AuthenticationPrincipal User user) {

		// ✅ ProjectService ကနေ ဆွဲ
		List<ActiveProjectResponse> result = projectService.getMyActiveProjects(user.getId()).stream()
				.filter(p -> "ACTIVE".equals(p.getStatus())).map(p -> {
					ActiveProjectResponse r = new ActiveProjectResponse();
					r.setId(p.getId());
					r.setName(p.getTitle());
					r.setProgress(p.getProgress() != null ? p.getProgress() : 0);
					r.setColor(p.getColor() != null ? p.getColor() : "#16a34a");
					return r;
				}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ③ PORTFOLIO GET /api/dashboard/pm/portfolio
	// → [ { name, status, progress, owner, ownerInitial,
	// ownerColor, dueDate, health } ] ← PortfolioProject
	// =================================================================
	@GetMapping("/portfolio")
	public ResponseEntity<List<PortfolioProjectResponse>> getPortfolio(@AuthenticationPrincipal User user) {

		List<PortfolioProjectResponse> result = new ArrayList<>();

		for (Project p : projectService.getMyActiveProjects(user.getId())) {
			String ownerName = "Unknown";
			String ownerInitial = "?";
			String ownerColor = "#16a34a";
			if (p.getPmId() != null) {
				Optional<User> pmOpt = userRepository.findById(p.getPmId());
				if (pmOpt.isPresent()) {
					ownerName = pmOpt.get().getName();
					ownerInitial = ownerName.substring(0, 1).toUpperCase();
					ownerColor = getAvatarColor(p.getPmId());
				}
			}

			String dueDate = p.getEndDate() != null ? p.getEndDate().format(DateTimeFormatter.ofPattern("MMM d")) : "-";

			PortfolioProjectResponse r = new PortfolioProjectResponse();
			r.setName(p.getTitle());
			r.setStatus(toUiStatus(p.getHealthStatus()));
			r.setProgress(p.getProgress() != null ? p.getProgress() : 0);
			r.setOwner(ownerName);
			r.setOwnerInitial(ownerInitial);
			r.setOwnerColor(ownerColor);
			r.setDueDate(dueDate);
			r.setHealth(p.getHealthScore() != null ? p.getHealthScore() : 5);
			result.add(r);
		}

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ④ TEAM GET /api/dashboard/pm/team
	// → [ { initial, name, role, tasks, color, online } ] ← TeamMember
	// =================================================================
	@GetMapping("/team")
	public ResponseEntity<List<TeamMemberResponse>> getTeam(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());

		// ✅ ACTIVE projects ids Set
		Set<Long> activeProjectIds = projectService.getMyActiveProjects(user.getId()).stream()
				.filter(p -> "ACTIVE".equals(p.getStatus())).map(Project::getId).collect(Collectors.toSet());

		Set<Long> memberIds = new HashSet<>();
		for (Long pid : pIds)
			projectMemberRepository.findByProjectIdAndStatus(pid, "ACTIVE").forEach(m -> memberIds.add(m.getUserId()));
//        memberIds.remove(user.getId());

		Map<Long, UserRole> roleCache = new HashMap<>();
		List<TeamMemberResponse> result = new ArrayList<>();

		for (Long mid : memberIds) {
			Optional<User> uOpt = userRepository.findById(mid);
			if (uOpt.isEmpty())
				continue;
			User u = uOpt.get();

			String roleName = "Developer";
			if (u.getRoleId() != null) {
				UserRole ur = roleCache.computeIfAbsent(u.getRoleId(),
						id -> userRoleRepository.findById(id).orElse(null));
				if (ur != null)
					roleName = ur.getDisplayName();
			}

			// ✅ ACTIVE project ထဲကသာ + DONE မဟုတ်တာ
			long taskCount = taskRepository.findByAssigneeId(mid).stream()
					.filter(t -> activeProjectIds.contains(t.getProjectId())).filter(t -> !"DONE".equals(t.getStatus()))
					.count();

			boolean online = u.getLastSeen() != null
					&& ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;

			TeamMemberResponse tm = new TeamMemberResponse();
			tm.setInitial(u.getName().substring(0, 1).toUpperCase());
			tm.setName(u.getName());
			tm.setRole(roleName);
			tm.setTasks(taskCount);
			tm.setColor(getAvatarColor(mid));
			tm.setOnline(online);
			result.add(tm);
		}

		result.sort(Comparator.comparingLong(TeamMemberResponse::getTasks).reversed());
		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑤ MY TASKS GET /api/dashboard/pm/my-tasks
	// → [ { title, project, priority, due, status, statusColor, done } ]
	// ← MyTask interface
	// =================================================================
	@GetMapping("/my-tasks")
	public ResponseEntity<List<MyTaskResponse>> getMyTasks(@AuthenticationPrincipal User user) {

		// 1. Login user ရဲ့ ACTIVE projects အကုန်
		List<Project> myProjects = projectService.getMyActiveProjects(user.getId());

		// 2. ACTIVE projects ထဲကသာ — Set ဖြင့် filter အမြန်
		Set<Long> activeProjectIds = myProjects.stream().filter(p -> "ACTIVE".equals(p.getStatus())) // ← ACTIVE only
				.map(Project::getId).collect(Collectors.toSet());

		if (activeProjectIds.isEmpty())
			return ResponseEntity.ok(Collections.emptyList());

		// 3. project name map
		Map<Long, String> pNames = myProjects.stream().collect(Collectors.toMap(Project::getId, Project::getTitle));

		// 4. assignee tasks ဆွဲ → ACTIVE project + DONE မဟုတ်တာ filter
		LocalDate today = LocalDate.now();

		List<MyTaskResponse> result = taskRepository.findByAssigneeId(user.getId()).stream()
				.filter(t -> activeProjectIds.contains(t.getProjectId())) // ← ACTIVE project စစ်
				.filter(t -> !"DONE".equals(t.getStatus())) // ← DONE ဖယ်
				.map(t -> {
					String projectName = pNames.getOrDefault(t.getProjectId(), "");
					String dueStr = "-";
					String status = t.getStatus() != null ? t.getStatus() : "TO_DO";
					String statusColor = "#6366f1";

					if (t.getDueDate() != null) {
						long diff = ChronoUnit.DAYS.between(today, t.getDueDate());
						if (diff < 0) {
							long d = Math.abs(diff);
							dueStr = d + " day" + (d > 1 ? "s" : "") + " overdue";
							status = "Overdue";
						} else if (diff == 0) {
							dueStr = "Due Today";
						} else {
							dueStr = "Due " + t.getDueDate().format(DateTimeFormatter.ofPattern("MMM d"));
						}
					}

					switch (status) {
					case "Overdue":
						statusColor = "#ef4444";
						break;
					case "IN_PROGRESS":
						statusColor = "#f59e0b";
						status = "In Progress";
						break;
					case "IN_REVIEW":
						statusColor = "#3b82f6";
						status = "In Review";
						break;
					case "TO_DO":
						statusColor = "#6366f1";
						status = "To Do";
						break;
					}

					String priorityColor = "blue";
					if (t.getPriority() != null) {
						switch (t.getPriority()) {
						case "CRITICAL":
						case "HIGH":
							priorityColor = "red";
							break;
						case "MEDIUM":
							priorityColor = "yellow";
							break;
						case "LOW":
							priorityColor = "green";
							break;
						}
					}

					MyTaskResponse r = new MyTaskResponse();
					r.setTitle(t.getTitle());
					r.setProject(projectName);
					r.setPriority(priorityColor);
					r.setDue(dueStr);
					r.setStatus(status);
					r.setStatusColor(statusColor);
					r.setDone(false); // ← DONE filter ဖယ်ပြီးသားဆို အမြဲ false
					return r;
				}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑥ OVERDUE TASKS GET /api/dashboard/pm/overdue-tasks
	// → [ { title, project, daysOverdue, priority } ] ← OverdueTask
	// =================================================================
	@GetMapping("/overdue-tasks")
	public ResponseEntity<List<OverdueTaskResponse>> getOverdueTasks(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());
		if (pIds.isEmpty())
			return ResponseEntity.ok(Collections.emptyList());

		LocalDate today = LocalDate.now();
		Map<Long, String> pNames = new HashMap<>();
		// projectRepository.findByPmId(user.getId())
		projectService.getMyActiveProjects(user.getId()).forEach(p -> pNames.put(p.getId(), p.getTitle()));

		List<OverdueTaskResponse> result = taskRepository.findOverdueTasks(pIds, today).stream().map(t -> {
			OverdueTaskResponse r = new OverdueTaskResponse();
			r.setTitle(t.getTitle());
			r.setProject(pNames.getOrDefault(t.getProjectId(), ""));
			r.setDaysOverdue(ChronoUnit.DAYS.between(t.getDueDate(), today));
			r.setPriority(toPriorityColor(t.getPriority()));
			return r;
		}).sorted(Comparator.comparingLong(OverdueTaskResponse::getDaysOverdue).reversed())
				.collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑦ ACTIVITIES GET /api/dashboard/pm/activities
	// → [ { user, initial, color, action, time } ] ← Activity
	// =================================================================
	@GetMapping("/activities")
	public ResponseEntity<List<ActivityResponse>> getActivities(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());
		if (pIds.isEmpty())
			return ResponseEntity.ok(Collections.emptyList());

		List<ActivityLog> logs = new ArrayList<>();
		for (Long pid : pIds)
			logs.addAll(activityLogRepository.findByProjectIdOrderByCreatedAtDesc(pid));
		logs.sort(Comparator.comparing(ActivityLog::getCreatedAt).reversed());

		Map<Long, User> uCache = new HashMap<>();
		List<ActivityResponse> result = logs.stream().limit(20).map(log -> {
			User u = uCache.computeIfAbsent(log.getUserId(), id -> userRepository.findById(id).orElse(null));
			if (u == null)
				return null;
			ActivityResponse r = new ActivityResponse();
			r.setUser(u.getName());
			r.setInitial(u.getName().substring(0, 1).toUpperCase());
			r.setColor(getAvatarColor(u.getId()));
			r.setAction(log.getAction());
			r.setTime(timeAgo(log.getCreatedAt()));
			return r;
		}).filter(Objects::nonNull).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑧ DEADLINES GET /api/dashboard/pm/deadlines
	// → [ { project, task, date, status } ] ← Deadline interface
	// =================================================================
	@GetMapping("/deadlines")
	public ResponseEntity<List<DeadlineResponse>> getDeadlines(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());
		if (pIds.isEmpty())
			return ResponseEntity.ok(Collections.emptyList());

		LocalDate today = LocalDate.now();
		LocalDate maxDate = today.plusDays(14);
		Map<Long, String> pNames = new HashMap<>();
		// projectRepository.findByPmId(user.getId())
		projectService.getMyActiveProjects(user.getId()).forEach(p -> pNames.put(p.getId(), p.getTitle()));

		List<DeadlineResponse> result = taskRepository.findUpcomingDeadlines(pIds, today, maxDate).stream().map(t -> {
			long daysLeft = ChronoUnit.DAYS.between(today, t.getDueDate());
			DeadlineResponse r = new DeadlineResponse();
			r.setProject(pNames.getOrDefault(t.getProjectId(), ""));
			r.setTask(t.getTitle()); // ← task
			r.setDate(t.getDueDate().format(DateTimeFormatter.ofPattern("MMM d")));
			r.setStatus(daysLeft <= 3 ? "urgent" : daysLeft <= 7 ? "soon" : "normal");
			return r;
		}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑨ ANNOUNCEMENTS GET /api/dashboard/pm/announcements
	// → [ { id, pinned, tag, tagColor, title, text, meta, time } ]
	// ← Announcement interface
	// =================================================================
	@GetMapping("/announcements")
	public ResponseEntity<List<AnnouncementResponse>> getAnnouncements(@AuthenticationPrincipal User user) {

		Long branchId = user.getBranchId() != null ? user.getBranchId() : 0L;
		List<Long> pIds = getProjectIds(user.getId());
		if (pIds.isEmpty())
			pIds = Collections.singletonList(0L);

		Map<Long, User> authorCache = new HashMap<>();

		List<AnnouncementResponse> result = announcementRepository.findForDashboard(branchId, pIds).stream().map(a -> {
			User author = authorCache.computeIfAbsent(a.getAuthorId(), id -> userRepository.findById(id).orElse(null));
			String authorName = author != null ? author.getName() : "Unknown";

			String tag = "📌 INFO", tagColor = "#64748b";
			if (a.getTargetScope() != null) {
				switch (a.getTargetScope()) {
				case "GLOBAL":
					tag = "📌 BOSS";
					tagColor = "#f59e0b";
					break;
				case "BRANCH":
					tag = "🌏 DIRECTOR";
					tagColor = "#a855f7";
					break;
				case "PROJECT":
					tag = "👔 PM";
					tagColor = "#3b82f6";
					break;
				case "ROLE":
					tag = "⚡ LEADER";
					tagColor = "#06b6d4";
					break;
				}
			}

			AnnouncementResponse r = new AnnouncementResponse();
			r.setId(a.getId());
			r.setPinned(false);
			r.setTag(tag);
			r.setTagColor(tagColor);
			r.setTitle(a.getTitle());
			r.setText(a.getContent()); // ← text
			r.setMeta(authorName);
			r.setTime(timeAgo(a.getCreatedAt()));
			return r;
		}).collect(Collectors.toList());

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// ⑩ TASK STATS GET /api/dashboard/pm/task-stats
	// → { todo, inProgress, inReview, done, total }
	// =================================================================
	@GetMapping("/task-stats")
	public ResponseEntity<TaskStatsResponse> getTaskStats(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());
		if (pIds.isEmpty()) {
			TaskStatsResponse empty = new TaskStatsResponse();
			empty.setTodo(0L);
			empty.setInProgress(0L);
			empty.setInReview(0L);
			empty.setDone(0L);
			empty.setTotal(0L);
			return ResponseEntity.ok(empty);
		}

		List<Task> allTasks = new ArrayList<>();
		for (Long pid : pIds)
			allTasks.addAll(taskRepository.findByProjectId(pid));

		long todo = allTasks.stream().filter(t -> "TODO".equals(t.getStatus())).count();
		long inProgress = allTasks.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count();
		long inReview = allTasks.stream().filter(t -> "IN_REVIEW".equals(t.getStatus())).count();
		long done = allTasks.stream().filter(t -> "DONE".equals(t.getStatus())).count();

		TaskStatsResponse res = new TaskStatsResponse();
		res.setTodo(todo);
		res.setInProgress(inProgress);
		res.setInReview(inReview);
		res.setDone(done);
		res.setTotal(todo + inProgress + inReview + done);
		return ResponseEntity.ok(res);
	}
	
	//=================================================================
	//⑪ CHART DATA  GET /api/dashboard/pm/chart-data
	//→ [ { month, done, inProgress, todo } ]  ← last 6 months
	//=================================================================
	@GetMapping("/chart-data")
	public ResponseEntity<List<ChartDataResponse>> getChartData(@AuthenticationPrincipal User user) {

		List<Long> pIds = getProjectIds(user.getId());
		List<ChartDataResponse> result = new ArrayList<>();

		for (int i = 5; i >= 0; i--) {
			LocalDate monthStart = LocalDate.now().minusMonths(i).withDayOfMonth(1);
			LocalDate monthEnd = monthStart.plusMonths(1).minusDays(1);

			List<Task> monthTasks = new ArrayList<>();
			if (!pIds.isEmpty()) {
				for (Long pid : pIds)
					taskRepository.findByProjectId(pid).stream()
							.filter(t -> t.getCreatedAt() != null
									&& !t.getCreatedAt().toLocalDate().isBefore(monthStart)
									&& !t.getCreatedAt().toLocalDate().isAfter(monthEnd))
							.forEach(monthTasks::add);
			}

			long done = monthTasks.stream().filter(t -> "DONE".equals(t.getStatus())).count();
			long inProgress = monthTasks.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count();
			long todo = monthTasks.stream().filter(t -> "TODO".equals(t.getStatus())).count();

			ChartDataResponse r = new ChartDataResponse();
			r.setMonth(monthStart.format(DateTimeFormatter.ofPattern("MMM")));
			r.setDone(done);
			r.setInProgress(inProgress);
			r.setTodo(todo);
			result.add(r);
		}

		return ResponseEntity.ok(result);
	}

	// =================================================================
	// DTO inner classes — UI interface နဲ့ အတိအကျ ကိုက်
	// =================================================================

	@Data
	public static class StatsResponse {
		private Long total;
		private Long active;
		private Long overdue;
		private Long members;
	}

	@Data
	public static class ActiveProjectResponse {
		private Long id;
		private String name;
		private Integer progress;
		private String color;
	}

	@Data
	public static class PortfolioProjectResponse {
		private String name;
		private String status; // "On Track" | "At Risk" | "Delayed"
		private Integer progress;
		private String owner;
		private String ownerInitial;
		private String ownerColor;
		private String dueDate;
		private Integer health; // 1~5
	}

	@Data
	public static class TeamMemberResponse {
		private String initial;
		private String name;
		private String role;
		private Long tasks; // ← tasks (not taskCount)
		private String color; // ← color (not roleColor)
		private Boolean online;
	}

	@Data
	public static class MyTaskResponse {
		private String title;
		private String project;
		private String priority; // "red"|"yellow"|"blue"|"green"
		private String due;
		private String status;
		private String statusColor;
		private Boolean done;
	}

	@Data
	public static class OverdueTaskResponse {
		private String title;
		private String project;
		private Long daysOverdue;
		private String priority; // "red" | "amber"
	}

	@Data
	public static class ActivityResponse {
		private String user;
		private String initial;
		private String color;
		private String action;
		private String time;
	}

	@Data
	public static class DeadlineResponse {
		private String project;
		private String task; // ← task (not title)
		private String date;
		private String status; // "urgent"|"soon"|"normal"
	}

	@Data
	public static class AnnouncementResponse {
		private Long id;
		private Boolean pinned;
		private String tag;
		private String tagColor;
		private String title;
		private String text; // ← text (not content)
		private String meta;
		private String time;
	}

	@Data
	public static class TaskStatsResponse {
		private Long todo;
		private Long inProgress;
		private Long inReview;
		private Long done;
		private Long total;
	}

	@Data
	public static class ChartDataResponse {
		private String month;
		private Long done;
		private Long inProgress;
		private Long todo;
	}

}