package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.AuthDto;
import jp.co.brycen.asn.dto.CountryBranchDto;
import jp.co.brycen.asn.model.Country;
import jp.co.brycen.asn.service.CountryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/countries")
public class CountryController {

    @Autowired
    private CountryService countryService;

    // ============================================================
    // GET /api/countries
    // All authenticated users မြင်လို့ရ
    // ============================================================
    @GetMapping
    public ResponseEntity<List<Country>> getAllCountries() {
        return ResponseEntity.ok(countryService.getAllCountries());
    }

    // ============================================================
    // GET /api/countries/{id}
    // ============================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getCountryById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(countryService.getCountryById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // POST /api/countries
    // BOSS only
    // ============================================================
    @PostMapping
    @PreAuthorize("hasRole('BOSS')")
    public ResponseEntity<?> createCountry(
            @Valid @RequestBody CountryBranchDto.CountryRequest request) {
        try {
            Country country = countryService.createCountry(request);
            return ResponseEntity.ok(country);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // PUT /api/countries/{id}
    // BOSS only
    // ============================================================
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('BOSS')")
    public ResponseEntity<?> updateCountry(
            @PathVariable Long id,
            @Valid @RequestBody CountryBranchDto.CountryRequest request) {
        try {
            return ResponseEntity.ok(countryService.updateCountry(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }

    // ============================================================
    // DELETE /api/countries/{id}
    // BOSS only
    // ============================================================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('BOSS')")
    public ResponseEntity<?> deleteCountry(@PathVariable Long id) {
        try {
            countryService.deleteCountry(id);
            return ResponseEntity.ok(
                    new AuthDto.MessageResponse("Country deleted", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new AuthDto.MessageResponse(e.getMessage(), false));
        }
    }
}
