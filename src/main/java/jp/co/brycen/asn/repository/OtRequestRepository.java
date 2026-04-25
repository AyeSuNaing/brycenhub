package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.OtRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface OtRequestRepository extends JpaRepository<OtRequest, Long> {

    // ── Company Admin — all branches ─────────────────────────────
    List<OtRequest> findByStatusOrderByCreatedAtDesc(String status);

    // ── Branch Admin — own branch only ───────────────────────────
    @Query("SELECT o FROM OtRequest o " +
           "WHERE o.status = :status " +
           "AND o.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId) " +
           "ORDER BY o.createdAt DESC")
    List<OtRequest> findByBranchIdAndStatus(
            @Param("branchId") Long branchId,
            @Param("status")   String status);

    // ── Staff — own requests ──────────────────────────────────────
    List<OtRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    // ── Pending count — all branches ─────────────────────────────
    long countByStatus(String status);

    // ── Pending count — own branch ────────────────────────────────
    @Query("SELECT COUNT(o) FROM OtRequest o " +
           "WHERE o.status = :status " +
           "AND o.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId)")
    long countByBranchIdAndStatus(
            @Param("branchId") Long branchId,
            @Param("status")   String status);

    // ── Total approved OT hours this month — all branches ────────
    @Query("SELECT COALESCE(SUM(o.otHours), 0) FROM OtRequest o " +
           "WHERE o.status = 'APPROVED' " +
           "AND YEAR(o.workDate) = :year " +
           "AND MONTH(o.workDate) = :month")
    BigDecimal sumApprovedOtHours(
            @Param("year")  int year,
            @Param("month") int month);

    // ── Total approved OT hours this month — own branch ──────────
    @Query("SELECT COALESCE(SUM(o.otHours), 0) FROM OtRequest o " +
           "WHERE o.status = 'APPROVED' " +
           "AND YEAR(o.workDate) = :year " +
           "AND MONTH(o.workDate) = :month " +
           "AND o.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId)")
    BigDecimal sumApprovedOtHoursByBranch(
            @Param("branchId") Long branchId,
            @Param("year")     int year,
            @Param("month")    int month);

    // ── Sum approved OT amounts in date range ─────────────────────
    @Query("SELECT COALESCE(SUM(o.otAmount), 0) FROM OtRequest o " +
           "WHERE o.userId = :userId " +
           "  AND o.status = 'APPROVED' " +
           "  AND o.workDate BETWEEN :start AND :end")
    BigDecimal sumApprovedOtAmount(@Param("userId") Long userId,
                                   @Param("start")  LocalDate start,
                                   @Param("end")    LocalDate end);

    // ── VP History — all statuses, by branch user IDs ─────────────
    List<OtRequest> findByUserIdInOrderByCreatedAtDesc(List<Long> userIds);

    // ── VP History — date range filter ───────────────────────────
    List<OtRequest> findByUserIdInAndWorkDateBetweenOrderByWorkDateDesc(
            List<Long> userIds, LocalDate from, LocalDate to);

    // ── VP History — status + date range filter ───────────────────
    List<OtRequest> findByUserIdInAndStatusAndWorkDateBetweenOrderByWorkDateDesc(
            List<Long> userIds, String status, LocalDate from, LocalDate to);

    // ── VP History — status filter only (no date) ─────────────────  ← NEW
    List<OtRequest> findByUserIdInAndStatusOrderByCreatedAtDesc(
            List<Long> userIds, String status);
}