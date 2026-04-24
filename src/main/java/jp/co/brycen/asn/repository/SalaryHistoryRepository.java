package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.SalaryHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryHistoryRepository extends JpaRepository<SalaryHistory, Long> {

    /** Find existing record for a user in a given pay period (used for upsert). */
    Optional<SalaryHistory> findByUserIdAndPayPeriod(Long userId, String payPeriod);

    /** All records for a branch in a given pay period (staff list). */
    @Query("SELECT s FROM SalaryHistory s " +
           "WHERE s.branchId = :branchId AND s.payPeriod = :payPeriod " +
           "ORDER BY s.userId ASC")
    List<SalaryHistory> findByBranchAndPeriod(
            @Param("branchId")  Long branchId,
            @Param("payPeriod") String payPeriod);

    /** Company-wide for a given period (Boss dashboard). */
    List<SalaryHistory> findByPayPeriodOrderByBranchIdAscUserIdAsc(String payPeriod);

    /** All pay periods a user has been paid in (staff self-view / admin profile). */
    List<SalaryHistory> findByUserIdOrderByPeriodEndDesc(Long userId);

    /** Count how many records already exist for a branch in a period (was it calculated?). */
    long countByBranchIdAndPayPeriod(Long branchId, String payPeriod);

    /** Count by status — company wide (Boss dashboard). */
    long countByStatus(String status);

    /** Count by branch + status (VP Dashboard stats). */
    long countByBranchIdAndStatus(Long branchId, String status);

    /** List by branch + status — VP Dashboard salary approvals inbox. */
    List<SalaryHistory> findByBranchIdAndStatus(Long branchId, String status);

    /** List by branch + status, sorted newest first. */
    List<SalaryHistory> findByBranchIdAndStatusOrderByCreatedAtDesc(Long branchId, String status);
}