package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Sprint;
import jp.co.brycen.asn.service.SprintService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    @Autowired
    private SprintService sprintService;

    @Data
    static class SprintRequest {
        private Long projectId;
        private String name;
        private String goal;
        private LocalDate startDate;
        private LocalDate endDate;
    }

    @Data
    static class StatusRequest {
        private String status;
    }

    // GET /api/sprints/by-project/{projectId}
    @GetMapping("/by-project/{projectId}")
    public ResponseEntity<List<Sprint>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(sprintService.getSprintsByProject(projectId));
    }

    // GET /api/sprints/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(sprintService.getSprintById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // POST /api/sprints
    @PostMapping
    public ResponseEntity<?> createSprint(@RequestBody SprintRequest request) {
        try {
            Sprint sprint = sprintService.createSprint(
                    request.getProjectId(), request.getName(),
                    request.getGoal(), request.getStartDate(), request.getEndDate());
            return ResponseEntity.ok(sprint);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PATCH /api/sprints/{id}/status
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody StatusRequest request) {
        try {
            return ResponseEntity.ok(
                    sprintService.updateSprintStatus(id, request.getStatus()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // DELETE /api/sprints/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSprint(@PathVariable Long id) {
        try {
            sprintService.deleteSprint(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Sprint deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
