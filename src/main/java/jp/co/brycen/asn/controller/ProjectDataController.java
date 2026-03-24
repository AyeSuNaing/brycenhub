package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.ProjectTechStack;
import jp.co.brycen.asn.model.ProjectBoardColumn;
import jp.co.brycen.asn.repository.ProjectTechStackRepository;
import jp.co.brycen.asn.repository.ProjectBoardColumnRepository;
import jp.co.brycen.asn.dto.AuthDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.Data;
import java.util.List;

@RestController
public class ProjectDataController {

    @Autowired
    private ProjectTechStackRepository techStackRepository;

    @Autowired
    private ProjectBoardColumnRepository boardColumnRepository;

    // ================================================================
    // POST /api/project-tech-stacks
    // ================================================================
    @PostMapping("/api/project-tech-stacks")
    public ResponseEntity<?> saveTechStack(@RequestBody TechStackRequest req) {
        try {
            ProjectTechStack ts = new ProjectTechStack();
            ts.setProjectId(req.getProjectId());
            ts.setName(req.getName());
            ts.setCategory(req.getCategory());
            ts.setPosition(req.getPosition() != null ? req.getPosition() : 0);
            return ResponseEntity.ok(techStackRepository.save(ts));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ================================================================
    // GET /api/project-tech-stacks/by-project/{projectId}
    // ================================================================
    @GetMapping("/api/project-tech-stacks/by-project/{projectId}")
    public ResponseEntity<List<ProjectTechStack>> getTechStackByProject(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(
            techStackRepository.findByProjectIdOrderByPosition(projectId));
    }

    // ================================================================
    // POST /api/project-board-columns
    // ================================================================
    @PostMapping("/api/project-board-columns")
    public ResponseEntity<?> saveBoardColumn(@RequestBody BoardColumnRequest req) {
        try {
            ProjectBoardColumn col = new ProjectBoardColumn();
            col.setProjectId(req.getProjectId());
            col.setName(req.getName());
            col.setStatusKey(req.getStatusKey());
            col.setColor(req.getColor() != null ? req.getColor() : "#6366f1");
            col.setPosition(req.getPosition() != null ? req.getPosition() : 0);
            col.setIsDone(req.getIsDone() != null ? req.getIsDone() : false);
            return ResponseEntity.ok(boardColumnRepository.save(col));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ================================================================
    // GET /api/project-board-columns/by-project/{projectId}
    // ================================================================
    @GetMapping("/api/project-board-columns/by-project/{projectId}")
    public ResponseEntity<List<ProjectBoardColumn>> getBoardColumnsByProject(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(
            boardColumnRepository.findByProjectIdOrderByPosition(projectId));
    }

    // ── Request DTOs ─────────────────────────────────────────────────

    @Data
    static class TechStackRequest {
        private Long projectId;
        private String name;
        private String category;
        private Integer position;
    }

    @Data
    static class BoardColumnRequest {
        private Long projectId;
        private String name;
        private String statusKey;
        private String color;
        private Integer position;
        private Boolean isDone;
    }
}
