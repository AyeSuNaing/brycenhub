package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.service.AiProjectService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiProjectController {

    @Autowired
    private AiProjectService aiProjectService;

    // ================================================================
    // POST /api/ai/detect-tech-stack
    // Body: { title, description }
    // Response: { techStack: ["Java","Angular","MySQL"] }
    // ================================================================
    @PostMapping("/detect-tech-stack")
    public ResponseEntity<Map<String, Object>> detectTechStack(
            @RequestBody DetectRequest request) {

        List<Map<String, String>> techStack = aiProjectService.detectTechStack(
            request.getTitle(),
            request.getDescription()
        );

        return ResponseEntity.ok(Map.of("techStack", techStack));
    }

    // ================================================================
    // POST /api/ai/suggest-team
    // Body: { techStack: ["Java","MySQL"], branchId: 3 }
    // Response: { suggested: [{ userId, name, role, matchedSkills, score, reason }] }
    // ================================================================
    @PostMapping("/suggest-team")
    public ResponseEntity<Map<String, Object>> suggestTeam(
            @RequestBody SuggestTeamRequest request) {

        List<Map<String, Object>> suggested = aiProjectService.suggestTeam(
            request.getTechStack(),
            request.getBranchId()
        );

        return ResponseEntity.ok(Map.of("suggested", suggested));
    }

    // ── Request DTOs ─────────────────────────────────────────────────

    @Data
    static class DetectRequest {
        @NotBlank
        private String title;
        private String description;
    }

    @Data
    static class SuggestTeamRequest {
        @NotNull
        private List<String> techStack;
        @NotNull
        private Long branchId;
    }
}