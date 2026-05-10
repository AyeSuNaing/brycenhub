package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.CallInvite;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.CallInviteRepository;
import jp.co.brycen.asn.repository.ProjectMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/call")
@RequiredArgsConstructor
public class CallController {

    private final CallInviteRepository callInviteRepository;
    private final ProjectMemberRepository projectMemberRepository;

    // ── 1-to-1 invite ───────────────────────────────
    @PostMapping("/invite")
    public ResponseEntity<?> invite(@RequestBody Map<String, Object> body) {
        Long calleeId = Long.parseLong(String.valueOf(body.get("calleeId")));
        callInviteRepository.expireOldPending(calleeId, LocalDateTime.now().minusSeconds(30));

        CallInvite invite = new CallInvite();
        invite.setCallerId(Long.parseLong(String.valueOf(body.get("callerId"))));
        invite.setCalleeId(calleeId);
        invite.setRoomId(String.valueOf(body.get("roomId")));
        invite.setMode(String.valueOf(body.get("mode")));
        invite.setCallerName(String.valueOf(body.get("callerName")));
        invite.setCallerUserId(String.valueOf(body.get("callerUserId")));
        invite.setGroup(Boolean.parseBoolean(String.valueOf(body.getOrDefault("isGroup", false))));
        invite.setStatus("PENDING");
        invite.setCreatedAt(LocalDateTime.now());
        callInviteRepository.save(invite);
        return ResponseEntity.ok().build();
    }

    // ── Group invite — project members အားလုံးကို ───
    @PostMapping("/invite-group")
    public ResponseEntity<?> inviteGroup(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User currentUser) {

        Long   projectId     = Long.parseLong(String.valueOf(body.get("projectId")));
        String roomId        = String.valueOf(body.get("roomId"));
        String mode          = String.valueOf(body.get("mode"));
        String callerName    = String.valueOf(body.get("callerName"));
        String callerUserId  = String.valueOf(body.get("callerUserId"));
        Long   callerId      = Long.parseLong(String.valueOf(body.get("callerId")));

        // Active project members ရယူ (caller ကိုယ်တိုင် ဖယ်)
        List<Long> memberIds = projectMemberRepository.findActiveUserIdsByProjectId(projectId);

        LocalDateTime now = LocalDateTime.now();
        for (Long memberId : memberIds) {
            if (memberId.equals(callerId)) continue;

            callInviteRepository.expireOldPending(memberId, now.minusSeconds(30));

            CallInvite invite = new CallInvite();
            invite.setCallerId(callerId);
            invite.setCalleeId(memberId);
            invite.setRoomId(roomId);
            invite.setMode(mode);
            invite.setCallerName(callerName);
            invite.setCallerUserId(callerUserId);
            invite.setGroup(true);
            invite.setStatus("PENDING");
            invite.setCreatedAt(now);
            callInviteRepository.save(invite);
        }
        return ResponseEntity.ok().build();
    }

    // ── Receiver polls for incoming call ─────────────
    @GetMapping("/incoming/{calleeId}")
    public ResponseEntity<?> incoming(@PathVariable Long calleeId) {
        LocalDateTime since = LocalDateTime.now().minusSeconds(30);
        Optional<CallInvite> opt = callInviteRepository.findLatestPending(calleeId, since);

        if (opt.isEmpty()) {
            return ResponseEntity.noContent().build();
        }

        CallInvite c = opt.get();
        Map<String, Object> res = new HashMap<>();
        res.put("roomId",       c.getRoomId());
        res.put("mode",         c.getMode());
        res.put("callerName",   c.getCallerName());
        res.put("callerUserId", c.getCallerUserId());
        res.put("callerId",     c.getCallerId());
        res.put("isGroup",      c.isGroup());
        return ResponseEntity.ok(res);
    }

    // ── Receiver accepts ─────────────────────────────
    @PostMapping("/accept")
    public ResponseEntity<?> accept(@RequestBody Map<String, Object> body) {
        String roomId   = String.valueOf(body.get("roomId"));
        Long   calleeId = Long.parseLong(String.valueOf(body.get("calleeId")));
        callInviteRepository.findByRoomIdAndCalleeId(roomId, calleeId)
            .ifPresent(c -> { c.setStatus("ACCEPTED"); callInviteRepository.save(c); });
        return ResponseEntity.ok().build();
    }

    // ── Receiver rejects ─────────────────────────────
    @PostMapping("/reject")
    public ResponseEntity<?> reject(@RequestBody Map<String, Object> body) {
        String roomId   = String.valueOf(body.get("roomId"));
        Long   calleeId = Long.parseLong(String.valueOf(body.get("calleeId")));
        callInviteRepository.findByRoomIdAndCalleeId(roomId, calleeId)
            .ifPresent(c -> { c.setStatus("REJECTED"); callInviteRepository.save(c); });
        return ResponseEntity.ok().build();
    }
}