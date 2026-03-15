// ===== ProjectRepository.java =====
package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByBranchId(Long branchId);
    List<Project> findByPmId(Long pmId);
    List<Project> findByStatus(String status);
}
