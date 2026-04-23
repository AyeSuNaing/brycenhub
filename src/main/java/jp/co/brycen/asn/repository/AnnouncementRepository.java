package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Announcement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    List<Announcement> findByTargetScopeOrderByCreatedAtDesc(String targetScope);

    List<Announcement> findByTargetScopeAndTargetIdOrderByCreatedAtDesc(
            String targetScope, Long targetId);

    // Dashboard bar — active only (existing)
    @Query("SELECT a FROM Announcement a WHERE " +
           "a.targetScope = 'GLOBAL' OR " +
           "(a.targetScope = 'BRANCH' AND a.targetId = :branchId) OR " +
           "(a.targetScope = 'PROJECT' AND a.targetId IN :projectIds) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findForDashboard(
            @Param("branchId")   Long branchId,
            @Param("projectIds") List<Long> projectIds);

    // ── History — BOSS (all, no scope filter) ──
    @Query("SELECT a FROM Announcement a " +
           "WHERE a.createdAt >= :from AND a.createdAt <= :to " +
           "ORDER BY a.createdAt DESC")
    Page<Announcement> findHistoryAll(
            @Param("from") LocalDateTime from,
            @Param("to")   LocalDateTime to,
            Pageable pageable);

    // ── History — Director / VP / Admin / PM (branchIds list) ──
    @Query("SELECT a FROM Announcement a WHERE " +
           "(a.targetScope = 'GLOBAL' OR " +
           " (a.targetScope = 'BRANCH'  AND a.targetId IN :branchIds) OR " +
           " (a.targetScope = 'PROJECT' AND a.targetId IN :projectIds)) " +
           "AND a.createdAt >= :from AND a.createdAt <= :to " +
           "ORDER BY a.createdAt DESC")
    Page<Announcement> findHistoryByBranches(
            @Param("branchIds")  List<Long> branchIds,
            @Param("projectIds") List<Long> projectIds,
            @Param("from")       LocalDateTime from,
            @Param("to")         LocalDateTime to,
            Pageable pageable);
    
    
 // Dashboard bar — active only (expires_at filter ပါ)
    @Query("SELECT a FROM Announcement a WHERE " +
           "(a.targetScope = 'GLOBAL' OR " +
           "(a.targetScope = 'BRANCH' AND a.targetId = :branchId) OR " +
           "(a.targetScope = 'PROJECT' AND a.targetId IN :projectIds)) " +
           "AND (a.expiresAt IS NULL OR a.expiresAt > :now) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findForDashboard(
            @Param("branchId")   Long branchId,
            @Param("projectIds") List<Long> projectIds,
            @Param("now")        LocalDateTime now);
    
}
