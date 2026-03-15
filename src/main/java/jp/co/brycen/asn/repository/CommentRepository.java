package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByTaskId(Long taskId);
    List<Comment> findByUserId(Long userId);
}
