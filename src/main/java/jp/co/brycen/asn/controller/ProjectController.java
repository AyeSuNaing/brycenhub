package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.ProjectDto;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.ProjectMember;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    // GET /api/projects
    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects() {
        return ResponseEntity.ok(projectService.getAllProjects());
    }

    // GET /api/projects/by-branch/{branchId}
    @GetMapping("/by-branch/{branchId}")
    public ResponseEntity<List<Project>> getByBranch(@PathVariable Long branchId) {
        return ResponseEntity.ok(projectService.getProjectsByBranch(branchId));
    }

    // GET /api/projects/my (PM's projects)
//    @GetMapping("/my")
//    public ResponseEntity<List<Project>> getMyProjects(
//            @AuthenticationPrincipal User user) {
//        return ResponseEntity.ok(projectService.getProjectsByPm(user.getId()));
//    }
    
    @GetMapping("/my")
    public ResponseEntity<List<Project>> getMyActiveProjects(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(projectService.getMyActiveProjects(user.getId()));
    }
       

    // GET /api/projects/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getProjectById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(projectService.getProjectById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // POST /api/projects
    @PostMapping
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN')")
    public ResponseEntity<?> createProject(
            @Valid @RequestBody ProjectDto.CreateProjectRequest request,
            @AuthenticationPrincipal User user) {
        try {
            Project project = projectService.createProject(request, user.getId());
            return ResponseEntity.ok(project);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PUT /api/projects/{id}
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<?> updateProject(
            @PathVariable Long id,
            @RequestBody ProjectDto.UpdateProjectRequest request) {
        try {
            return ResponseEntity.ok(projectService.updateProject(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // DELETE /api/projects/{id}
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR')")
    public ResponseEntity<?> deleteProject(@PathVariable Long id) {
        try {
            projectService.deleteProject(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Project deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ===== MEMBERS =====

    // GET /api/projects/{id}/members
    @GetMapping("/{id}/members")
    public ResponseEntity<List<ProjectMember>> getMembers(@PathVariable Long id) {
        return ResponseEntity.ok(projectService.getProjectMembers(id));
    }

    // POST /api/projects/{id}/members
    @PostMapping("/{id}/members")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<?> addMember(
            @PathVariable Long id,
            @Valid @RequestBody ProjectDto.AddMemberRequest request) {
        try {
            ProjectMember member = projectService.addMember(id, request);
            return ResponseEntity.ok(member);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // DELETE /api/projects/{id}/members/{userId}
    @DeleteMapping("/{id}/members/{userId}")
    @PreAuthorize("hasAnyRole('BOSS', 'COUNTRY_DIRECTOR', 'ADMIN', 'PROJECT_MANAGER')")
    public ResponseEntity<?> removeMember(
            @PathVariable Long id,
            @PathVariable Long userId) {
        try {
            projectService.removeMember(id, userId);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Member removed", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
