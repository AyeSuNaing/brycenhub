package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findByBranchId(Long branchId);

    boolean existsByBranchIdAndName(Long branchId, String name);
}
