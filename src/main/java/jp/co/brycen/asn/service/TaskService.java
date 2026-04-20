package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.TaskDto;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.Task;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    // GET tasks by project (main tasks only)
    public List<Task> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectIdAndParentTaskIdIsNull(projectId);
    }

    // GET tasks by project + status (Kanban column)
    public List<Task> getTasksByProjectAndStatus(Long projectId, String status) {
        return taskRepository.findByProjectIdAndStatus(projectId, status);
    }

    // GET tasks by sprint
    public List<Task> getTasksBySprint(Long projectId, Long sprintId) {
        return taskRepository.findByProjectIdAndSprintId(projectId, sprintId);
    }

    // GET sub-tasks
    public List<Task> getSubTasks(Long parentTaskId) {
        return taskRepository.findByParentTaskId(parentTaskId);
    }

    // GET my tasks
    public List<Task> getMyTasks(Long userId) {
        return taskRepository.findByAssigneeId(userId);  // ← assigneeId
    }

    // GET task by id
    public Task getTaskById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
    }

    // CREATE task
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
        task.setAssigneeId(request.getAssigneeId());      // ← assigneeId
        task.setReporterId(createdBy);                     // ← reporterId
        task.setDueDate(request.getDueDate());
        task.setEstimatedHours(request.getEstimatedHours());
        task.setStatus(request.getStatus() != null && !request.getStatus().isBlank()
                ? request.getStatus()
                : "TODO");
        task.setPosition(0);
        Task saved = taskRepository.save(task);

        // ── Auto-sync project progress (new task added) ──
        syncProjectProgress(saved.getProjectId());

        return saved;
    }

    // UPDATE task
    public Task updateTask(Long id, TaskDto.UpdateTaskRequest request) {
        Task task = getTaskById(id);
        boolean statusChanged = request.getStatus() != null
                && !request.getStatus().equals(task.getStatus());

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

        // ── Auto-sync if status changed ──
        if (statusChanged) {
            syncProjectProgress(saved.getProjectId());
        }

        return saved;
    }

    // UPDATE status only (Kanban drag & drop)
    public Task updateStatus(Long id, TaskDto.UpdateStatusRequest request) {
        Task task = getTaskById(id);
        String oldStatus = task.getStatus();
        task.setStatus(request.getStatus());
        if (request.getPosition() != null) task.setPosition(request.getPosition());
        Task saved = taskRepository.save(task);

        // ── Auto-sync if status actually changed ──
        if (!request.getStatus().equals(oldStatus)) {
            syncProjectProgress(saved.getProjectId());
        }

        return saved;
    }

    // DELETE task
    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Long projectId = task.getProjectId();
        taskRepository.deleteById(id);

        // ── Auto-sync after delete ──
        syncProjectProgress(projectId);
    }

    // ════════════════════════════════════════════════════════════════
    // 🆕 Auto-sync Project Progress
    // ════════════════════════════════════════════════════════════════
    // Formula: progress = round(DONE tasks / total tasks * 100)
    // - Excludes CANCELLED tasks from both numerator and denominator
    // - Called on: createTask, updateTask (status change), updateStatus, deleteTask
    // ════════════════════════════════════════════════════════════════
    private void syncProjectProgress(Long projectId) {
        if (projectId == null) return;

        try {
            List<Task> allTasks = taskRepository.findByProjectId(projectId);

            // Exclude CANCELLED tasks from calculation
            long totalActive = allTasks.stream()
                    .filter(t -> !"CANCELLED".equalsIgnoreCase(t.getStatus()))
                    .count();

            long doneCount = allTasks.stream()
                    .filter(t -> "DONE".equalsIgnoreCase(t.getStatus()))
                    .count();

            int progress = (totalActive == 0) ? 0
                    : (int) Math.round((doneCount * 100.0) / totalActive);

            Project project = projectRepository.findById(projectId).orElse(null);
            if (project == null) {
                log.warn("[ProgressSync] Project {} not found", projectId);
                return;
            }

            Integer oldProgress = project.getProgress() != null ? project.getProgress() : 0;
            if (!oldProgress.equals(progress)) {
                project.setProgress(progress);
                projectRepository.save(project);
                log.info("[ProgressSync] Project {} progress: {}% → {}% ({}/{} done)",
                        projectId, oldProgress, progress, doneCount, totalActive);
            }
        } catch (Exception e) {
            // Don't fail the main operation — just log
            log.error("[ProgressSync] Failed for project {}: {}", projectId, e.getMessage());
        }
    }
}