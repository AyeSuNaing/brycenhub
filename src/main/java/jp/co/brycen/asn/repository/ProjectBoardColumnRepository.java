package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectBoardColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectBoardColumnRepository
        extends JpaRepository<ProjectBoardColumn, Long> {

    List<ProjectBoardColumn> findByProjectIdOrderByPosition(Long projectId);

    void deleteByProjectId(Long projectId);
}
