package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.TaskDto;
import jp.co.brycen.asn.model.Task;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    @Autowired
    private TaskService taskService;

    // GET /api/tasks/by-project/{projectId}
    @GetMapping("/by-project/{projectId}")
    public ResponseEntity<List<Task>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(taskService.getTasksByProject(projectId));
    }

    // GET /api/tasks/by-project/{projectId}/status/{status}
    // Kanban column တစ်ခုချင်း ယူတာ
    @GetMapping("/by-project/{projectId}/status/{status}")
    public ResponseEntity<List<Task>> getByStatus(
            @PathVariable Long projectId,
            @PathVariable String status) {
        return ResponseEntity.ok(
                taskService.getTasksByProjectAndStatus(projectId, status));
    }

    // GET /api/tasks/by-project/{projectId}/sprint/{sprintId}
    @GetMapping("/by-project/{projectId}/sprint/{sprintId}")
    public ResponseEntity<List<Task>> getBySprint(
            @PathVariable Long projectId,
            @PathVariable Long sprintId) {
        return ResponseEntity.ok(
                taskService.getTasksBySprint(projectId, sprintId));
    }

    // GET /api/tasks/{id}/subtasks
    @GetMapping("/{id}/subtasks")
    public ResponseEntity<List<Task>> getSubTasks(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getSubTasks(id));
    }

    // GET /api/tasks/my
    // ကိုယ့်ကို assign လုပ်ထားတဲ့ tasks
    @GetMapping("/my")
    public ResponseEntity<List<Task>> getMyTasks(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(taskService.getMyTasks(user.getId()));
    }

    // GET /api/tasks/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getTaskById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(taskService.getTaskById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // POST /api/tasks
    @PostMapping
    public ResponseEntity<?> createTask(
            @Valid @RequestBody TaskDto.CreateTaskRequest request,
            @AuthenticationPrincipal User user) {
        try {
            Task task = taskService.createTask(request, user.getId());
            return ResponseEntity.ok(task);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PUT /api/tasks/{id}
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTask(
            @PathVariable Long id,
            @RequestBody TaskDto.UpdateTaskRequest request) {
        try {
            return ResponseEntity.ok(taskService.updateTask(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PATCH /api/tasks/{id}/status
    // Kanban drag & drop
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody TaskDto.UpdateStatusRequest request) {
        try {
            return ResponseEntity.ok(taskService.updateStatus(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // DELETE /api/tasks/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable Long id) {
        try {
            taskService.deleteTask(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Task deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
