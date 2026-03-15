package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.Attachment;
import jp.co.brycen.asn.repository.AttachmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class FileUploadService {

    @Autowired
    private AttachmentRepository attachmentRepository;

    private final String UPLOAD_DIR = "uploads/";

    // UPLOAD file
    public Attachment uploadFile(MultipartFile file, Long taskId,
                                  Long commentId, Long uploadedBy)
            throws IOException {

        if (taskId == null && commentId == null) {
            throw new RuntimeException("taskId or commentId is required");
        }

        // Folder create
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Unique filename
        String originalName = file.getOriginalFilename();
        String extension = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf("."))
                : "";
        String uniqueFileName = UUID.randomUUID() + extension;
        Path filePath = uploadPath.resolve(uniqueFileName);
        Files.copy(file.getInputStream(), filePath);

        // DB save
        Attachment attachment = new Attachment();
        attachment.setTaskId(taskId);
        attachment.setCommentId(commentId);
        attachment.setUploadedBy(uploadedBy);
        attachment.setFileName(originalName);
        attachment.setFileUrl(UPLOAD_DIR + uniqueFileName);  // ← fileUrl
        attachment.setFileType(file.getContentType());
        attachment.setFileSize(file.getSize());

        return attachmentRepository.save(attachment);
    }

    // GET by task
    public List<Attachment> getByTask(Long taskId) {
        return attachmentRepository.findByTaskId(taskId);
    }

    // GET by comment
    public List<Attachment> getByComment(Long commentId) {
        return attachmentRepository.findByCommentId(commentId);
    }

    // DELETE
    public void deleteAttachment(Long id, Long userId) throws IOException {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Attachment not found"));

        if (!attachment.getUploadedBy().equals(userId)) {
            throw new RuntimeException("You can only delete your own files");
        }

        Path filePath = Paths.get(attachment.getFileUrl());  // ← fileUrl
        if (Files.exists(filePath)) {
            Files.delete(filePath);
        }

        attachmentRepository.deleteById(id);
    }
}
