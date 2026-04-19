package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectApiEndpoint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ProjectApiEndpointRepository extends JpaRepository<ProjectApiEndpoint, Long> {

    // ── Existing ─────────────────────────────────────────────
    List<ProjectApiEndpoint> findByProjectIdOrderByMethod(Long projectId);

    // ── NEW ✅ Latest N (newest first, by ID desc) ───────────
    // Usage: PageRequest.of(0, 5) → returns latest 5 endpoints
    List<ProjectApiEndpoint> findByProjectIdOrderByIdDesc(Long projectId, Pageable pageable);

    @Transactional
    void deleteByProjectIdAndFrameName(Long projectId, String frameName);
}