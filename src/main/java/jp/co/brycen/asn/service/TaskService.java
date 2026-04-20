package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.TaskDto;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.Task;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Slf4j
@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ActivityLogService activityLogService;

    // ══════════════════════════════════════════════════════════════════
    // GET methods
    // ══════════════════════════════════════════════════════════════════

    public List<Task> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectIdAndParentTaskIdIsNull(projectId);
    }

    public List<Task> getTasksByProjectAndStatus(Long projectId, String status) {
        return taskRepository.findByProjectIdAndStatus(projectId, status);
    }

    public List<Task> getTasksBySprint(Long projectId, Long sprintId) {
        return taskRepository.findByProjectIdAndSprintId(projectId, sprintId);
    }

    public List<Task> getSubTasks(Long parentTaskId) {
        return taskRepository.findByParentTaskId(parentTaskId);
    }

    public List<Task> getMyTasks(Long userId) {
        return taskRepository.findByAssigneeId(userId);
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
    }

    // ══════════════════════════════════════════════════════════════════
    // CREATE task — with activity log + progress sync
    // ══════════════════════════════════════════════════════════════════
    @Transactional
    public Task createTask(TaskDto.CreateTaskRequest request, Long createdBy) {
        if (!projectRepository.existsById(request.getProjectId())) {
            throw new RuntimeException("Project not found");
        }
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProjectId(request.getProjectId());
        task.setSprintId(request.getSprintId());
        task.setParentTaskId(request.getParentTaskId());
        task.setPriority(request.getPriority() != null ? request.getPriority() : "MEDIUM");
        task.setLabel(request.getLabel());
        task.setAssigneeId(request.getAssigneeId());
        task.setReporterId(createdBy);
        task.setDueDate(request.getDueDate());
        task.setEstimatedHours(request.getEstimatedHours());
        task.setStatus(request.getStatus() != null && !request.getStatus().isBlank()
                ? request.getStatus()
                : "TODO");
        task.setPosition(0);
        Task saved = taskRepository.save(task);

        // ── Activity log ──
        try {
            activityLogService.log(
                    createdBy,
                    "TASK_CREATED",
                    "TASK",
                    saved.getId(),
                    null,
                    saved.getTitle(),
                    saved.getProjectId()
            );
        } catch (Exception e) {
            log.warn("[TaskService] activity log failed for createTask: {}", e.getMessage());
        }

        // ── Progress sync ──
        syncProjectProgress(saved.getProjectId());

        return saved;
    }

    // ══════════════════════════════════════════════════════════════════
    // UPDATE task — with activity log + progress sync
    // ══════════════════════════════════════════════════════════════════
    @Transactional
    public Task updateTask(Long id, TaskDto.UpdateTaskRequest request) {
        Task task = getTaskById(id);

        String oldStatus = task.getStatus();
        String oldTitle = task.getTitle();
        Long oldAssigneeId = task.getAssigneeId();

        if (request.getTitle() != null) task.setTitle(request.getTitle());
        if (request.getDescription() != null) task.setDescription(request.getDescription());
        if (request.getStatus() != null) task.setStatus(request.getStatus());
        if (request.getPriority() != null) task.setPriority(request.getPriority());
        if (request.getLabel() != null) task.setLabel(request.getLabel());
        if (request.getAssigneeId() != null) task.setAssigneeId(request.getAssigneeId());
        if (request.getSprintId() != null) task.setSprintId(request.getSprintId());
        if (request.getDueDate() != null) task.setDueDate(request.getDueDate());
        if (request.getEstimatedHours() != null) task.setEstimatedHours(request.getEstimatedHours());
        if (request.getActualHours() != null) task.setActualHours(request.getActualHours());
        if (request.getPosition() != null) task.setPosition(request.getPosition());
        Task saved = taskRepository.save(task);

        // ── Activity log (priority: status > assignee > title) ──
        try {
            Long actorId = saved.getReporterId() != null ? saved.getReporterId() : 1L;

            if (!Objects.equals(oldStatus, saved.getStatus())) {
                activityLogService.log(
                        actorId, "TASK_MOVED", "TASK", saved.getId(),
                        oldStatus, saved.getStatus(), saved.getProjectId()
                );
            } else if (!Objects.equals(oldAssigneeId, saved.getAssigneeId())) {
                activityLogService.log(
                        actorId, "TASK_ASSIGNED", "TASK", saved.getId(),
                        oldAssigneeId != null ? String.valueOf(oldAssigneeId) : null,
                        saved.getAssigneeId() != null ? String.valueOf(saved.getAssigneeId()) : null,
                        saved.getProjectId()
                );
            } else if (!Objects.equals(oldTitle, saved.getTitle())) {
                activityLogService.log(
                        actorId, "TASK_UPDATED", "TASK", saved.getId(),
                        oldTitle, saved.getTitle(), saved.getProjectId()
                );
            }
        } catch (Exception e) {
            log.warn("[TaskService] activity log failed for updateTask: {}", e.getMessage());
        }

        // ── Progress sync (only if status changed) ──
        if (!Objects.equals(oldStatus, saved.getStatus())) {
            syncProjectProgress(saved.getProjectId());
        }

        return saved;
    }

    // ══════════════════════════════════════════════════════════════════
    // UPDATE status only — Kanban drag & drop
    // ══════════════════════════════════════════════════════════════════
    @Transactional
    public Task updateStatus(Long id, TaskDto.UpdateStatusRequest request) {
        Task task = getTaskById(id);
        String oldStatus = task.getStatus();

        task.setStatus(request.getStatus());
        if (request.getPosition() != null) task.setPosition(request.getPosition());
        Task saved = taskRepository.save(task);

        if (!Objects.equals(oldStatus, saved.getStatus())) {
            try {
                Long actorId = saved.getReporterId() != null ? saved.getReporterId() : 1L;
                activityLogService.log(
                        actorId, "TASK_MOVED", "TASK", saved.getId(),
                        oldStatus, saved.getStatus(), saved.getProjectId()
                );
            } catch (Exception e) {
                log.warn("[TaskService] activity log failed for updateStatus: {}", e.getMessage());
            }

            syncProjectProgress(saved.getProjectId());
        }

        return saved;
    }

    // ══════════════════════════════════════════════════════════════════
    // DELETE task — with activity log + progress sync
    // ══════════════════════════════════════════════════════════════════
    @Transactional
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Long projectId = task.getProjectId();
        String title = task.getTitle();
        Long actorId = task.getReporterId() != null ? task.getReporterId() : 1L;

        taskRepository.deleteById(id);

        try {
            activityLogService.log(
                    actorId, "TASK_DELETED", "TASK", id,
                    title, null, projectId
            );
        } catch (Exception e) {
            log.warn("[TaskService] activity log failed for deleteTask: {}", e.getMessage());
        }

        syncProjectProgress(projectId);
    }

    // ══════════════════════════════════════════════════════════════════
    // PRIVATE: sync project progress from tasks
    // Formula: round(DONE_count / active_count * 100)
    // CANCELLED tasks are excluded from denominator
    // ══════════════════════════════════════════════════════════════════
    private void syncProjectProgress(Long projectId) {
        if (projectId == null) return;
        try {
            List<Task> all = taskRepository.findByProjectIdAndParentTaskIdIsNull(projectId);
            long active = all.stream()
                    .filter(t -> !"CANCELLED".equalsIgnoreCase(t.getStatus()))
                    .count();
            long done = all.stream()
                    .filter(t -> "DONE".equalsIgnoreCase(t.getStatus()))
                    .count();

            int newProgress = active == 0 ? 0 : (int) Math.round((done * 100.0) / active);

            Project p = projectRepository.findById(projectId).orElse(null);
            if (p == null) return;

            Integer current = p.getProgress() == null ? 0 : p.getProgress();
            if (current != newProgress) {
                p.setProgress(newProgress);
                projectRepository.save(p);
                log.debug("[TaskService] synced project {} progress: {}% -> {}%",
                        projectId, current, newProgress);
            }
        } catch (Exception e) {
            log.warn("[TaskService] syncProjectProgress failed: {}", e.getMessage());
        }
    }
}