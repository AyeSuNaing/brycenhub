package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.service.ProjectCommitsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Git commits endpoint — fetches commit history from GitHub for a project.
 * Created: 2026-04-19
 */
@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/project-commits")
public class ProjectCommitsController {

    @Autowired private ProjectCommitsService commitsService;
    @Autowired private ProjectRepository     projectRepo;

    /**
     * GET /api/project-commits/{projectId}?limit=10
     * Returns recent commits from the GitHub repo linked to this project.
     */
    @GetMapping("/{projectId}")
    public ResponseEntity<?> getCommits(
            @PathVariable Long projectId,
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        try {
            Map<String, Object> result = commitsService.fetchCommits(projectId, limit);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                Map.of("error", "FETCH_FAILED", "message", e.getMessage())
            );
        }
    }

    /**
     * PUT /api/project-commits/{projectId}/repo
     * Body: { "repoUrl": "https://github.com/owner/repo", "githubToken": "optional" }
     * Updates the repo URL and optional token for a project.
     */
    @PutMapping("/{projectId}/repo")
    public ResponseEntity<?> updateRepo(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> body) {

        String repoUrl     = body.get("repoUrl");
        String githubToken = body.get("githubToken");

        if (repoUrl == null || repoUrl.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "repoUrl is required")
            );
        }

        try {
            Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

            project.setRepoUrl(repoUrl.trim());
            if (githubToken != null) {
                project.setGithubToken(githubToken.trim().isEmpty() ? null : githubToken.trim());
            }

            projectRepo.save(project);

            return ResponseEntity.ok(Map.of(
                "projectId", projectId,
                "repoUrl",   project.getRepoUrl(),
                "hasToken",  project.getGithubToken() != null
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(
                Map.of("error", e.getMessage())
            );
        }
    }
}
