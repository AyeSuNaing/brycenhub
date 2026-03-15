package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SprintRepository extends JpaRepository<Sprint, Long> {
    List<Sprint> findByProjectId(Long projectId);
    List<Sprint> findByProjectIdAndStatus(Long projectId, String status);
}
