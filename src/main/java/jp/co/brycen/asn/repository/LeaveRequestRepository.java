package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.LeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    // ── Company Admin — all branches ─────────────────────────────
    List<LeaveRequest> findByStatusOrderByCreatedAtDesc(String status);

    // ── Branch Admin — own branch only ───────────────────────────
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = :status " +
           "AND l.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId) " +
           "ORDER BY l.createdAt DESC")
    List<LeaveRequest> findByBranchIdAndStatus(
            @Param("branchId") Long branchId,
            @Param("status")   String status);

    // ── Staff — own requests ──────────────────────────────────────
    List<LeaveRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    // ── Pending count — all branches ─────────────────────────────
    long countByStatus(String status);

    // ── Pending count — own branch ────────────────────────────────
    @Query("SELECT COUNT(l) FROM LeaveRequest l " +
           "WHERE l.status = :status " +
           "AND l.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId)")
    long countByBranchIdAndStatus(
            @Param("branchId") Long branchId,
            @Param("status")   String status);

    // ── Today on leave — all branches ────────────────────────────
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = 'APPROVED' " +
           "AND l.startDate <= :today " +
           "AND l.endDate >= :today")
    List<LeaveRequest> findTodayLeave(
            @Param("today") LocalDate today);

    // ── Today on leave — own branch ───────────────────────────────
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = 'APPROVED' " +
           "AND l.startDate <= :today " +
           "AND l.endDate >= :today " +
           "AND l.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId)")
    List<LeaveRequest> findTodayLeaveByBranch(
            @Param("branchId") Long branchId,
            @Param("today")    LocalDate today);

    // ── Tomorrow on leave — all branches ─────────────────────────
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = 'APPROVED' " +
           "AND l.startDate = :tomorrow")
    List<LeaveRequest> findTomorrowLeave(
            @Param("tomorrow") LocalDate tomorrow);

    // ── Tomorrow on leave — own branch ────────────────────────────
    @Query("SELECT l FROM LeaveRequest l " +
           "WHERE l.status = 'APPROVED' " +
           "AND l.startDate = :tomorrow " +
           "AND l.userId IN (SELECT u.id FROM User u WHERE u.branchId = :branchId)")
    List<LeaveRequest> findTomorrowLeaveByBranch(
            @Param("branchId") Long branchId,
            @Param("tomorrow") LocalDate tomorrow);
}
