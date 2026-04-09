package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.ProjectRule;
import jp.co.brycen.asn.service.ProjectRuleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Project Rules API
 *
 * GET    /api/projects/{projectId}/rules               ← get active rules
 * POST   /api/projects/{projectId}/rules/analyze-pdf  ← PDF → Claude → preview
 * POST   /api/projects/{projectId}/rules/confirm      ← save confirmed rules
 * POST   /api/projects/{projectId}/rules/manual       ← save 1 manual rule
 * PUT    /api/project-rules/{ruleId}                  ← update rule
 * DELETE /api/project-rules/{ruleId}                  ← soft delete
 * GET    /api/projects/{projectId}/rules/code-prompt  ← AI inject for code gen
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class ProjectRuleController {

    @Autowired
    private ProjectRuleService ruleService;

    // ── GET active rules ──────────────────────────────────────────
    @GetMapping("/api/projects/{projectId}/rules")
    public ResponseEntity<List<ProjectRule>> getRules(@PathVariable Long projectId) {
        return ResponseEntity.ok(ruleService.getActiveRules(projectId));
    }

    // ── POST analyze file → preview (NOT saved yet) ──────────────
    @PostMapping("/api/projects/{projectId}/rules/analyze-file")
    public ResponseEntity<?> analyzeFile(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File is required"));
        }
        String name  = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        boolean ok   = name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc")
                    || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".txt");
        if (!ok) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Supported formats: PDF, DOCX, XLSX, TXT"));
        }
        try {
            List<Map<String, Object>> preview = ruleService.analyzeFile(file, projectId);
            return ResponseEntity.ok(preview);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    // ── POST confirm (save preview rules after PM review) ─────────
    @PostMapping("/api/projects/{projectId}/rules/confirm")
    public ResponseEntity<?> confirmRules(
            @PathVariable Long projectId,
            @RequestBody ConfirmRequest req) {
        try {
            List<ProjectRule> saved = ruleService.confirmRules(
                projectId, req.getCreatedBy(), req.getRules());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage()));
        }
    }

    // ── POST manual rule ──────────────────────────────────────────
    @PostMapping("/api/projects/{projectId}/rules/manual")
    public ResponseEntity<?> addManual(
            @PathVariable Long projectId,
            @RequestBody ManualRuleRequest req) {
        try {
            ProjectRule.Category cat = ProjectRule.Category.valueOf(
                req.getCategory() != null ? req.getCategory() : "GENERAL");
            ProjectRule saved = ruleService.saveManual(
                projectId, req.getCreatedBy(),
                req.getTitle(), req.getContent(), cat);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ── PUT update rule ───────────────────────────────────────────
    @PutMapping("/api/project-rules/{ruleId}")
    public ResponseEntity<?> updateRule(
            @PathVariable Long ruleId,
            @RequestBody UpdateRuleRequest req) {
        try {
            ProjectRule.Category cat = null;
            if (req.getCategory() != null) {
                cat = ProjectRule.Category.valueOf(req.getCategory());
            }
            ProjectRule updated = ruleService.update(
                ruleId, req.getTitle(), req.getContent(), cat);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ── DELETE soft delete ────────────────────────────────────────
    @DeleteMapping("/api/project-rules/{ruleId}")
    public ResponseEntity<?> deleteRule(@PathVariable Long ruleId) {
        try {
            ruleService.softDelete(ruleId);
            return ResponseEntity.ok(Map.of("message", "Deleted", "success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // ── GET system prompt for code gen (Design Tool inject) ───────
    @GetMapping("/api/projects/{projectId}/rules/code-prompt")
    public ResponseEntity<?> getCodePrompt(@PathVariable Long projectId) {
        String prompt = ruleService.buildCodeGenSystemPrompt(projectId);
        return ResponseEntity.ok(Map.of("prompt", prompt, "projectId", projectId));
    }

    // ── Request DTOs ──────────────────────────────────────────────

    @Data
    public static class ConfirmRequest {
        private Long                    createdBy;
        private List<Map<String, Object>> rules;
    }

    @Data
    public static class ManualRuleRequest {
        private Long   createdBy;
        private String title;
        private String content;
        private String category; // "CODING_STANDARDS" | "PROCESS_RULES" | "GENERAL"
    }

    @Data
    public static class UpdateRuleRequest {
        private String title;
        private String content;
        private String category;
    }
}
