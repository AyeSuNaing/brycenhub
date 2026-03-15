package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.TaskDto;
import jp.co.brycen.asn.model.Task;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

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
        task.setStatus("TODO");
        task.setPosition(0);
        return taskRepository.save(task);
    }

    // UPDATE task
    public Task updateTask(Long id, TaskDto.UpdateTaskRequest request) {
        Task task = getTaskById(id);
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
        return taskRepository.save(task);
    }

    // UPDATE status only (Kanban drag & drop)
    public Task updateStatus(Long id, TaskDto.UpdateStatusRequest request) {
        Task task = getTaskById(id);
        task.setStatus(request.getStatus());
        if (request.getPosition() != null) task.setPosition(request.getPosition());
        return taskRepository.save(task);
    }

    // DELETE task
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new RuntimeException("Task not found");
        }
        taskRepository.deleteById(id);
    }
}
