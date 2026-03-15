package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {
    List<ProjectMember> findByProjectId(Long projectId);
    List<ProjectMember> findByUserId(Long userId);
    List<ProjectMember> findByProjectIdAndStatus(Long projectId, String status);
    // User ပါတဲ့ project id များ ဆွဲထုတ်
    List<ProjectMember> findByUserIdAndStatus(Long userId, String status);
    
    Optional<ProjectMember> findByProjectIdAndUserIdAndStatus(
            Long projectId, Long userId, String status);
    boolean existsByProjectIdAndUserIdAndStatus(
            Long projectId, Long userId, String status);
}
