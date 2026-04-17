package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectDbTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ProjectDbTableRepository extends JpaRepository<ProjectDbTable, Long> {
    List<ProjectDbTable> findByProjectIdOrderByTableName(Long projectId);

    @Transactional
    void deleteByProjectIdAndFrameName(Long projectId, String frameName);
}
