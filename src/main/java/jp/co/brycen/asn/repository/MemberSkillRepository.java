package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.MemberSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface MemberSkillRepository extends JpaRepository<MemberSkill, Long> {

    List<MemberSkill> findByUserId(Long userId);

    List<MemberSkill> findByUserIdOrderByCreatedAtDesc(Long userId);

    // Delete CV skills when re-uploading
    @Modifying
    @Transactional
    @Query("DELETE FROM MemberSkill m " +
           "WHERE m.userId = :userId AND m.inputType = :inputType")
    void deleteByUserIdAndInputType(
        @Param("userId")    Long userId,
        @Param("inputType") String inputType
    );

    // AI Team Suggest — find users with matching skill
    @Query("SELECT DISTINCT m.userId FROM MemberSkill m " +
           "WHERE LOWER(m.skillNameEn) LIKE LOWER(CONCAT('%', :skill, '%'))")
    List<Long> findUserIdsBySkill(@Param("skill") String skill);
}