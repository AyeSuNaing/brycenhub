package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Attachment;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.FileUploadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    @Autowired
    private FileUploadService fileUploadService;

    // POST /api/attachments/upload
    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long commentId,
            @AuthenticationPrincipal User user) {
        try {
            Attachment attachment = fileUploadService.uploadFile(
                    file, taskId, commentId, user.getId());
            return ResponseEntity.ok(attachment);
        } catch (IOException | RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // GET /api/attachments/by-task/{taskId}
    @GetMapping("/by-task/{taskId}")
    public ResponseEntity<List<Attachment>> getByTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(fileUploadService.getByTask(taskId));
    }

    // GET /api/attachments/by-comment/{commentId}
    @GetMapping("/by-comment/{commentId}")
    public ResponseEntity<List<Attachment>> getByComment(
            @PathVariable Long commentId) {
        return ResponseEntity.ok(fileUploadService.getByComment(commentId));
    }

    // DELETE /api/attachments/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        try {
            fileUploadService.deleteAttachment(id, user.getId());
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("File deleted", true));
        } catch (IOException | RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
