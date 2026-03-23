package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.MemberProfileTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface MemberProfileTranslationRepository
        extends JpaRepository<MemberProfileTranslation, Long> {

    Optional<MemberProfileTranslation> findByUserIdAndLanguageCode(
            Long userId, String languageCode);
}
