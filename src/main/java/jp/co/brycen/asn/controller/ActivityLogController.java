package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.ActivityLog;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.ActivityLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {

    @Autowired
    private ActivityLogService activityLogService;

    // GET /api/activity-logs/by-project/{projectId}
    @GetMapping("/by-project/{projectId}")
    public ResponseEntity<List<ActivityLog>> getByProject(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(activityLogService.getByProject(projectId));
    }

    // GET /api/activity-logs/my
    @GetMapping("/my")
    public ResponseEntity<List<ActivityLog>> getMyLogs(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(activityLogService.getByUser(user.getId()));
    }

    // GET /api/activity-logs/task/{taskId}
    @GetMapping("/task/{taskId}")
    public ResponseEntity<List<ActivityLog>> getTaskHistory(
            @PathVariable Long taskId) {
        return ResponseEntity.ok(
                activityLogService.getByTarget("TASK", taskId));  // ← getByTarget
    }
}
