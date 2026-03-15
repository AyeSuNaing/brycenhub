package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ChatReadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatReadStatusRepository extends JpaRepository<ChatReadStatus, Long> {
    Optional<ChatReadStatus> findByMessageIdAndUserId(Long messageId, Long userId);
    List<ChatReadStatus> findByUserId(Long userId);

    // Unread count for a channel
    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.channelType = :type " +
           "AND m.channelId = :channelId AND m.senderId != :userId " +
           "AND m.id NOT IN (SELECT r.messageId FROM ChatReadStatus r WHERE r.userId = :userId)")
    long countUnread(
            @Param("type") String type,
            @Param("channelId") Long channelId,
            @Param("userId") Long userId);
}
