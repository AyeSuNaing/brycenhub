package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByBranchId(Long branchId);
    
    List<User> findStaffByBranchIdAndRoleIdNot(Long branchId, Long roleId);

    List<User> findByRoleId(Long roleId);      // ← NEW (roleId Long)

    List<User> findByIsActive(Boolean isActive);
    
    List<User> findByClientId(Long clientId);
    
    // ── Admin Dashboard stats ─────────────────────────────────────
    long countByIsActive(Boolean isActive);
 
    long countByBranchIdAndIsActive(Long branchId, Boolean isActive);
    
    //staff without client 
    long countByBranchIdAndIsActiveAndRoleIdNot(Long branchId, Boolean isActive, Long roleId);
    long countByIsActiveAndRoleIdNot(Boolean isActive, Long roleId);
    
    /** Active staff in a branch. */
    List<User> findByBranchIdAndIsActive(Long branchId, Boolean isActive);
    long countByDepartmentIdAndIsActive(Long departmentId, Boolean isActive);

    
}