package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.Sprint;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;

@Service
public class SprintService {

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private ProjectRepository projectRepository;

    public List<Sprint> getSprintsByProject(Long projectId) {
        return sprintRepository.findByProjectId(projectId);
    }

    public Sprint getSprintById(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));
    }

    public Sprint createSprint(Long projectId, String name, String goal,
                                LocalDate startDate, LocalDate endDate) {
        if (!projectRepository.existsById(projectId)) {
            throw new RuntimeException("Project not found");
        }
        Sprint sprint = new Sprint();
        sprint.setProjectId(projectId);
        sprint.setName(name);
        sprint.setGoal(goal);
        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus("PLANNED");
        return sprintRepository.save(sprint);
    }

    public Sprint updateSprintStatus(Long id, String status) {
        Sprint sprint = getSprintById(id);
        sprint.setStatus(status);
        return sprintRepository.save(sprint);
    }

    public void deleteSprint(Long id) {
        if (!sprintRepository.existsById(id)) {
            throw new RuntimeException("Sprint not found");
        }
        sprintRepository.deleteById(id);
    }
}
