package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.DesignBoard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DesignBoardRepository extends JpaRepository<DesignBoard, Long> {
    Optional<DesignBoard> findByProjectId(Long projectId);
}
