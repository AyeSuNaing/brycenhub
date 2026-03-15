package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    // GLOBAL announcements (target_scope = GLOBAL)
    List<Announcement> findByTargetScopeOrderByCreatedAtDesc(String targetScope);

    // BRANCH announcements (branch_id match)
    List<Announcement> findByTargetScopeAndTargetIdOrderByCreatedAtDesc(
            String targetScope, Long targetId);

    // GLOBAL + BRANCH combined (for dashboard)
    @Query("SELECT a FROM Announcement a WHERE " +
           "a.targetScope = 'GLOBAL' OR " +
           "(a.targetScope = 'BRANCH' AND a.targetId = :branchId) OR " +
           "(a.targetScope = 'PROJECT' AND a.targetId IN :projectIds) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findForDashboard(
            @Param("branchId") Long branchId,
            @Param("projectIds") List<Long> projectIds);
}
