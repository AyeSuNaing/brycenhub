package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectApiEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ProjectApiEndpointRepository extends JpaRepository<ProjectApiEndpoint, Long> {
    List<ProjectApiEndpoint> findByProjectIdOrderByMethod(Long projectId);

    @Transactional
    void deleteByProjectIdAndFrameName(Long projectId, String frameName);
}
