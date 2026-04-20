package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectDbTable;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ProjectDbTableRepository extends JpaRepository<ProjectDbTable, Long> {

    // ── Existing ─────────────────────────────────────────────
    List<ProjectDbTable> findByProjectIdOrderByTableName(Long projectId);

    // ── NEW ✅ Latest N (newest first, by ID desc) ───────────
    // Usage: PageRequest.of(0, 5) → returns latest 5 tables
    List<ProjectDbTable> findByProjectIdOrderByIdDesc(Long projectId, Pageable pageable);

    // ── NEW ✅ For AI merge — find existing table by (projectId, tableName) ───
    java.util.Optional<ProjectDbTable> findByProjectIdAndTableName(Long projectId, String tableName);

    @Transactional
    void deleteByProjectIdAndFrameName(Long projectId, String frameName);
    
    
}