package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectTechStack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectTechStackRepository
        extends JpaRepository<ProjectTechStack, Long> {

    List<ProjectTechStack> findByProjectIdOrderByPosition(Long projectId);

    void deleteByProjectId(Long projectId);
}
