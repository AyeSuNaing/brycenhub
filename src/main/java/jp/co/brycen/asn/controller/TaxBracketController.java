package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.TaxBracketDto;
import jp.co.brycen.asn.model.TaxBracket;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.TaxBracketRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/tax-brackets")
public class TaxBracketController {

    @Autowired private TaxBracketRepository taxRepo;
    @Autowired private BranchRepository     branchRepo;
    @Autowired private UserRoleRepository   userRoleRepo;

    // ═══════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════

    private String roleNameOf(User u) {
        if (u == null || u.getRoleId() == null) return "";
        return userRoleRepo.findById(u.getRoleId())
                .map(r -> r.getName())
                .orElse("");
    }

    private boolean isGlobalAdmin(User u) {
        String r = roleNameOf(u);
        return "BOSS".equals(r) || "COUNTRY_DIRECTOR".equals(r);
    }

    private Long resolveAdminCountryId(User u) {
        if (u == null || u.getBranchId() == null) return null;
        return branchRepo.findById(u.getBranchId())
                .map(b -> b.getCountryId())
                .orElse(null);
    }

    private ResponseEntity<?> denyIfNotAllowed(User admin, Long targetCountryId) {
        if (isGlobalAdmin(admin)) return null;
        Long adminCountry = resolveAdminCountryId(admin);
        if (adminCountry == null || !adminCountry.equals(targetCountryId)) {
            return ResponseEntity.status(403)
                    .body(new AuthDto.MessageResponse(
                            "Access denied — you can only manage your branch country", false));
        }
        return null;
    }

    // ═══════════════════════════════════════════════════
    // READ — ✅ isAuthenticated() = login ဝင်သူ အားလုံး ကြည့်လို့ရ
    // ═══════════════════════════════════════════════════

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyCountryBrackets(@AuthenticationPrincipal User admin) {
        Long countryId = resolveAdminCountryId(admin);
        if (countryId == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(taxRepo.findByCountryIdOrderByMinSalaryAsc(countryId));
    }

    @GetMapping("/by-country/{countryId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getByCountry(@PathVariable Long countryId) {
        return ResponseEntity.ok(taxRepo.findByCountryIdOrderByMinSalaryAsc(countryId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return taxRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(new AuthDto.MessageResponse("Not found", false)));
    }

    // ═══════════════════════════════════════════════════
    // CREATE — Admin / CD / Boss ပဲ ပြင်လို့ရ
    // ═══════════════════════════════════════════════════

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<?> create(
            @Valid @RequestBody TaxBracketDto.UpsertRequest req,
            @AuthenticationPrincipal User admin) {

        Long countryId = req.getCountryId() != null
                ? req.getCountryId()
                : resolveAdminCountryId(admin);

        if (countryId == null) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("Country not resolved", false));
        }

        ResponseEntity<?> deny = denyIfNotAllowed(admin, countryId);
        if (deny != null) return deny;

        if (req.getMaxSalary() != null && req.getMinSalary().compareTo(req.getMaxSalary()) >= 0) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("min_salary must be less than max_salary", false));
        }

        TaxBracket t = new TaxBracket();
        t.setCountryId(countryId);
        t.setMinSalary(req.getMinSalary());
        t.setMaxSalary(req.getMaxSalary());
        t.setTaxRate(req.getTaxRate());
        t.setCreatedBy(admin.getId());

        return ResponseEntity.ok(taxRepo.save(t));
    }

    // ═══════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @Valid @RequestBody TaxBracketDto.UpsertRequest req,
            @AuthenticationPrincipal User admin) {

        TaxBracket existing = taxRepo.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.status(404)
                    .body(new AuthDto.MessageResponse("Not found", false));
        }

        ResponseEntity<?> deny = denyIfNotAllowed(admin, existing.getCountryId());
        if (deny != null) return deny;

        if (req.getMaxSalary() != null && req.getMinSalary().compareTo(req.getMaxSalary()) >= 0) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("min_salary must be less than max_salary", false));
        }

        existing.setMinSalary(req.getMinSalary());
        existing.setMaxSalary(req.getMaxSalary());
        existing.setTaxRate(req.getTaxRate());

        return ResponseEntity.ok(taxRepo.save(existing));
    }

    // ═══════════════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════════════

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User admin) {

        TaxBracket existing = taxRepo.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.status(404)
                    .body(new AuthDto.MessageResponse("Not found", false));
        }

        ResponseEntity<?> deny = denyIfNotAllowed(admin, existing.getCountryId());
        if (deny != null) return deny;

        taxRepo.delete(existing);
        return ResponseEntity.ok(new AuthDto.MessageResponse("Deleted", true));
    }

    // ═══════════════════════════════════════════════════
    // BULK SEED
    // ═══════════════════════════════════════════════════

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> bulkSeed(
            @Valid @RequestBody TaxBracketDto.BulkRequest req,
            @AuthenticationPrincipal User admin) {

        Long countryId = req.getCountryId() != null
                ? req.getCountryId()
                : resolveAdminCountryId(admin);

        if (countryId == null) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("Country not resolved", false));
        }

        ResponseEntity<?> deny = denyIfNotAllowed(admin, countryId);
        if (deny != null) return deny;

        long existingCount = taxRepo.countByCountryId(countryId);
        taxRepo.deleteByCountryId(countryId);

        int created = 0;
        for (TaxBracketDto.BracketItem item : req.getBrackets()) {
            TaxBracket t = new TaxBracket();
            t.setCountryId(countryId);
            t.setMinSalary(item.getMinSalary());
            t.setMaxSalary(item.getMaxSalary());
            t.setTaxRate(item.getTaxRate());
            t.setCreatedBy(admin.getId());
            taxRepo.save(t);
            created++;
        }

        TaxBracketDto.BulkResponse res = new TaxBracketDto.BulkResponse();
        res.setCreated(created);
        res.setReplaced((int) existingCount);
        res.setMessage("Seeded " + created + " brackets (replaced " + existingCount + ")");
        return ResponseEntity.ok(res);
    }

    // ═══════════════════════════════════════════════════
    // TAX CALCULATOR — ✅ isAuthenticated()
    // ═══════════════════════════════════════════════════

    @PostMapping("/calculate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> calculate(
            @Valid @RequestBody TaxBracketDto.CalcRequest req,
            @AuthenticationPrincipal User admin) {

        Long countryId = req.getCountryId() != null
                ? req.getCountryId()
                : resolveAdminCountryId(admin);

        if (countryId == null) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("Country not resolved", false));
        }

        List<TaxBracket> brackets = taxRepo.findByCountryIdOrderByMinSalaryAsc(countryId);
        if (brackets.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse("No tax brackets configured for this country", false));
        }

        BigDecimal salary = req.getSalary();
        BigDecimal totalTax = BigDecimal.ZERO;
        List<TaxBracketDto.CalcBreakdown> breakdown = new ArrayList<>();

        for (TaxBracket b : brackets) {
            BigDecimal from = b.getMinSalary();
            BigDecimal to = b.getMaxSalary();

            if (salary.compareTo(from) <= 0) break;

            BigDecimal upper = (to == null) ? salary : to.min(salary);
            BigDecimal taxable = upper.subtract(from).max(BigDecimal.ZERO);

            if (taxable.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal bracketTax = taxable
                        .multiply(b.getTaxRate())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                totalTax = totalTax.add(bracketTax);

                TaxBracketDto.CalcBreakdown row = new TaxBracketDto.CalcBreakdown();
                row.setFrom(from);
                row.setTo(to);
                row.setRate(b.getTaxRate());
                row.setTaxableAmount(taxable);
                row.setTaxForBracket(bracketTax);
                breakdown.add(row);
            }

            if (to != null && salary.compareTo(to) <= 0) break;
        }

        BigDecimal effectiveRate = salary.compareTo(BigDecimal.ZERO) > 0
                ? totalTax.multiply(BigDecimal.valueOf(100))
                          .divide(salary, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        TaxBracketDto.CalcResponse res = new TaxBracketDto.CalcResponse();
        res.setSalary(salary);
        res.setTotalTax(totalTax);
        res.setEffectiveRate(effectiveRate);
        res.setNetSalary(salary.subtract(totalTax));
        res.setBreakdown(breakdown);

        return ResponseEntity.ok(res);
    }
}