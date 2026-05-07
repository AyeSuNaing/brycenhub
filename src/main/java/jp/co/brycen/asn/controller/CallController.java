package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.CallInvite;
import jp.co.brycen.asn.repository.CallInviteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/call")
@RequiredArgsConstructor
public class CallController {

    private final CallInviteRepository callInviteRepository;

    // ── Caller sends invite ──────────────────────────
    @PostMapping("/invite")
    public ResponseEntity<?> invite(@RequestBody Map<String, Object> body) {
        CallInvite invite = new CallInvite();
        invite.setCallerId(Long.parseLong(String.valueOf(body.get("callerId"))));
        invite.setCalleeId(Long.parseLong(String.valueOf(body.get("calleeId"))));
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

    // ── Receiver polls for incoming call ─────────────
    @GetMapping("/incoming/{calleeId}")
    public ResponseEntity<?> incoming(@PathVariable Long calleeId) {
        LocalDateTime since = LocalDateTime.now().minusSeconds(30);
        Optional<CallInvite> opt = callInviteRepository.findLatestPending(calleeId, since);

        if (opt.isEmpty()) {
            return ResponseEntity.ok().build();
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
        String roomId = String.valueOf(body.get("roomId"));
        Long calleeId = Long.parseLong(String.valueOf(body.get("calleeId")));
        callInviteRepository.findByRoomIdAndCalleeId(roomId, calleeId)
            .ifPresent(c -> { c.setStatus("ACCEPTED"); callInviteRepository.save(c); });
        return ResponseEntity.ok().build();
    }

    // ── Receiver rejects ─────────────────────────────
    @PostMapping("/reject")
    public ResponseEntity<?> reject(@RequestBody Map<String, Object> body) {
        String roomId = String.valueOf(body.get("roomId"));
        Long calleeId = Long.parseLong(String.valueOf(body.get("calleeId")));
        callInviteRepository.findByRoomIdAndCalleeId(roomId, calleeId)
            .ifPresent(c -> { c.setStatus("REJECTED"); callInviteRepository.save(c); });
        return ResponseEntity.ok().build();
    }
}
