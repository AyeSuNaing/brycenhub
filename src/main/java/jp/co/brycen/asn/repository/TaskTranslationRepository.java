package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.TaskTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface TaskTranslationRepository extends JpaRepository<TaskTranslation, Long> {
    Optional<TaskTranslation> findByTaskIdAndLanguageCode(Long taskId, String languageCode);
    List<TaskTranslation> findByTaskId(Long taskId);
    void deleteByTaskId(Long taskId);
}
