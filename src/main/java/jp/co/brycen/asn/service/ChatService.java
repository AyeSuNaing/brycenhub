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

    public void markChannelAsRead(String channelType, Long channelId, Long userId) {
        List<ChatMessage> messages;
        if ("GLOBAL".equals(channelType)) {
            messages = chatMessageRepository
                    .findByChannelTypeOrderByCreatedAtAsc(channelType);
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
        } else {
            messages = chatMessageRepository
                    .findByChannelTypeAndChannelIdOrderByCreatedAtAsc(channelType, channelId);
        }
        return messages.stream()
                .filter(m -> chatReadStatusRepository
                        .findByMessageIdAndUserId(m.getId(), userId).isEmpty())
                .count();
    }
}