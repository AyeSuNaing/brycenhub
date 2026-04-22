package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AttendanceDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.service.AttendanceService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    // ══════════════════════════════════════════════
    // ① Upload Excel → Parse → Return Preview
    // ══════════════════════════════════════════════
    @PostMapping("/upload-preview")
    public ResponseEntity<?> uploadPreview(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User admin) {

        try {
            // Validate
            if (file.isEmpty()) {
                return errorResp("File is empty");
            }
            if (file.getSize() > MAX_FILE_SIZE) {
                return errorResp("File too large. Max 5MB allowed.");
            }
            String name = file.getOriginalFilename();
            if (name == null || !(name.toLowerCase().endsWith(".xlsx")
                                 || name.toLowerCase().endsWith(".xls"))) {
                return errorResp("Only .xlsx or .xls files are supported");
            }

            AttendanceDto.PreviewResponse preview = attendanceService.parseExcel(file);
            return ResponseEntity.ok(preview);

        } catch (Exception e) {
            return errorResp("Parse error: " + e.getMessage());
        }
    }

    // ══════════════════════════════════════════════
    // ② Confirm Save (after preview review)
    // ══════════════════════════════════════════════
    @PostMapping("/confirm-save")
    public ResponseEntity<AttendanceDto.SaveResponse> confirmSave(
            @RequestBody AttendanceDto.ConfirmSaveRequest request,
            @AuthenticationPrincipal User admin) {

        AttendanceDto.SaveResponse resp = attendanceService.saveBulk(
            request, admin != null ? admin.getId() : null);
        return ResponseEntity.ok(resp);
    }

    // ══════════════════════════════════════════════
    // HELPER
    // ══════════════════════════════════════════════
    private ResponseEntity<Map<String, Object>> errorResp(String message) {
        Map<String, Object> err = new HashMap<>();
        err.put("success", false);
        err.put("message", message);
        return ResponseEntity.badRequest().body(err);
    }
}
