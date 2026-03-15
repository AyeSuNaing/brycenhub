package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // GLOBAL channel messages
    List<ChatMessage> findByChannelTypeOrderByCreatedAtAsc(String channelType);

    // COUNTRY / PROJECT channel messages
    List<ChatMessage> findByChannelTypeAndChannelIdOrderByCreatedAtAsc(
            String channelType, Long channelId);

    // DIRECT messages between 2 users
    @Query("SELECT m FROM ChatMessage m WHERE m.channelType = 'DIRECT' " +
           "AND ((m.senderId = :userId1 AND m.channelId = :userId2) " +
           "OR (m.senderId = :userId2 AND m.channelId = :userId1)) " +
           "ORDER BY m.createdAt ASC")
    List<ChatMessage> findDirectMessages(
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2);

    // Recent messages (limit)
    @Query("SELECT m FROM ChatMessage m WHERE m.channelType = :type " +
           "AND m.channelId = :channelId ORDER BY m.createdAt DESC")
    List<ChatMessage> findRecentByChannel(
            @Param("type") String type,
            @Param("channelId") Long channelId,
            org.springframework.data.domain.Pageable pageable);
}
