package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectRuleRepository extends JpaRepository<ProjectRule, Long> {

    // ── By project (active only, ordered) ─────────────────────────
    List<ProjectRule> findByProjectIdAndIsActiveTrueOrderByPosition(Long projectId);

    // ── All by project (including inactive) ───────────────────────
    List<ProjectRule> findByProjectIdOrderByPosition(Long projectId);

    // ── By project + category ─────────────────────────────────────
    List<ProjectRule> findByProjectIdAndCategoryAndIsActiveTrueOrderByPosition(
        Long projectId, ProjectRule.Category category);

    // ── Delete all by project ─────────────────────────────────────
    void deleteByProjectId(Long projectId);
}
