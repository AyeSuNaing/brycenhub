package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.CountryBranchDto;
import jp.co.brycen.asn.model.Country;
import jp.co.brycen.asn.repository.CountryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CountryService {

    @Autowired
    private CountryRepository countryRepository;

    // GET all countries
    public List<Country> getAllCountries() {
        return countryRepository.findAll();
    }

    // GET country by id
    public Country getCountryById(Long id) {
        return countryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Country not found"));
    }

    // CREATE country (BOSS only)
    public Country createCountry(CountryBranchDto.CountryRequest request) {
        if (countryRepository.existsByCode(request.getCode())) {
            throw new RuntimeException("Country code already exists: " + request.getCode());
        }
        Country country = new Country();
        country.setCode(request.getCode().toUpperCase());
        country.setName(request.getName());
        return countryRepository.save(country);
    }

    // UPDATE country
    public Country updateCountry(Long id, CountryBranchDto.CountryRequest request) {
        Country country = getCountryById(id);
        country.setCode(request.getCode().toUpperCase());
        country.setName(request.getName());
        return countryRepository.save(country);
    }

    // DELETE country
    public void deleteCountry(Long id) {
        if (!countryRepository.existsById(id)) {
            throw new RuntimeException("Country not found");
        }
        countryRepository.deleteById(id);
    }
}
