package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.ChatMessageDto;
import jp.co.brycen.asn.model.ChatMessage;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.ChatService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    @Autowired
    private ChatService chatService;

    @Data
    static class SendMessageRequest {
        private String channelType;
        private Long channelId;
        private String content;
        private String originalLanguage;
    }

    // =============================================
    // SEND MESSAGE — POST /api/chat/send
    // =============================================
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(
            @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal User user) {
        try {
            ChatMessage message = chatService.sendMessage(
                    request.getChannelType(),
                    request.getChannelId(),
                    user.getId(),
                    request.getContent(),
                    request.getOriginalLanguage());

            ChatMessageDto dto = ChatMessageDto.from(message, user.getName());
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // =============================================
    // GET MESSAGES
    // =============================================

    @GetMapping("/global")
    public ResponseEntity<List<ChatMessageDto>> getGlobalMessages() {
        return ResponseEntity.ok(chatService.getGlobalMessages());
    }

    @GetMapping("/country/{countryId}")
    public ResponseEntity<List<ChatMessageDto>> getCountryMessages(
            @PathVariable Long countryId) {
        return ResponseEntity.ok(chatService.getCountryMessages(countryId));
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<ChatMessageDto>> getProjectMessages(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(chatService.getProjectMessages(projectId));
    }

    @GetMapping("/direct/{otherUserId}")
    public ResponseEntity<List<ChatMessageDto>> getDirectMessages(
            @PathVariable Long otherUserId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
                chatService.getDirectMessages(user.getId(), otherUserId));
    }

    // =============================================
    // READ STATUS
    // =============================================

    @PutMapping("/read/{messageId}")
    public ResponseEntity<?> markAsRead(
            @PathVariable Long messageId,
            @AuthenticationPrincipal User user) {
        chatService.markAsRead(messageId, user.getId());
        return ResponseEntity.ok(
                new AuthDto.MessageResponse("Marked as read", true));
    }

    @PutMapping("/read-channel")
    public ResponseEntity<?> markChannelAsRead(
            @RequestParam String type,
            @RequestParam(required = false) Long channelId,
            @AuthenticationPrincipal User user) {
        chatService.markChannelAsRead(type, channelId, user.getId());
        return ResponseEntity.ok(
                new AuthDto.MessageResponse("Channel marked as read", true));
    }

    @GetMapping("/unread")
    public ResponseEntity<Map<String, Object>> getUnreadCount(
            @RequestParam String type,
            @RequestParam(required = false, defaultValue = "0") Long channelId,
            @AuthenticationPrincipal User user) {
        long count = chatService.getUnreadCount(type, channelId, user.getId());
        return ResponseEntity.ok(Map.of(
                "channelType", type,
                "channelId", channelId,
                "unreadCount", count));
    }

    // =============================================
    // ✅ NEW — Unread DMs grouped by sender
    // GET /api/chat/direct-unread-by-sender?userId={myId}
    // Returns: [{ senderId, unreadCount }]
    // DIRECT channel_id = receiver userId
    // =============================================
    @GetMapping("/direct-unread-by-sender")
    public ResponseEntity<List<Map<String, Object>>> getDirectUnreadBySender(
            @RequestParam Long userId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(chatService.getDirectUnreadBySender(userId));
    }
    
    // GET /api/chat/unread-batch?type=PROJECT&channelIds=5,6,7,8
    @GetMapping("/unread-batch")
    public ResponseEntity<List<Map<String, Object>>> getUnreadBatch(
            @RequestParam String type,
            @RequestParam String channelIds,
            @AuthenticationPrincipal User user) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String idStr : channelIds.split(",")) {
            try {
                Long channelId = Long.parseLong(idStr.trim());
                long count = chatService.getUnreadCount(type, channelId, user.getId());
                Map<String, Object> row = new HashMap<>();
                row.put("channelId", channelId);
                row.put("unreadCount", count);
                result.add(row);
            } catch (NumberFormatException ignored) {}
        }
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/branch/{branchId}")
    public ResponseEntity<List<ChatMessageDto>> getBranchMessages(
            @PathVariable Long branchId) {
        return ResponseEntity.ok(chatService.getBranchMessages(branchId));
    }
}