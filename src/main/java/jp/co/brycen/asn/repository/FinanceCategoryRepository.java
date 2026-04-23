package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.FinanceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FinanceCategoryRepository extends JpaRepository<FinanceCategory, Long> {

    // All active categories by type (EXPENSE / INCOME)
    List<FinanceCategory> findByTypeAndIsActiveTrueOrderByNameAsc(String type);

    // All active categories for a specific scope
    List<FinanceCategory> findByTypeAndScopeAndIsActive(
            String type, String scope, Boolean isActive);

    // All categories visible to a branch (GLOBAL + branch-specific)
    List<FinanceCategory> findByTypeAndIsActiveTrueAndScopeOrTypeAndIsActiveTrueAndBranchId(
            String type1, String scope,
            String type2, Long branchId);

    // By type + active only (for dropdowns)
    List<FinanceCategory> findByTypeAndIsActive(String type, Boolean isActive);
}
