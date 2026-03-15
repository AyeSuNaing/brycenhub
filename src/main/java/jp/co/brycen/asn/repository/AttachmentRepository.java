package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByTaskId(Long taskId);
    List<Attachment> findByCommentId(Long commentId);
    List<Attachment> findByUploadedBy(Long userId);
}
