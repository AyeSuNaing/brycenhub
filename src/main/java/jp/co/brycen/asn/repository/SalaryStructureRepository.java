package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.SalaryStructure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryStructureRepository extends JpaRepository<SalaryStructure, Long> {

    /** All salary history for one user, newest first */
    @Query("SELECT s FROM SalaryStructure s WHERE s.userId = :userId ORDER BY s.effectiveDate DESC, s.id DESC")
    List<SalaryStructure> findHistoryByUserId(@Param("userId") Long userId);

    /** Latest salary for one user (current) */
    @Query("SELECT s FROM SalaryStructure s WHERE s.userId = :userId " +
           "ORDER BY s.effectiveDate DESC, s.id DESC")
    List<SalaryStructure> findLatestByUserId(@Param("userId") Long userId,
            org.springframework.data.domain.Pageable pageable);

    default Optional<SalaryStructure> findCurrentByUserId(Long userId) {
        List<SalaryStructure> list = findLatestByUserId(
                userId, org.springframework.data.domain.PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    /** All current salaries for a branch (for bulk stats) */
    @Query(value = "SELECT s.* FROM salary_structures s " +
                   "INNER JOIN (" +
                   "  SELECT user_id, MAX(effective_date) AS max_date " +
                   "  FROM salary_structures GROUP BY user_id" +
                   ") latest ON s.user_id = latest.user_id AND s.effective_date = latest.max_date " +
                   "INNER JOIN users u ON u.id = s.user_id " +
                   "WHERE u.branch_id = :branchId",
           nativeQuery = true)
    List<SalaryStructure> findAllCurrentByBranch(@Param("branchId") Long branchId);

    /** Count staff with salary set in a branch */
    @Query(value = "SELECT COUNT(DISTINCT s.user_id) FROM salary_structures s " +
                   "INNER JOIN users u ON u.id = s.user_id " +
                   "WHERE u.branch_id = :branchId",
           nativeQuery = true)
    long countStaffWithSalaryByBranch(@Param("branchId") Long branchId);

    /** Company-wide current salaries */
    @Query(value = "SELECT s.* FROM salary_structures s " +
                   "INNER JOIN (" +
                   "  SELECT user_id, MAX(effective_date) AS max_date " +
                   "  FROM salary_structures GROUP BY user_id" +
                   ") latest ON s.user_id = latest.user_id AND s.effective_date = latest.max_date",
           nativeQuery = true)
    List<SalaryStructure> findAllCurrent();
}
