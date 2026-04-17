package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.ProjectGeneratedFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectGeneratedFileRepository extends JpaRepository<ProjectGeneratedFile, Long> {
    Optional<ProjectGeneratedFile> findByProjectIdAndFrameName(Long projectId, String frameName);
    List<ProjectGeneratedFile> findByProjectIdOrderByGeneratedAtDesc(Long projectId);
}
