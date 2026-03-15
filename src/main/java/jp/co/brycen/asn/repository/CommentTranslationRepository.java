package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.CommentTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface CommentTranslationRepository extends JpaRepository<CommentTranslation, Long> {
    Optional<CommentTranslation> findByCommentIdAndLanguageCode(Long commentId, String languageCode);
    List<CommentTranslation> findByCommentId(Long commentId);
}
