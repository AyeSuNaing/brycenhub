package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.ChatMessage;
import jp.co.brycen.asn.model.ChatReadStatus;
import jp.co.brycen.asn.repository.ChatMessageRepository;
import jp.co.brycen.asn.repository.ChatReadStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ChatReadStatusRepository chatReadStatusRepository;

    // =============================================
    // SEND MESSAGE
    // =============================================

    public ChatMessage sendMessage(String channelType, Long channelId,
                                   Long senderId, String content,
                                   String originalLanguage) {
        ChatMessage message = new ChatMessage();
        message.setChannelType(channelType.toUpperCase());
        message.setChannelId(channelId);
        message.setSenderId(senderId);
        message.setContent(content);
        message.setOriginalLanguage(
                originalLanguage != null ? originalLanguage : "en");
        return chatMessageRepository.save(message);
    }

    // =============================================
    // GET MESSAGES BY CHANNEL
    // =============================================

    // GLOBAL channel (channelId မလို)
    public List<ChatMessage> getGlobalMessages() {
        return chatMessageRepository
                .findByChannelTypeOrderByCreatedAtAsc("GLOBAL");
    }

    // COUNTRY channel
    public List<ChatMessage> getCountryMessages(Long countryId) {
        return chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("COUNTRY", countryId);
    }

    // PROJECT channel
    public List<ChatMessage> getProjectMessages(Long projectId) {
        return chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("PROJECT", projectId);
    }

    // DIRECT messages between 2 users
    public List<ChatMessage> getDirectMessages(Long userId1, Long userId2) {
        return chatMessageRepository.findDirectMessages(userId1, userId2);
    }

    // Recent 50 messages
    public List<ChatMessage> getRecentMessages(String channelType, Long channelId) {
        List<ChatMessage> messages = chatMessageRepository.findRecentByChannel(
                channelType.toUpperCase(), channelId,
                PageRequest.of(0, 50));
        // ASC order ဖြင့် ပြန်ပေး
        Collections.reverse(messages);
        return messages;
    }

    // =============================================
    // READ STATUS
    // =============================================

    // Message ဖတ်ပြီကြောင်း mark
    public void markAsRead(Long messageId, Long userId) {
        Optional<ChatReadStatus> existing = chatReadStatusRepository
                .findByMessageIdAndUserId(messageId, userId);
        if (existing.isEmpty()) {
            ChatReadStatus status = new ChatReadStatus();
            status.setMessageId(messageId);
            status.setUserId(userId);
            chatReadStatusRepository.save(status);
        }
    }

    // Channel ထဲက messages အားလုံး read mark
    public void markChannelAsRead(String channelType, Long channelId, Long userId) {
        List<ChatMessage> messages;
        if ("GLOBAL".equalsIgnoreCase(channelType)) {
            messages = getGlobalMessages();
        } else {
            messages = chatMessageRepository
                    .findByChannelTypeAndChannelIdOrderByCreatedAtAsc(
                            channelType.toUpperCase(), channelId);
        }
        messages.stream()
                .filter(m -> !m.getSenderId().equals(userId))
                .forEach(m -> markAsRead(m.getId(), userId));
    }

    // Unread count
    public long getUnreadCount(String channelType, Long channelId, Long userId) {
        return chatReadStatusRepository.countUnread(
                channelType.toUpperCase(), channelId, userId);
    }

    // =============================================
    // CHANNEL LIST (user မြင်ရမဲ့ channels)
    // =============================================
    public Map<String, Object> getChannelInfo(String channelType,
                                               Long channelId, Long userId) {
        long unread = "GLOBAL".equalsIgnoreCase(channelType)
                ? chatReadStatusRepository.countUnread("GLOBAL", null, userId)
                : getUnreadCount(channelType, channelId, userId);

        return Map.of(
                "channelType", channelType,
                "channelId", channelId != null ? channelId : 0,
                "unreadCount", unread
        );
    }
}
