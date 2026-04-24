package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Staff self-service: submit + view + edit own Leave/OT requests
 * Base: /api/staff
 */
@RestController
@RequestMapping("/api/staff")
@CrossOrigin(origins = "http://localhost:4200")
public class StaffRequestController {

    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private OtRequestRepository    otRequestRepository;
    @Autowired private UserRepository         userRepository;
    @Autowired private ProjectRepository      projectRepository;

    // ════════════════════════════════════════════════════════
    // LEAVE — GET my requests
    // GET /api/staff/leave-requests/my
    // ════════════════════════════════════════════════════════
    @GetMapping("/leave-requests/my")
    public ResponseEntity<List<MyLeaveResponse>> getMyLeave(
            @AuthenticationPrincipal User user) {

        List<MyLeaveResponse> result = leaveRequestRepository
            .findByUserIdOrderByCreatedAtDesc(user.getId())
            .stream().map(lv -> {
                MyLeaveResponse r = new MyLeaveResponse();
                r.setId(lv.getId());
                r.setLeaveType(lv.getLeaveType());
                r.setStartDate(lv.getStartDate());
                r.setEndDate(lv.getEndDate());
                r.setTotalDays(lv.getTotalDays());
                r.setReason(lv.getReason());
                r.setStatus(lv.getStatus());
                r.setRejectReason(lv.getRejectReason());
                r.setCreatedAt(lv.getCreatedAt());
                return r;
            }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ════════════════════════════════════════════════════════
    // LEAVE — submit new request
    // POST /api/staff/leave-requests
    // ════════════════════════════════════════════════════════
    @PostMapping("/leave-requests")
    public ResponseEntity<?> submitLeave(
            @AuthenticationPrincipal User user,
            @RequestBody LeaveRequest body) {
        try {
            LeaveRequest lv = new LeaveRequest();
            lv.setUserId(user.getId());
            lv.setLeaveType(body.getLeaveType() != null ? body.getLeaveType() : "ANNUAL");
            lv.setStartDate(body.getStartDate());
            lv.setEndDate(body.getEndDate());
            long days = ChronoUnit.DAYS.between(body.getStartDate(), body.getEndDate()) + 1;
            lv.setTotalDays((int) Math.max(1, days));
            lv.setReason(body.getReason());
            lv.setStatus("PENDING");
            lv.setCreatedAt(LocalDateTime.now());
            leaveRequestRepository.save(lv);
            return ResponseEntity.ok(Map.of("message", "Leave request submitted", "success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage(), "success", false));
        }
    }

    // ════════════════════════════════════════════════════════
    // OT — GET my requests
    // GET /api/staff/ot-requests/my
    // ════════════════════════════════════════════════════════
    @GetMapping("/ot-requests/my")
    public ResponseEntity<List<MyOtResponse>> getMyOt(
            @AuthenticationPrincipal User user) {

        List<MyOtResponse> result = otRequestRepository
            .findByUserIdOrderByCreatedAtDesc(user.getId())
            .stream().map(ot -> {
                MyOtResponse r = new MyOtResponse();
                r.setId(ot.getId());
                r.setWorkDate(ot.getWorkDate());
                r.setOtHours(ot.getOtHours());
                r.setDayType(ot.getDayType());
                r.setProjectId(ot.getProjectId());
                // ✅ project name resolve
                if (ot.getProjectId() != null) {
                    projectRepository.findById(ot.getProjectId())
                        .ifPresent(p -> r.setProjectName(p.getTitle()));
                }
                r.setReason(ot.getReason());
                r.setStatus(ot.getStatus());
                r.setRejectReason(ot.getRejectReason());
                r.setCreatedAt(ot.getCreatedAt());
                return r;
            }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ════════════════════════════════════════════════════════
    // OT — submit new request
    // POST /api/staff/ot-requests
    // ════════════════════════════════════════════════════════
    @PostMapping("/ot-requests")
    public ResponseEntity<?> submitOt(
            @AuthenticationPrincipal User user,
            @RequestBody OtRequestBody body) {
        try {
            OtRequest ot = new OtRequest();
            ot.setUserId(user.getId());
            ot.setWorkDate(body.getWorkDate());
            ot.setOtHours(body.getOtHours());
            ot.setDayType(body.getDayType() != null ? body.getDayType() : "WEEKDAY");
            ot.setProjectId(body.getProjectId());
            ot.setReason(body.getReason());
            ot.setStatus("PENDING");
            ot.setCreatedAt(LocalDateTime.now());
            ot.setOtRate(resolveRate(ot.getDayType()));
            otRequestRepository.save(ot);
            return ResponseEntity.ok(Map.of("message", "OT request submitted", "success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage(), "success", false));
        }
    }

    // ════════════════════════════════════════════════════════
    // OT — edit PENDING request
    // PUT /api/staff/ot-requests/{id}
    // ════════════════════════════════════════════════════════
    @PutMapping("/ot-requests/{id}")
    public ResponseEntity<?> updateOt(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody OtRequestBody body) {
        try {
            OtRequest ot = otRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("OT request not found"));

            if (!ot.getUserId().equals(user.getId())) {
                return ResponseEntity.status(403)
                    .body(Map.of("message", "Access denied", "success", false));
            }
            if (!"PENDING".equals(ot.getStatus())) {
                return ResponseEntity.badRequest()
                    .body(Map.of("message", "Only pending requests can be edited", "success", false));
            }

            ot.setWorkDate(body.getWorkDate());
            ot.setOtHours(body.getOtHours());
            ot.setDayType(body.getDayType() != null ? body.getDayType() : "WEEKDAY");
            ot.setProjectId(body.getProjectId());
            ot.setReason(body.getReason());
            ot.setOtRate(resolveRate(ot.getDayType()));
            otRequestRepository.save(ot);

            return ResponseEntity.ok(Map.of("message", "OT request updated", "success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage(), "success", false));
        }
    }

    // ── Helper ───────────────────────────────────────────
    private BigDecimal resolveRate(String dayType) {
        if ("WEEKEND".equals(dayType)) return new BigDecimal("2.0");
        if ("HOLIDAY".equals(dayType)) return new BigDecimal("2.5");
        return new BigDecimal("1.5");
    }

    // ── DTOs ─────────────────────────────────────────────

    @Data
    public static class MyLeaveResponse {
        private Long id;
        private String leaveType, reason, status, rejectReason;
        private LocalDate startDate, endDate;
        private Integer totalDays;
        private LocalDateTime createdAt;
    }

    @Data
    public static class MyOtResponse {
        private Long id;
        private LocalDate workDate;
        private BigDecimal otHours;
        private String dayType, reason, status, rejectReason;
        private Long projectId;
        private String projectName;   // ✅ project name
        private LocalDateTime createdAt;
    }

    @Data
    public static class OtRequestBody {
        private LocalDate workDate;
        private BigDecimal otHours;
        private String dayType;
        private Long projectId;
        private String reason;
    }
}