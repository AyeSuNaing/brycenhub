package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.ProjectDto;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.ProjectMember;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.ProjectMemberRepository;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.DirectorCountryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private DirectorCountryRepository directorCountryRepository;

    @Autowired
    private UserRoleRepository userRoleRepository; // ← NEW

    // ═══════════════════════════════════════════════
    // GET
    // ═══════════════════════════════════════════════

    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    public List<Project> getProjectsByBranch(Long branchId) {
        return projectRepository.findByBranchId(branchId);
    }

    public List<Project> getProjectsByPm(Long pmId) {
        return projectRepository.findByPmId(pmId);
    }

    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
    }

    // ═══════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════

    public Project createProject(ProjectDto.CreateProjectRequest request, Long createdBy) {
        Project project = new Project();
        project.setTitle(request.getTitle());
        project.setProjectKey(request.getProjectKey());
        project.setDescription(request.getDescription());
        project.setCategory(request.getCategory());
        project.setTags(request.getTags());
        project.setColor(request.getColor() != null ? request.getColor() : "#16a34a");
        project.setPriority(request.getPriority() != null ? request.getPriority() : "MEDIUM");
        project.setVisibility(request.getVisibility() != null ? request.getVisibility() : "BRANCH");
        project.setHealthStatus("ON_TRACK");
        project.setHealthScore(5);
        project.setBranchId(request.getBranchId());
        project.setPmId(request.getPmId());
        project.setClientId(request.getClientId());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setBudget(request.getBudget());
        project.setOriginalLanguage(request.getOriginalLanguage());
        project.setStatus("ACTIVE");
        project.setProgress(0);
        project.setCreatedBy(createdBy);
        return projectRepository.save(project);
    }

    // ═══════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════

    public Project updateProject(Long id, ProjectDto.UpdateProjectRequest request) {
        Project project = getProjectById(id);

        if (request.getTitle()        != null) project.setTitle(request.getTitle());
        if (request.getDescription()  != null) project.setDescription(request.getDescription());
        if (request.getCategory()     != null) project.setCategory(request.getCategory());
        if (request.getTags()         != null) project.setTags(request.getTags());
        if (request.getColor()        != null) project.setColor(request.getColor());
        if (request.getStatus()       != null) project.setStatus(request.getStatus());
        if (request.getPriority()     != null) project.setPriority(request.getPriority());
        if (request.getHealthStatus() != null) project.setHealthStatus(request.getHealthStatus());
        if (request.getHealthScore()  != null) project.setHealthScore(request.getHealthScore());
        if (request.getVisibility()   != null) project.setVisibility(request.getVisibility());
        if (request.getPmId()         != null) project.setPmId(request.getPmId());
        if (request.getClientId()     != null) project.setClientId(request.getClientId());
        if (request.getStartDate()    != null) project.setStartDate(request.getStartDate());
        if (request.getEndDate()      != null) project.setEndDate(request.getEndDate());
        if (request.getBudget()       != null) project.setBudget(request.getBudget());
        if (request.getProgress()     != null) project.setProgress(request.getProgress());

        return projectRepository.save(project);
    }

    // ═══════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════

    public void deleteProject(Long id) {
        if (!projectRepository.existsById(id))
            throw new RuntimeException("Project not found");
        projectRepository.deleteById(id);
    }

    // ═══════════════════════════════════════════════
    // MEMBERS
    // ═══════════════════════════════════════════════

    public ProjectMember addMember(Long projectId, ProjectDto.AddMemberRequest request) {
        if (!projectRepository.existsById(projectId))
            throw new RuntimeException("Project not found");
        if (!userRepository.existsById(request.getUserId()))
            throw new RuntimeException("User not found");

        if (projectMemberRepository.existsByProjectIdAndUserIdAndStatus(
                projectId, request.getUserId(), "ACTIVE"))
            throw new RuntimeException("User is already an active member of this project");

        Optional<ProjectMember> removed = projectMemberRepository
                .findByProjectIdAndUserIdAndStatus(projectId, request.getUserId(), "REMOVED");
        if (removed.isPresent()) {
            ProjectMember m = removed.get();
            m.setStatus("ACTIVE");
            m.setRoleInProject(request.getRoleInProject());
            m.setJoinedAt(LocalDateTime.now());
            return projectMemberRepository.save(m);
        }

        ProjectMember member = new ProjectMember();
        member.setProjectId(projectId);
        member.setUserId(request.getUserId());
        member.setRoleInProject(request.getRoleInProject());
        member.setStatus("ACTIVE");
        return projectMemberRepository.save(member);
    }

    public void removeMember(Long projectId, Long userId) {
        ProjectMember member = projectMemberRepository
                .findByProjectIdAndUserIdAndStatus(projectId, userId, "ACTIVE")
                .orElseThrow(() -> new RuntimeException("Member not found"));
        member.setStatus("REMOVED");
        projectMemberRepository.save(member);
    }

    public List<ProjectDto.MemberResponse> getProjectMembersWithName(Long projectId) {

        // ① project_members မှ actual members
        List<ProjectDto.MemberResponse> result = new ArrayList<>(
            projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE")
                .stream().map(m -> {
                    ProjectDto.MemberResponse dto = new ProjectDto.MemberResponse();
                    dto.setId(m.getId());
                    dto.setUserId(m.getUserId());
                    dto.setRoleInProject(m.getRoleInProject());
                    dto.setDisplayName(getDisplayName(m.getRoleInProject())); // ← NEW
                    dto.setStatus(m.getStatus());
                    userRepository.findById(m.getUserId()).ifPresent(u -> {
                        dto.setUserName(u.getName());
                        dto.setInitial(u.getName().substring(0, 1).toUpperCase());
                        boolean online = u.getLastSeen() != null &&
                            ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;
                        dto.setOnline(online);
                    });
                    long taskCount = taskRepository.findByAssigneeId(m.getUserId()).stream()
                        .filter(t -> projectId.equals(t.getProjectId()))
                        .filter(t -> !"DONE".equals(t.getStatus())).count();
                    dto.setTasks(taskCount);
                    dto.setColor(getAvatarColor(m.getUserId()));
                    return dto;
                }).collect(Collectors.toList())
        );

        // ② VP / Admin / Director — merge (DB မထည့်ဘဲ response မှာပဲ ပြမည်)
        Set<Long> existingIds = result.stream()
            .map(ProjectDto.MemberResponse::getUserId).collect(Collectors.toSet());

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project != null && project.getBranchId() != null) {
            Long branchId = project.getBranchId();
            Long countryId = branchRepository.findById(branchId)
                .map(b -> b.getCountryId()).orElse(null);

            // VP (3) + Admin (4) — same branch
            userRepository.findAll().stream()
                .filter(u -> u.getBranchId() != null
                          && u.getBranchId().equals(branchId)
                          && u.getRoleId() != null
                          && (Long.valueOf(3L).equals(u.getRoleId()) || Long.valueOf(4L).equals(u.getRoleId()))
                          && !existingIds.contains(u.getId()))
                .forEach(u -> { result.add(buildMgmtDto(u, projectId)); existingIds.add(u.getId()); });

            // Director (2) — director_countries
            if (countryId != null) {
                final Long fc = countryId;
                userRepository.findAll().stream()
                    .filter(u -> Long.valueOf(2L).equals(u.getRoleId()) && !existingIds.contains(u.getId()))
                    .forEach(u -> {
                        if (directorCountryRepository.existsByDirectorIdAndCountryId(u.getId(), fc)) {
                            result.add(buildMgmtDto(u, projectId));
                            existingIds.add(u.getId());
                        }
                    });
            }
        }

        // ③ Sort: DR → VP → Admin → PM → Leader → ...
        result.sort((a, b) -> {
            int ra = getRoleOrder(a.getRoleInProject());
            int rb = getRoleOrder(b.getRoleInProject());
            return ra != rb ? Integer.compare(ra, rb) : Long.compare(b.getTasks(), a.getTasks());
        });

        return result;
    }

    private ProjectDto.MemberResponse buildMgmtDto(User u, Long projectId) {
        ProjectDto.MemberResponse dto = new ProjectDto.MemberResponse();
        dto.setId(null);
        dto.setUserId(u.getId());
        String roleInProject =
            Long.valueOf(2L).equals(u.getRoleId()) ? "COUNTRY_DIRECTOR" :
            Long.valueOf(3L).equals(u.getRoleId()) ? "VICE_PRESIDENT" : "ADMIN";
        dto.setRoleInProject(roleInProject);
        dto.setDisplayName(getDisplayName(roleInProject)); // ← NEW
        dto.setStatus("ACTIVE");
        dto.setUserName(u.getName());
        dto.setInitial(u.getName().substring(0, 1).toUpperCase());
        boolean online = u.getLastSeen() != null &&
            ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;
        dto.setOnline(online);
        dto.setTasks(0L);
        dto.setColor(getAvatarColor(u.getId()));
        return dto;
    }

    public List<ProjectDto.MemberResponse> getRemovedMembers(Long projectId) {
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "REMOVED")
            .stream().map(m -> {
                ProjectDto.MemberResponse dto = new ProjectDto.MemberResponse();
                dto.setId(m.getId());
                dto.setUserId(m.getUserId());
                dto.setRoleInProject(m.getRoleInProject());
                dto.setDisplayName(getDisplayName(m.getRoleInProject())); // ← NEW
                dto.setStatus(m.getStatus());
                userRepository.findById(m.getUserId()).ifPresent(u -> {
                    dto.setUserName(u.getName());
                    dto.setInitial(u.getName().substring(0, 1).toUpperCase());
                    dto.setOnline(false);
                });
                dto.setColor(getAvatarColor(m.getUserId()));
                return dto;
            }).collect(Collectors.toList());
    }

    public List<ProjectMember> getProjectMembers(Long projectId) {
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE");
    }

    // ═══════════════════════════════════════════════
    // AUTO-ADD HIGH ROLE MEMBERS
    // ═══════════════════════════════════════════════

    // ═══════════════════════════════════════════════
    // MY PROJECTS
    // ═══════════════════════════════════════════════

    public List<Project> getMyActiveProjects(Long userId) {
        List<Project> pmProjects = projectRepository.findByPmId(userId);
        List<Long> memberProjectIds = projectMemberRepository
                .findByUserIdAndStatus(userId, "ACTIVE").stream()
                .map(ProjectMember::getProjectId).collect(Collectors.toList());
        List<Project> memberProjects = projectRepository.findAllById(memberProjectIds);

        Set<Long> seen = new HashSet<>();
        List<Project> result = new ArrayList<>();
        for (Project p : pmProjects)     { if (seen.add(p.getId())) result.add(p); }
        for (Project p : memberProjects) { if (seen.add(p.getId())) result.add(p); }
        return result;
    }

    // ═══════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════

    // user_roles.display_name ကို DB ကနေ တိုက်ရိုက် ယူ
    private String getDisplayName(String roleInProject) {
        if (roleInProject == null) return "";
        return userRoleRepository.findByName(roleInProject)
            .map(r -> r.getDisplayName())
            .orElse(roleInProject.replace("_", " "));
    }

    private int getRoleOrder(String role) {
        if (role == null) return 99;
        switch (role) {
            case "COUNTRY_DIRECTOR": return 1;
            case "VICE_PRESIDENT":   return 2;
            case "ADMIN":            return 3;
            case "PROJECT_MANAGER":  return 4;
            case "LEADER":           return 5;
            case "UI_UX":            return 6;
            case "DEVELOPER":        return 7;
            case "QA":               return 8;
            case "CUSTOMER":         return 9;
            default:                 return 99;
        }
    }

    private String getAvatarColor(Long userId) {
        String[] colors = {
            "#6366f1","#3b82f6","#22c55e","#f59e0b",
            "#a855f7","#ec4899","#14b8a6","#f97316"
        };
        return colors[(int)(userId % colors.length)];
    }
}