package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProjectTranslationRepository
        extends JpaRepository<ProjectTranslation, Long> {

    Optional<ProjectTranslation> findByProjectIdAndLanguageCode(
            Long projectId, String languageCode);
}