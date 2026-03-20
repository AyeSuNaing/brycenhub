package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.MemberSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberSkillRepository extends JpaRepository<MemberSkill, Long> {

    List<MemberSkill> findByUserId(Long userId);
}
