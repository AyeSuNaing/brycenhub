package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.AttendanceDto;
import jp.co.brycen.asn.model.AttendanceLog;
import jp.co.brycen.asn.model.Branch;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.repository.AttendanceLogRepository;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class AttendanceService {

    @Autowired private UserRepository userRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private AttendanceLogRepository attendanceLogRepository;

    // Expected headers (case-insensitive)
    private static final String[] REQUIRED_HEADERS = { "email", "date", "time in", "time out" };

    // Date formats to try
    private static final DateTimeFormatter[] DATE_FORMATS = {
        DateTimeFormatter.ofPattern("yyyy-MM-dd"),
        DateTimeFormatter.ofPattern("yyyy/MM/dd"),
        DateTimeFormatter.ofPattern("dd/MM/yyyy"),
        DateTimeFormatter.ofPattern("MM/dd/yyyy"),
        DateTimeFormatter.ofPattern("d-MMM-yyyy"),
        DateTimeFormatter.ofPattern("d-MMM-yy"),
    };

    private static final DateTimeFormatter[] TIME_FORMATS = {
        DateTimeFormatter.ofPattern("HH:mm"),
        DateTimeFormatter.ofPattern("HH:mm:ss"),
        DateTimeFormatter.ofPattern("h:mm a"),
        DateTimeFormatter.ofPattern("h:mm:ss a"),
    };

    // ══════════════════════════════════════════════
    // PARSE & PREVIEW
    // ══════════════════════════════════════════════
    public AttendanceDto.PreviewResponse parseExcel(MultipartFile file) throws Exception {

        // Pre-load user email map (case-insensitive)
        Map<String, User> userByEmail = new HashMap<>();
        for (User u : userRepository.findAll()) {
            if (u.getEmail() != null) {
                userByEmail.put(u.getEmail().toLowerCase(), u);
            }
        }

        // Pre-load branch + role for enrichment
        Map<Long, Branch> branchMap = new HashMap<>();
        for (Branch b : branchRepository.findAll()) branchMap.put(b.getId(), b);

        Map<Long, UserRole> roleMap = new HashMap<>();
        for (UserRole r : userRoleRepository.findAll()) roleMap.put(r.getId(), r);

        // Track duplicates within file (same email + date)
        Set<String> seenKeys = new HashSet<>();

        List<AttendanceDto.ParsedRow> rows = new ArrayList<>();
        int matched = 0, unmatched = 0, duplicate = 0, invalid = 0;

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new RuntimeException("Empty workbook");
            }

            // ── Header detection (row 0) ──
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new RuntimeException("Missing header row");

            Map<String, Integer> headerIdx = new HashMap<>();
            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                Cell cell = headerRow.getCell(c);
                if (cell == null) continue;
                String h = getCellString(cell).trim().toLowerCase();
                if (!h.isEmpty()) headerIdx.put(h, c);
            }

            // Validate required headers
            for (String req : REQUIRED_HEADERS) {
                if (!headerIdx.containsKey(req)) {
                    throw new RuntimeException("Missing required column: '" + req +
                        "'. Expected: Email, Date, Time In, Time Out (name optional)");
                }
            }

            int emailCol   = headerIdx.get("email");
            int dateCol    = headerIdx.get("date");
            int timeInCol  = headerIdx.get("time in");
            int timeOutCol = headerIdx.get("time out");
            Integer nameCol = headerIdx.get("name"); // optional

            // ── Parse data rows ──
            int last = sheet.getLastRowNum();
            for (int r = 1; r <= last; r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) continue;

                AttendanceDto.ParsedRow pr = new AttendanceDto.ParsedRow();
                pr.setRowNumber(r + 1); // 1-based for Excel display

                // Email
                String email = getCellString(row.getCell(emailCol)).trim().toLowerCase();
                pr.setEmail(email);

                // Name (optional)
                if (nameCol != null) {
                    pr.setName(getCellString(row.getCell(nameCol)).trim());
                }

                // Date
                LocalDate date = parseDate(row.getCell(dateCol));
                pr.setWorkDate(date);

                // Times
                pr.setTimeIn(parseTime(row.getCell(timeInCol)));
                pr.setTimeOut(parseTime(row.getCell(timeOutCol)));

                // Validation
                if (email.isEmpty()) {
                    pr.setStatus("INVALID");
                    pr.setMessage("Email is empty");
                    invalid++;
                    rows.add(pr);
                    continue;
                }
                if (date == null) {
                    pr.setStatus("INVALID");
                    pr.setMessage("Date invalid or missing");
                    invalid++;
                    rows.add(pr);
                    continue;
                }

                // Duplicate within file
                String key = email + "|" + date;
                if (!seenKeys.add(key)) {
                    pr.setStatus("DUPLICATE");
                    pr.setMessage("Same email+date appears twice in file");
                    duplicate++;
                    rows.add(pr);
                    continue;
                }

                // Match by email
                User u = userByEmail.get(email);
                if (u == null) {
                    pr.setStatus("UNMATCHED");
                    pr.setMessage("No user found with this email");
                    unmatched++;
                    rows.add(pr);
                    continue;
                }

                // Enrich with matched user info
                pr.setUserId(u.getId());
                pr.setMatchedName(u.getName());

                if (u.getRoleId() != null) {
                    UserRole role = roleMap.get(u.getRoleId());
                    if (role != null) pr.setMatchedRole(role.getDisplayName());
                }

                if (u.getBranchId() != null) {
                    Branch br = branchMap.get(u.getBranchId());
                    if (br != null) pr.setMatchedBranch(br.getName());
                }

                pr.setStatus("MATCHED");
                matched++;
                rows.add(pr);
            }
        }

        AttendanceDto.PreviewResponse resp = new AttendanceDto.PreviewResponse();
        resp.setTotalRows(rows.size());
        resp.setMatchedCount(matched);
        resp.setUnmatchedCount(unmatched);
        resp.setDuplicateCount(duplicate);
        resp.setInvalidCount(invalid);
        resp.setRows(rows);
        return resp;
    }

    // ══════════════════════════════════════════════
    // CONFIRM SAVE (upsert)
    // ══════════════════════════════════════════════
    @Transactional
    public AttendanceDto.SaveResponse saveBulk(
            AttendanceDto.ConfirmSaveRequest request, Long uploaderId) {

        int saved = 0, updated = 0, skipped = 0;

        for (AttendanceDto.SaveRow r : request.getRows()) {
            if (r.getUserId() == null || r.getWorkDate() == null) {
                skipped++;
                continue;
            }

            Optional<AttendanceLog> existing = attendanceLogRepository
                .findByUserIdAndWorkDate(r.getUserId(), r.getWorkDate());

            AttendanceLog log;
            if (existing.isPresent()) {
                log = existing.get();
                log.setTimeIn(r.getTimeIn());
                log.setTimeOut(r.getTimeOut());
                log.setIsDayoff(Boolean.TRUE.equals(r.getIsDayoff()));
                log.setNote(r.getNote());
                log.setSource("FINGERPRINT");
                log.setUpdatedAt(LocalDateTime.now());
                attendanceLogRepository.save(log);
                updated++;
            } else {
                log = new AttendanceLog();
                log.setUserId(r.getUserId());
                log.setWorkDate(r.getWorkDate());
                log.setTimeIn(r.getTimeIn());
                log.setTimeOut(r.getTimeOut());
                log.setIsDayoff(Boolean.TRUE.equals(r.getIsDayoff()));
                log.setNote(r.getNote());
                log.setSource("FINGERPRINT");
                log.setUploadedBy(uploaderId);
                attendanceLogRepository.save(log);
                saved++;
            }
        }

        AttendanceDto.SaveResponse resp = new AttendanceDto.SaveResponse();
        resp.setSavedCount(saved);
        resp.setUpdatedCount(updated);
        resp.setSkippedCount(skipped);
        resp.setMessage(String.format("Saved %d new, updated %d existing, skipped %d",
            saved, updated, skipped));
        return resp;
    }

    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════
    private String getCellString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:  return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toString();
                }
                double n = cell.getNumericCellValue();
                // Format integers without .0
                if (n == Math.floor(n)) return String.valueOf((long) n);
                return String.valueOf(n);
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try { return cell.getStringCellValue(); }
                catch (Exception e) { return String.valueOf(cell.getNumericCellValue()); }
            default: return "";
        }
    }

    private LocalDate parseDate(Cell cell) {
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                return cell.getDateCellValue().toInstant()
                    .atZone(ZoneId.systemDefault()).toLocalDate();
            }
            String s = getCellString(cell).trim();
            if (s.isEmpty()) return null;
            for (DateTimeFormatter fmt : DATE_FORMATS) {
                try { return LocalDate.parse(s, fmt); } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        return null;
    }

    private LocalTime parseTime(Cell cell) {
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC) {
                // Excel stores time as fractional day (0.5 = 12:00)
                double d = cell.getNumericCellValue();
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toInstant()
                        .atZone(ZoneId.systemDefault()).toLocalTime();
                }
                // Convert fraction to time
                int totalSeconds = (int) Math.round(d * 24 * 3600);
                int h = totalSeconds / 3600;
                int m = (totalSeconds % 3600) / 60;
                int s = totalSeconds % 60;
                if (h >= 0 && h < 24) return LocalTime.of(h, m, s);
            }
            String s = getCellString(cell).trim();
            if (s.isEmpty()) return null;
            for (DateTimeFormatter fmt : TIME_FORMATS) {
                try { return LocalTime.parse(s, fmt); } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String s = getCellString(cell).trim();
                if (!s.isEmpty()) return false;
            }
        }
        return true;
    }
}
