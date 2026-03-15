package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findByUserIdAndIsRead(Long userId, Boolean isRead);
    long countByUserIdAndIsRead(Long userId, Boolean isRead);
}
