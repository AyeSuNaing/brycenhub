package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Comment;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.CommentService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    @Autowired
    private CommentService commentService;

    @Data
    static class CommentRequest {
        private Long taskId;
        private String content;
    }

    @Data
    static class UpdateCommentRequest {
        private String content;
    }

    // GET /api/comments/by-task/{taskId}
    @GetMapping("/by-task/{taskId}")
    public ResponseEntity<List<Comment>> getByTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(commentService.getCommentsByTask(taskId));
    }

    // POST /api/comments
    @PostMapping
    public ResponseEntity<?> createComment(
            @RequestBody CommentRequest request,
            @AuthenticationPrincipal User user) {
        try {
            Comment comment = commentService.createComment(
                    request.getTaskId(),
                    request.getContent(),
                    user.getId());
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // PUT /api/comments/{id}
    @PutMapping("/{id}")
    public ResponseEntity<?> updateComment(
            @PathVariable Long id,
            @RequestBody UpdateCommentRequest request,
            @AuthenticationPrincipal User user) {
        try {
            return ResponseEntity.ok(
                    commentService.updateComment(id, request.getContent(), user.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // DELETE /api/comments/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteComment(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        try {
            commentService.deleteComment(id, user.getId());
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Comment deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
