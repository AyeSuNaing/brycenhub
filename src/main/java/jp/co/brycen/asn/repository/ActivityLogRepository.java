package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<ActivityLog> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<ActivityLog> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(
            String targetType, Long targetId);
}