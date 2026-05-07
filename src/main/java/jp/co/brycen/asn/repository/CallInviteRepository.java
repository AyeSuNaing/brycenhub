package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.CallInvite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface CallInviteRepository extends JpaRepository<CallInvite, Long> {

    // Get latest PENDING call for a callee (within 30 seconds)
    @Query("SELECT c FROM CallInvite c WHERE c.calleeId = :calleeId " +
           "AND c.status = 'PENDING' " +
           "AND c.createdAt >= :since " +
           "ORDER BY c.createdAt DESC")
    Optional<CallInvite> findLatestPending(Long calleeId, LocalDateTime since);

    Optional<CallInvite> findByRoomIdAndCalleeId(String roomId, Long calleeId);
}
