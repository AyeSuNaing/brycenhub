package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.ProjectDesignDto;
import jp.co.brycen.asn.repository.ProjectApiEndpointRepository;
import jp.co.brycen.asn.repository.ProjectDbTableRepository;
import jp.co.brycen.asn.service.ProjectDesignExtractService;
import jp.co.brycen.asn.service.ProjectDesignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-design")
@RequiredArgsConstructor
public class ProjectDesignController {

    private final ProjectDesignService         projectDesignService;
    private final ProjectDesignExtractService  extractService;
    private final ProjectApiEndpointRepository apiEndpointRepo;
    private final ProjectDbTableRepository     dbTableRepo;

    // POST /api/project-design/save
    @PostMapping("/save")
    public ResponseEntity<Void> save(@RequestBody ProjectDesignDto.SaveRequest req) {
        projectDesignService.saveGenerated(req);
        return ResponseEntity.ok().build();
    }

    // POST /api/project-design/extract-and-save
    // Design Tool generate ပြီးရင် call — AI extract + save
    @PostMapping("/extract-and-save")
    public ResponseEntity<?> extractAndSave(@RequestBody ProjectDesignDto.ExtractAndSaveRequest req) {
        try {
            String frameName = req.getFrameName() != null ? req.getFrameName() : "Unknown Frame";
            extractService.extractAndSave(
                req.getProjectId(),
                req.getGeneratedBy(),
                frameName,
                req.getGeneratedFiles()
            );
            return ResponseEntity.ok().body(java.util.Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    // GET /api/project-design/{projectId}/frame/{frameName}
    @GetMapping("/{projectId}/frame/{frameName}")
    public ResponseEntity<ProjectDesignDto.GeneratedFileResponse> getByFrame(
            @PathVariable Long projectId,
            @PathVariable String frameName) {
        return ResponseEntity.ok(projectDesignService.getByProjectAndFrame(projectId, frameName));
    }

    // GET /api/project-design/{projectId}/apis
    @GetMapping("/{projectId}/apis")
    public ResponseEntity<?> getApis(@PathVariable Long projectId) {
        return ResponseEntity.ok(apiEndpointRepo.findByProjectIdOrderByMethod(projectId));
    }

    // GET /api/project-design/{projectId}/db-tables
    @GetMapping("/{projectId}/db-tables")
    public ResponseEntity<?> getDbTables(@PathVariable Long projectId) {
        return ResponseEntity.ok(dbTableRepo.findByProjectIdOrderByTableName(projectId));
    }
}
