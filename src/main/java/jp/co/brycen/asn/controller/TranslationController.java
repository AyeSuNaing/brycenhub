package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.service.TranslationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/translations")
public class TranslationController {

    @Autowired
    private TranslationService translationService;

    // GET /api/translations/languages
    @GetMapping("/languages")
    public ResponseEntity<?> getSupportedLanguages() {
        return ResponseEntity.ok(translationService.getSupportedLanguages());
    }

    // GET /api/translations/task/{taskId}?lang=my
    @GetMapping("/task/{taskId}")
    public ResponseEntity<?> translateTask(
            @PathVariable Long taskId,
            @RequestParam String lang) {
        try {
            return ResponseEntity.ok(translationService.translateTask(taskId, lang));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage(), "success", false));
        }
    }

    // GET /api/translations/comment/{commentId}?lang=my
    @GetMapping("/comment/{commentId}")
    public ResponseEntity<?> translateComment(
            @PathVariable Long commentId,
            @RequestParam String lang) {
        try {
            return ResponseEntity.ok(translationService.translateComment(commentId, lang));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage(), "success", false));
        }
    }

    // ✅ NEW — GET /api/translations/project/{projectId}?lang=my
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> translateProject(
            @PathVariable Long projectId,
            @RequestParam String lang) {
        try {
            return ResponseEntity.ok(translationService.translateProject(projectId, lang));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage(), "success", false));
        }
    }
}