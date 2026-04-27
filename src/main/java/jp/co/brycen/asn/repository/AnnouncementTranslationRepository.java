package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.AnnouncementTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AnnouncementTranslationRepository
        extends JpaRepository<AnnouncementTranslation, Long> {

    Optional<AnnouncementTranslation> findByAnnouncementIdAndLanguageCode(
            Long announcementId, String languageCode);
}
