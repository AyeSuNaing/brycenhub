package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectSetupGuide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface ProjectSetupGuideRepository extends JpaRepository<ProjectSetupGuide, Long> {

    Optional<ProjectSetupGuide> findByProjectId(Long projectId);

    @Transactional
    void deleteByProjectId(Long projectId);
}
