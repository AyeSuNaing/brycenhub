package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.ProjectDto;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.ProjectMember;
import jp.co.brycen.asn.repository.ProjectMemberRepository;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import jp.co.brycen.asn.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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

    // GET all projects
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    // GET projects by branch
    public List<Project> getProjectsByBranch(Long branchId) {
        return projectRepository.findByBranchId(branchId);
    }

    // GET projects by PM
    public List<Project> getProjectsByPm(Long pmId) {
        return projectRepository.findByPmId(pmId);
    }

    // GET project by id
    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
    }

    // CREATE project
    public Project createProject(ProjectDto.CreateProjectRequest request,
                                  Long createdBy) {
        Project project = new Project();
        project.setTitle(request.getTitle());
        project.setProjectKey(request.getProjectKey());     // ← NEW
        project.setDescription(request.getDescription());
        project.setCategory(request.getCategory());         // ← NEW
        project.setTags(request.getTags());                 // ← NEW
        project.setColor(request.getColor() != null
                ? request.getColor() : "#16a34a");          // ← NEW
        project.setPriority(request.getPriority() != null
                ? request.getPriority() : "MEDIUM");        // ← NEW
        project.setVisibility(request.getVisibility() != null
                ? request.getVisibility() : "BRANCH");      // ← NEW
        project.setHealthStatus("ON_TRACK");                // ← NEW default
        project.setHealthScore(5);                          // ← NEW default
        project.setBranchId(request.getBranchId());
        project.setPmId(request.getPmId());
        project.setClientId(request.getClientId());         // ← NEW
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setBudget(request.getBudget());
        project.setStatus("PLANNING");
        project.setProgress(0);
        project.setCreatedBy(createdBy);
        return projectRepository.save(project);
    }

    // UPDATE project
    public Project updateProject(Long id,
                                  ProjectDto.UpdateProjectRequest request) {
        Project project = getProjectById(id);

        if (request.getTitle() != null)
            project.setTitle(request.getTitle());
        if (request.getDescription() != null)
            project.setDescription(request.getDescription());
        if (request.getCategory() != null)
            project.setCategory(request.getCategory());     // ← NEW
        if (request.getTags() != null)
            project.setTags(request.getTags());             // ← NEW
        if (request.getColor() != null)
            project.setColor(request.getColor());           // ← NEW
        if (request.getStatus() != null)
            project.setStatus(request.getStatus());
        if (request.getPriority() != null)
            project.setPriority(request.getPriority());     // ← NEW
        if (request.getHealthStatus() != null)
            project.setHealthStatus(request.getHealthStatus()); // ← NEW
        if (request.getHealthScore() != null)
            project.setHealthScore(request.getHealthScore()); // ← NEW
        if (request.getVisibility() != null)
            project.setVisibility(request.getVisibility()); // ← NEW
        if (request.getPmId() != null)
            project.setPmId(request.getPmId());
        if (request.getClientId() != null)
            project.setClientId(request.getClientId());     // ← NEW
        if (request.getStartDate() != null)
            project.setStartDate(request.getStartDate());
        if (request.getEndDate() != null)
            project.setEndDate(request.getEndDate());
        if (request.getBudget() != null)
            project.setBudget(request.getBudget());
        if (request.getProgress() != null)
            project.setProgress(request.getProgress());

        return projectRepository.save(project);
    }

    // DELETE project
    public void deleteProject(Long id) {
        if (!projectRepository.existsById(id)) {
            throw new RuntimeException("Project not found");
        }
        projectRepository.deleteById(id);
    }

    // ADD member to project
    public ProjectMember addMember(Long projectId,
                                    ProjectDto.AddMemberRequest request) {
        if (!projectRepository.existsById(projectId)) {
            throw new RuntimeException("Project not found");
        }
        if (!userRepository.existsById(request.getUserId())) {
            throw new RuntimeException("User not found");
        }
        if (projectMemberRepository.existsByProjectIdAndUserIdAndStatus(
                projectId, request.getUserId(), "ACTIVE")) {
            throw new RuntimeException(
                    "User is already an active member of this project");
        }

        ProjectMember member = new ProjectMember();
        member.setProjectId(projectId);
        member.setUserId(request.getUserId());
        member.setRoleInProject(request.getRoleInProject());
        member.setStatus("ACTIVE");
        return projectMemberRepository.save(member);
    }
    
 // ✅ Login user ရဲ့ projects အကုန် (pmId + member ဖြစ်တာ နှစ်ခုလုံး)
    public List<Project> getMyActiveProjects(Long userId) {
        // 1. pmId ဖြင့် ပါတဲ့ projects
        List<Project> pmProjects = projectRepository.findByPmId(userId);
        
        // 2. project_members table မှာ ACTIVE member ဖြစ်တဲ့ projects
        List<ProjectMember> memberships = projectMemberRepository
        	    .findByUserIdAndStatus(userId, "ACTIVE");
        
        List<Long> memberProjectIds = memberships.stream()
            .map(ProjectMember::getProjectId)
            .collect(Collectors.toList());
        
        List<Project> memberProjects = projectRepository.findAllById(memberProjectIds);
        
        // 3. နှစ်ခု ပေါင်းပြီး duplicate ဖယ်
        Set<Long> seen = new HashSet<>();
        List<Project> result = new ArrayList<>();
        
        for (Project p : pmProjects) {
            if (seen.add(p.getId())) result.add(p);
        }
        for (Project p : memberProjects) {
            if (seen.add(p.getId())) result.add(p);
        }
        
        return result;
    }
    public List<ProjectDto.MemberResponse> getProjectMembersWithName(Long projectId) {
        List<ProjectMember> members = projectMemberRepository
                .findByProjectIdAndStatus(projectId, "ACTIVE");

        return members.stream().map(m -> {
            ProjectDto.MemberResponse dto = new ProjectDto.MemberResponse();
            dto.setId(m.getId());
            dto.setUserId(m.getUserId());
            dto.setRoleInProject(m.getRoleInProject());
            dto.setStatus(m.getStatus());

            userRepository.findById(m.getUserId()).ifPresent(u -> {
                dto.setUserName(u.getName());
                // initial
                dto.setInitial(u.getName().substring(0, 1).toUpperCase());
                // online — lastSeen within 5 minutes
                boolean online = u.getLastSeen() != null &&
                    ChronoUnit.MINUTES.between(u.getLastSeen(), LocalDateTime.now()) <= 5;
                dto.setOnline(online);
            });

            // task count — ဒီ project ထဲက DONE မဟုတ်တဲ့ tasks
            long taskCount = taskRepository.findByAssigneeId(m.getUserId())
                .stream()
                .filter(t -> projectId.equals(t.getProjectId()))
                .filter(t -> !"DONE".equals(t.getStatus()))
                .count();
            dto.setTasks(taskCount);

            // color
            dto.setColor(getAvatarColor(m.getUserId()));

            return dto;
        }).sorted(Comparator.comparingLong(ProjectDto.MemberResponse::getTasks).reversed())
        		.collect(Collectors.toList());
        
        
    }

    // DashboardController မှာ ရှိတဲ့ getAvatarColor ကို copy ပါ
    private String getAvatarColor(Long userId) {
        String[] colors = {
            "#6366f1","#3b82f6","#22c55e","#f59e0b",
            "#a855f7","#ec4899","#14b8a6","#f97316"
        };
        return colors[(int)(userId % colors.length)];
    }

    // GET project members
    public List<ProjectMember> getProjectMembers(Long projectId) {
        return projectMemberRepository
                .findByProjectIdAndStatus(projectId, "ACTIVE");
    }

    // REMOVE member
    public void removeMember(Long projectId, Long userId) {
        ProjectMember member = projectMemberRepository
                .findByProjectIdAndUserIdAndStatus(projectId, userId, "ACTIVE")
                .orElseThrow(() -> new RuntimeException("Member not found"));
        member.setStatus("REMOVED");
        projectMemberRepository.save(member);
    }
}
