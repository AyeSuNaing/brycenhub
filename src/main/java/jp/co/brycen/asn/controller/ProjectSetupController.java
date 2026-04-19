package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.ProjectSetupGuide;
import jp.co.brycen.asn.service.ProjectSetupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Project Setup Guide API — with iterative fix loop support
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/project-setup")
public class ProjectSetupController {

    @Autowired
    private ProjectSetupService setupService;

    @GetMapping("/{projectId}")
    public ResponseEntity<?> get(@PathVariable Long projectId) {
        ProjectSetupGuide guide = setupService.getGuide(projectId);
        if (guide == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(guide);
    }

    @PostMapping("/{projectId}/generate")
    public ResponseEntity<?> generate(
            @PathVariable Long projectId,
            @RequestParam(value = "os", defaultValue = "macos") String os) {
        try {
            ProjectSetupGuide guide = setupService.generate(projectId, os);
            return ResponseEntity.ok(guide);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                Map.of("error", "Failed to generate guide: " + e.getMessage())
            );
        }
    }

    /**
     * Fix an error with optional previous attempts for iterative refinement.
     *
     * Body:
     * {
     *   "stepTitle": "...",
     *   "command": "...",
     *   "errorOutput": "...",
     *   "previousAttempts": [
     *     {
     *       "suggestedSolution": "Use firebase SDK directly",
     *       "triedCommands": "npm install firebase",
     *       "newError": "Still getting ERESOLVE..."
     *     }
     *   ]
     * }
     */
    @PostMapping("/{projectId}/fix-error")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> fixError(
            @PathVariable Long projectId,
            @RequestParam(value = "os", defaultValue = "macos") String os,
            @RequestBody Map<String, Object> body) {
        try {
            String stepTitle   = asString(body.get("stepTitle"));
            String command     = asString(body.get("command"));
            String errorOutput = asString(body.get("errorOutput"));

            if (errorOutput == null || errorOutput.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                    Map.of("error", "errorOutput is required")
                );
            }

            // Parse previousAttempts if provided
            List<Map<String, String>> previousAttempts = null;
            Object prevRaw = body.get("previousAttempts");
            if (prevRaw instanceof List) {
                previousAttempts = (List<Map<String, String>>) prevRaw;
            }

            Map<String, Object> fix = setupService.fixError(
                projectId, stepTitle, command, errorOutput, os, previousAttempts
            );
            return ResponseEntity.ok(fix);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                Map.of("error", "Failed to analyze error: " + e.getMessage())
            );
        }
    }

    @PutMapping("/{projectId}")
    public ResponseEntity<?> save(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> body) {
        String content = body.get("content");
        if (content == null || content.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "content required"));
        }
        try {
            ProjectSetupGuide guide = setupService.save(projectId, content);
            return ResponseEntity.ok(guide);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<?> delete(@PathVariable Long projectId) {
        setupService.delete(projectId);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private String asString(Object o) {
        return o == null ? "" : o.toString();
    }
}