package jp.co.brycen.asn.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // GLOBAL, COUNTRY, PROJECT, DIRECT
    @Column(name = "channel_type", nullable = false)
    private String channelType;

    // country_id / project_id / receiver_user_id (DM)
    @Column(name = "channel_id")
    private Long channelId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "original_language")
    private String originalLanguage = "en";

    @Column(name = "has_attachment")
    private Boolean hasAttachment = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
