package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.CallInvite;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CallInviteRepository extends JpaRepository<CallInvite, Long> {

    // ── Receiver polls: latest PENDING invite (within 30s) ──
    // ✅ FIX: Text Blocks ဖြုတ် (IDE compiler ပြဿနာ) + LIMIT → Pageable
    @Query("SELECT c FROM CallInvite c WHERE c.calleeId = :calleeId AND c.status = 'PENDING' AND c.createdAt >= :since ORDER BY c.createdAt DESC")
    List<CallInvite> findLatestPendingList(
        @Param("calleeId") Long calleeId,
        @Param("since") LocalDateTime since,
        Pageable pageable
    );

    default Optional<CallInvite> findLatestPending(Long calleeId, LocalDateTime since) {
        List<CallInvite> list = findLatestPendingList(calleeId, since, PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    // ── Accept/Reject lookup ─────────────────────────
    @Query("SELECT c FROM CallInvite c WHERE c.roomId = :roomId AND c.calleeId = :calleeId ORDER BY c.createdAt DESC")
    List<CallInvite> findByRoomIdAndCalleeIdList(
        @Param("roomId") String roomId,
        @Param("calleeId") Long calleeId,
        Pageable pageable
    );

    default Optional<CallInvite> findByRoomIdAndCalleeId(String roomId, Long calleeId) {
        List<CallInvite> list = findByRoomIdAndCalleeIdList(roomId, calleeId, PageRequest.of(0, 1));
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    // ── Expire old PENDING invites ───────────────────
    @Modifying
    @Transactional
    @Query("UPDATE CallInvite c SET c.status = 'EXPIRED' WHERE c.calleeId = :calleeId AND c.status = 'PENDING' AND c.createdAt < :threshold")
    void expireOldPending(
        @Param("calleeId") Long calleeId,
        @Param("threshold") LocalDateTime threshold
    );
    
    @Query("SELECT pm.userId FROM ProjectMember pm WHERE pm.projectId = :projectId AND pm.status = 'ACTIVE'")
    List<Long> findActiveUserIdsByProjectId(@Param("projectId") Long projectId);
    
}