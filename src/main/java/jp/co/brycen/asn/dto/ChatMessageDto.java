package jp.co.brycen.asn.dto;

import jp.co.brycen.asn.model.ChatMessage;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ChatMessageDto {

    private Long id;
    private String channelType;
    private Long channelId;
    private Long senderId;
    private String senderName;      // ← ထပ်ထည့်
    private String senderInitial;   // ← Avatar initial
    private String content;
    private String originalLanguage;
    private Boolean hasAttachment;
    private LocalDateTime createdAt;

    // ── Static factory — ChatMessage + senderName → DTO ──
    public static ChatMessageDto from(ChatMessage msg, String senderName) {
        ChatMessageDto dto = new ChatMessageDto();
        dto.setId(msg.getId());
        dto.setChannelType(msg.getChannelType());
        dto.setChannelId(msg.getChannelId());
        dto.setSenderId(msg.getSenderId());
        dto.setSenderName(senderName != null ? senderName : "User");
        dto.setSenderInitial(
            senderName != null && !senderName.isEmpty()
                ? String.valueOf(senderName.charAt(0)).toUpperCase()
                : "U"
        );
        dto.setContent(msg.getContent());
        dto.setOriginalLanguage(msg.getOriginalLanguage());
        dto.setHasAttachment(msg.getHasAttachment());
        dto.setCreatedAt(msg.getCreatedAt());
        return dto;
    }
}
