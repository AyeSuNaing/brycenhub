package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.Notification;
import jp.co.brycen.asn.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    // Notification create
    public void createNotification(Long userId, String type, String title,
                                    String content, String referenceType,
                                    Long referenceId) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);           // ← type
        notification.setTitle(title);         // ← title
        notification.setContent(content);     // ← content
        notification.setReferenceType(referenceType);
        notification.setReferenceId(referenceId);
        notification.setIsRead(false);
        notificationRepository.save(notification);
    }

    // GET my notifications
    public List<Notification> getMyNotifications(Long userId) {
        return notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId);
    }

    // GET unread count
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsRead(userId, false);
    }

    // MARK as read
    public void markAsRead(Long notificationId) {
        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        notificationRepository.save(notification);
    }

    // MARK ALL as read
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository
                .findByUserIdAndIsRead(userId, false);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
    }
}
