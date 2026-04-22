package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.BranchExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface BranchExpenseRepository extends JpaRepository<BranchExpense, Long> {

    // ── By branch + status ──────────────────────────────────────
    List<BranchExpense> findByBranchIdAndStatusOrderByCreatedAtDesc(Long branchId, String status);

    // ── By status (all branches — Boss/Director) ────────────────
    List<BranchExpense> findByStatusOrderByCreatedAtDesc(String status);

    // ── By branch + status + type ───────────────────────────────
    List<BranchExpense> findByBranchIdAndStatusAndExpenseTypeOrderByCreatedAtDesc(
            Long branchId, String status, String expenseType);

    // ── Counts ──────────────────────────────────────────────────
    long countByBranchIdAndStatus(Long branchId, String status);
    long countByStatus(String status);

    long countByBranchIdAndStatusAndExpenseType(Long branchId, String status, String expenseType);

    // ── Monthly totals (approved) ───────────────────────────────
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM BranchExpense e " +
           "WHERE e.branchId = :branchId " +
           "AND e.status = 'APPROVED' " +
           "AND YEAR(e.date) = :year " +
           "AND MONTH(e.date) = :month")
    BigDecimal sumApprovedByBranchAndMonth(
            @Param("branchId") Long branchId,
            @Param("year")     int year,
            @Param("month")    int month);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM BranchExpense e " +
           "WHERE e.branchId = :branchId " +
           "AND e.expenseType = :type " +
           "AND e.status = 'APPROVED' " +
           "AND YEAR(e.date) = :year " +
           "AND MONTH(e.date) = :month")
    BigDecimal sumApprovedByBranchTypeMonth(
            @Param("branchId") Long branchId,
            @Param("type")     String type,
            @Param("year")     int year,
            @Param("month")    int month);
}
