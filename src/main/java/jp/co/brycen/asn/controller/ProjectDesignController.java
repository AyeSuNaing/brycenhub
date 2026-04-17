package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.ProjectDesignDto;
import jp.co.brycen.asn.repository.ProjectApiEndpointRepository;
import jp.co.brycen.asn.repository.ProjectDbTableRepository;
import jp.co.brycen.asn.service.ProjectDesignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-design")
@RequiredArgsConstructor
public class ProjectDesignController {

    private final ProjectDesignService projectDesignService;
    private final ProjectApiEndpointRepository apiEndpointRepo;
    private final ProjectDbTableRepository dbTableRepo;

    // POST /api/project-design/save
    // Design Tool ကနေ generate ပြီးရင် call လုပ်
    @PostMapping("/save")
    public ResponseEntity<Void> save(@RequestBody ProjectDesignDto.SaveRequest req) {
        projectDesignService.saveGenerated(req);
        return ResponseEntity.ok().build();
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
