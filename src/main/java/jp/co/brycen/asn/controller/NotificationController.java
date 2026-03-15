package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Notification;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    // GET /api/notifications/my
    @GetMapping("/my")
    public ResponseEntity<List<Notification>> getMyNotifications(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
                notificationService.getMyNotifications(user.getId()));
    }

    // GET /api/notifications/unread-count
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @AuthenticationPrincipal User user) {
        long count = notificationService.getUnreadCount(user.getId());
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    // PUT /api/notifications/{id}/read
    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(
            @PathVariable Long id) {
        try {
            notificationService.markAsRead(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Marked as read", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PUT /api/notifications/read-all
    @PutMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(
            @AuthenticationPrincipal User user) {
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok(
                new AuthDto.MessageResponse("All marked as read", true));
    }
}
