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

    // ── All (Boss) ──────────────────────────────────────────
    List<Announcement> findAllByOrderByCreatedAtDesc();

    // ── Branch + Global (VP/Admin/Member) ──────────────────
    @Query("SELECT a FROM Announcement a WHERE " +
           "a.targetScope = 'GLOBAL' OR " +
           "(a.targetScope = 'BRANCH' AND a.targetId = :branchId) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findByBranchOrGlobal(@Param("branchId") Long branchId);

    // ── All + date range (Boss) ─────────────────────────────
    @Query("SELECT a FROM Announcement a WHERE " +
           "a.createdAt >= :from AND a.createdAt <= :to " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findAllByDateRange(
            @Param("from") LocalDateTime from,
            @Param("to")   LocalDateTime to);

    // ── Branch + Global + date range (VP/Admin/Member) ──────
    @Query("SELECT a FROM Announcement a WHERE " +
           "(a.targetScope = 'GLOBAL' OR " +
           "(a.targetScope = 'BRANCH' AND a.targetId = :branchId)) " +
           "AND a.createdAt >= :from AND a.createdAt <= :to " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findByBranchOrGlobalAndDateRange(
            @Param("branchId") Long branchId,
            @Param("from")     LocalDateTime from,
            @Param("to")       LocalDateTime to);

    // ── Legacy (DashboardController compatibility) ──────────
    List<Announcement> findByTargetScopeOrderByCreatedAtDesc(String targetScope);

    List<Announcement> findByTargetScopeAndTargetIdOrderByCreatedAtDesc(
            String targetScope, Long targetId);

    // ── Dashboard bar — active only ─────────────────────────
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

    // ── History — BOSS ──────────────────────────────────────
    @Query("SELECT a FROM Announcement a " +
           "WHERE a.createdAt >= :from AND a.createdAt <= :to " +
           "ORDER BY a.createdAt DESC")
    Page<Announcement> findHistoryAll(
            @Param("from") LocalDateTime from,
            @Param("to")   LocalDateTime to,
            Pageable pageable);

    // ── History — VP/Admin/PM ───────────────────────────────
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
}