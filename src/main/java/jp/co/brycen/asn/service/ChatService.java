package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.ChatMessageDto;
import jp.co.brycen.asn.model.ChatMessage;
import jp.co.brycen.asn.model.ChatReadStatus;
import jp.co.brycen.asn.repository.ChatMessageRepository;
import jp.co.brycen.asn.repository.ChatReadStatusRepository;
import jp.co.brycen.asn.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ChatReadStatusRepository chatReadStatusRepository;

    @Autowired
    private UserRepository userRepository;

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
    // HELPER — senderName Map build (batch lookup)
    // =============================================
    private Map<Long, String> buildSenderNameMap(List<ChatMessage> messages) {
        Set<Long> senderIds = messages.stream()
                .map(ChatMessage::getSenderId)
                .collect(Collectors.toSet());

        Map<Long, String> nameMap = new HashMap<>();
        userRepository.findAllById(senderIds)
                .forEach(u -> nameMap.put(u.getId(), u.getName()));
        return nameMap;
    }

    // =============================================
    // GET MESSAGES — return DTO with senderName
    // =============================================

    public List<ChatMessageDto> getGlobalMessages() {
        List<ChatMessage> msgs = chatMessageRepository
                .findByChannelTypeOrderByCreatedAtAsc("GLOBAL");
        Map<Long, String> nameMap = buildSenderNameMap(msgs);
        return msgs.stream()
                .map(m -> ChatMessageDto.from(m, nameMap.get(m.getSenderId())))
                .collect(Collectors.toList());
    }

    public List<ChatMessageDto> getCountryMessages(Long countryId) {
        List<ChatMessage> msgs = chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("COUNTRY", countryId);
        Map<Long, String> nameMap = buildSenderNameMap(msgs);
        return msgs.stream()
                .map(m -> ChatMessageDto.from(m, nameMap.get(m.getSenderId())))
                .collect(Collectors.toList());
    }

    public List<ChatMessageDto> getProjectMessages(Long projectId) {
        List<ChatMessage> msgs = chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("PROJECT", projectId);
        Map<Long, String> nameMap = buildSenderNameMap(msgs);
        return msgs.stream()
                .map(m -> ChatMessageDto.from(m, nameMap.get(m.getSenderId())))
                .collect(Collectors.toList());
    }

    public List<ChatMessageDto> getDirectMessages(Long userId1, Long userId2) {
        List<ChatMessage> msgs = chatMessageRepository
                .findDirectMessages(userId1, userId2);
        Map<Long, String> nameMap = buildSenderNameMap(msgs);
        return msgs.stream()
                .map(m -> ChatMessageDto.from(m, nameMap.get(m.getSenderId())))
                .collect(Collectors.toList());
    }

    // =============================================
    // READ STATUS
    // ✅ FIX: existsByMessageIdAndUserId မရှိ
    //        → findByMessageIdAndUserId().isEmpty() သုံး
    // =============================================
    public void markAsRead(Long messageId, Long userId) {
        if (chatReadStatusRepository
                .findByMessageIdAndUserId(messageId, userId).isEmpty()) {
            ChatReadStatus status = new ChatReadStatus();
            status.setMessageId(messageId);
            status.setUserId(userId);
            chatReadStatusRepository.save(status);
        }
    }

 // ChatService.java မှာ markChannelAsRead() နဲ့ getUnreadCount() ကို replace လုပ်ပါ

    public void markChannelAsRead(String channelType, Long channelId, Long userId) {
        List<ChatMessage> messages;
        if ("GLOBAL".equals(channelType)) {
            messages = chatMessageRepository
                    .findByChannelTypeOrderByCreatedAtAsc(channelType);
        } else if ("DIRECT".equals(channelType)) {
            // ✅ FIX: DIRECT မှာ ၂ ဘက်လုံးကနေ messages ဆွဲ
            // channelId = otherUserId (တဖက်သား userId)
            messages = chatMessageRepository
                    .findDirectMessages(userId, channelId);
        } else {
            messages = chatMessageRepository
                    .findByChannelTypeAndChannelIdOrderByCreatedAtAsc(channelType, channelId);
        }
        messages.forEach(msg -> {
            if (chatReadStatusRepository
                    .findByMessageIdAndUserId(msg.getId(), userId).isEmpty()) {
                ChatReadStatus status = new ChatReadStatus();
                status.setMessageId(msg.getId());
                status.setUserId(userId);
                chatReadStatusRepository.save(status);
            }
        });
    }

    public long getUnreadCount(String channelType, Long channelId, Long userId) {
        List<ChatMessage> messages;
        if ("GLOBAL".equals(channelType)) {
            messages = chatMessageRepository
                    .findByChannelTypeOrderByCreatedAtAsc(channelType);
        } else if ("DIRECT".equals(channelType)) {
            // ✅ FIX: DIRECT မှာ ၂ ဘက်လုံးကနေ messages ဆွဲ
            messages = chatMessageRepository
                    .findDirectMessages(userId, channelId);
        } else {
            messages = chatMessageRepository
                    .findByChannelTypeAndChannelIdOrderByCreatedAtAsc(channelType, channelId);
        }
        return messages.stream()
                .filter(m -> !m.getSenderId().equals(userId)) // ✅ ကိုယ် ပို့တာ မပါ
                .filter(m -> chatReadStatusRepository
                        .findByMessageIdAndUserId(m.getId(), userId).isEmpty())
                .count();
    }
    
 // ✅ Unread DMs grouped by sender
    // DIRECT channel_id = receiver's userId
    public List<Map<String, Object>> getDirectUnreadBySender(Long receiverId) {
        // All DIRECT messages sent TO this user (channel_id = receiverId)
        List<ChatMessage> messages = chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("DIRECT", receiverId);

        // Count unread per sender
        Map<Long, Long> unreadBySender = new HashMap<>();
        for (ChatMessage msg : messages) {
            boolean isRead = !chatReadStatusRepository
                    .findByMessageIdAndUserId(msg.getId(), receiverId).isEmpty();
            if (!isRead) {
                unreadBySender.merge(msg.getSenderId(), 1L, Long::sum);
            }
        }

        // Convert to list of { senderId, unreadCount }
        List<Map<String, Object>> result = new ArrayList<>();
        unreadBySender.forEach((senderId, count) -> {
            Map<String, Object> row = new HashMap<>();
            row.put("senderId", senderId);
            row.put("unreadCount", count);
            result.add(row);
        });
        return result;
    }
    
    public List<ChatMessageDto> getBranchMessages(Long branchId) {
        List<ChatMessage> msgs = chatMessageRepository
                .findByChannelTypeAndChannelIdOrderByCreatedAtAsc("BRANCH", branchId);
        Map<Long, String> nameMap = buildSenderNameMap(msgs);
        return msgs.stream()
                .map(m -> ChatMessageDto.from(m, nameMap.get(m.getSenderId())))
                .collect(Collectors.toList());
    }
}