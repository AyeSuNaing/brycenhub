package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.DesignBoard;
import jp.co.brycen.asn.service.DesignService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/designs")
@CrossOrigin(origins = "*")
public class DesignController {

    @Autowired
    private DesignService designService;

    // ── GET /api/designs/by-project/{projectId} ──────────────────
    @GetMapping("/by-project/{projectId}")
    public ResponseEntity<?> getByProject(@PathVariable Long projectId) {
        return designService.getByProjectId(projectId)
            .map(d -> ResponseEntity.ok(Map.of(
                "id",           d.getId(),
                "projectId",    d.getProjectId(),
                "canvasData",   d.getCanvasData() != null ? d.getCanvasData() : "",
                "thumbnailUrl", d.getThumbnailUrl() != null ? d.getThumbnailUrl() : "",
                "version",      d.getVersion(),
                "updatedAt",    d.getUpdatedAt() != null ? d.getUpdatedAt().toString() : ""
            )))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── POST /api/designs/save ────────────────────────────────────
    @PostMapping("/save")
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        Long projectId    = Long.valueOf(body.get("projectId").toString());
        String canvasData = (String) body.get("canvasData");
        String thumbnail  = (String) body.getOrDefault("thumbnailUrl", "");
        Long updatedBy    = body.get("updatedBy") != null
            ? Long.valueOf(body.get("updatedBy").toString()) : null;

        DesignBoard saved = designService.save(projectId, canvasData, thumbnail, updatedBy);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "version", saved.getVersion()
        ));
    }

    // ── DELETE /api/designs/by-project/{projectId} ───────────────
    @DeleteMapping("/by-project/{projectId}")
    public ResponseEntity<?> delete(@PathVariable Long projectId) {
        designService.deleteByProjectId(projectId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
