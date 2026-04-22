package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.model.Branch;
import jp.co.brycen.asn.model.PublicHoliday;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.PublicHolidayRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

/**
 * Public Holiday Controller — CRUD for country holidays
 *
 * Scope: Country-based. Admin/VP can manage holidays in their own country.
 *        Boss/CountryDirector can manage all countries.
 *
 * All endpoints prefixed with /api/public-holidays
 */
@RestController
@RequestMapping("/api/public-holidays")
public class PublicHolidayController {

    @Autowired private PublicHolidayRepository publicHolidayRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private UserRoleRepository userRoleRepository;

    // ============================================================
    // HELPERS
    // ============================================================

    /** Resolve admin's country_id from their branch */
    private Long resolveCountryId(User admin) {
        if (admin == null || admin.getBranchId() == null) return null;
        return branchRepository.findById(admin.getBranchId())
                .map(Branch::getCountryId)
                .orElse(null);
    }

    /** Get role name from user's roleId via UserRoleRepository lookup */
    private String getRoleName(User admin) {
        if (admin == null || admin.getRoleId() == null) return "";
        return userRoleRepository.findById(admin.getRoleId())
                .map(UserRole::getName)
                .orElse("");
    }

    /** Check if user has global scope (can edit any country) */
    private boolean isGlobalAdmin(User admin) {
        String roleName = getRoleName(admin);
        return "BOSS".equals(roleName) || "COUNTRY_DIRECTOR".equals(roleName);
    }

    // ============================================================
    // ① LIST — auto-filter by admin's country + year
    // GET /api/public-holidays?year=2026
    // ============================================================
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<List<PublicHoliday>> list(
            @AuthenticationPrincipal User admin,
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        Long countryId = resolveCountryId(admin);

        if (countryId == null) {
            // Global admin with no branch → return all for year
            return ResponseEntity.ok(
                publicHolidayRepository.findAll().stream()
                    .filter(h -> h.getHolidayDate().getYear() == y)
                    .sorted((a, b) -> a.getHolidayDate().compareTo(b.getHolidayDate()))
                    .toList()
            );
        }

        return ResponseEntity.ok(publicHolidayRepository.findByCountryIdAndYear(countryId, y));
    }

    // ============================================================
    // ② LIST BY COUNTRY
    // GET /api/public-holidays/by-country/3?year=2026
    // ============================================================
    @GetMapping("/by-country/{countryId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<List<PublicHoliday>> listByCountry(
            @PathVariable Long countryId,
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(publicHolidayRepository.findByCountryIdAndYear(countryId, y));
    }

    // ============================================================
    // ③ LIST BY MONTH
    // GET /api/public-holidays/by-month?year=2026&month=4
    // ============================================================
    @GetMapping("/by-month")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<List<PublicHoliday>> listByMonth(
            @AuthenticationPrincipal User admin,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        int y = year != null ? year : LocalDate.now().getYear();
        int m = month != null ? month : LocalDate.now().getMonthValue();
        Long countryId = resolveCountryId(admin);

        List<PublicHoliday> list = countryId != null
                ? publicHolidayRepository.findByCountryIdAndYearAndMonth(countryId, y, m)
                : publicHolidayRepository.findByYearAndMonth(y, m);

        return ResponseEntity.ok(list);
    }

    // ============================================================
    // ④ GET BY ID
    // ============================================================
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'VICE_PRESIDENT', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return publicHolidayRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.badRequest()
                        .body(new AuthDto.MessageResponse("Holiday not found", false)));
    }

    // ============================================================
    // ⑤ CREATE — auto-set country from admin's branch
    // POST /api/public-holidays
    // ============================================================
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> create(
            @Valid @RequestBody HolidayRequest body,
            @AuthenticationPrincipal User admin) {
        try {
            Long countryId = body.getCountryId() != null
                    ? body.getCountryId()
                    : resolveCountryId(admin);

            if (countryId == null) {
                return ResponseEntity.badRequest()
                        .body(new AuthDto.MessageResponse("Country ID required", false));
            }

            // Duplicate check (UNIQUE constraint country_id + holiday_date)
            if (publicHolidayRepository.existsByCountryIdAndDate(countryId, body.getHolidayDate())) {
                return ResponseEntity.badRequest().body(
                    new AuthDto.MessageResponse("Holiday already exists on this date", false));
            }

            PublicHoliday h = new PublicHoliday();
            h.setCountryId(countryId);
            h.setHolidayDate(body.getHolidayDate());
            h.setName(body.getName());
            h.setCreatedBy(admin.getId());

            PublicHoliday saved = publicHolidayRepository.save(h);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑥ UPDATE
    // PUT /api/public-holidays/{id}
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @Valid @RequestBody HolidayRequest body,
            @AuthenticationPrincipal User admin) {
        try {
            PublicHoliday h = publicHolidayRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Holiday not found"));

            // Branch admin can only update their own country's holidays
            if (!isGlobalAdmin(admin)) {
                Long adminCountryId = resolveCountryId(admin);
                if (adminCountryId == null || !adminCountryId.equals(h.getCountryId())) {
                    return ResponseEntity.status(403)
                            .body(new AuthDto.MessageResponse("Access denied — not your country", false));
                }
            }

            h.setHolidayDate(body.getHolidayDate());
            h.setName(body.getName());
            if (body.getCountryId() != null) h.setCountryId(body.getCountryId());

            return ResponseEntity.ok(publicHolidayRepository.save(h));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑦ DELETE
    // DELETE /api/public-holidays/{id}
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User admin) {
        try {
            PublicHoliday h = publicHolidayRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Holiday not found"));

            if (!isGlobalAdmin(admin)) {
                Long adminCountryId = resolveCountryId(admin);
                if (adminCountryId == null || !adminCountryId.equals(h.getCountryId())) {
                    return ResponseEntity.status(403)
                            .body(new AuthDto.MessageResponse("Access denied — not your country", false));
                }
            }

            publicHolidayRepository.deleteById(id);
            return ResponseEntity.ok(new AuthDto.MessageResponse("Holiday deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // ⑧ BULK CREATE
    // POST /api/public-holidays/bulk
    // Body: { "countryId": 3, "holidays": [{"date":"...","name":"..."}, ...] }
    // ============================================================
    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNTRY_DIRECTOR', 'BOSS')")
    public ResponseEntity<?> bulkCreate(
            @Valid @RequestBody BulkRequest body,
            @AuthenticationPrincipal User admin) {
        try {
            Long countryId = body.getCountryId() != null
                    ? body.getCountryId()
                    : resolveCountryId(admin);

            if (countryId == null) {
                return ResponseEntity.badRequest()
                        .body(new AuthDto.MessageResponse("Country ID required", false));
            }

            int created = 0;
            int skipped = 0;
            for (BulkRequest.Item item : body.getHolidays()) {
                if (publicHolidayRepository.existsByCountryIdAndDate(countryId, item.getDate())) {
                    skipped++;
                    continue;
                }
                PublicHoliday h = new PublicHoliday();
                h.setCountryId(countryId);
                h.setHolidayDate(item.getDate());
                h.setName(item.getName());
                h.setCreatedBy(admin.getId());
                publicHolidayRepository.save(h);
                created++;
            }

            BulkResponse res = new BulkResponse();
            res.setCreated(created);
            res.setSkipped(skipped);
            res.setMessage(String.format("Created %d, skipped %d duplicates", created, skipped));
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DTOs
    // ============================================================
    @Data
    public static class HolidayRequest {
        private Long countryId;       // optional — auto from admin's branch

        @NotNull(message = "Holiday date is required")
        private LocalDate holidayDate;

        private String name;
    }

    @Data
    public static class BulkRequest {
        private Long countryId;
        private List<Item> holidays;

        @Data
        public static class Item {
            @NotNull
            private LocalDate date;
            private String name;
        }
    }

    @Data
    public static class BulkResponse {
        private int created;
        private int skipped;
        private String message;
    }
}