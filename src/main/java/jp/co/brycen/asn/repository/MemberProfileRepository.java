package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.MemberProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MemberProfileRepository extends JpaRepository<MemberProfile, Long> {

    Optional<MemberProfile> findByUserId(Long userId);

    boolean existsByUserId(Long userId);
}