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

    List<User> findByRoleId(Long roleId);      // ← NEW (roleId Long)

    List<User> findByIsActive(Boolean isActive);
    
    // ── Admin Dashboard stats ─────────────────────────────────────
    long countByIsActive(Boolean isActive);
 
    long countByBranchIdAndIsActive(Long branchId, Boolean isActive);
}