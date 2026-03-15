package jp.co.brycen.asn.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class CountryBranchDto {

    // ===== COUNTRY =====
    @Data
    public static class CountryRequest {
        @NotBlank(message = "Code is required")
        private String code;

        @NotBlank(message = "Name is required")
        private String name;
    }

    // ===== BRANCH =====
    @Data
    public static class BranchRequest {
        @NotBlank(message = "Name is required")
        private String name;

        @NotNull(message = "Country ID is required")
        private Long countryId;

        private String address;
    }
}
