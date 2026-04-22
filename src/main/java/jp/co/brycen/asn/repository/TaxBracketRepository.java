package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.TaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaxBracketRepository extends JpaRepository<TaxBracket, Long> {

    /** All brackets for a country, ordered by min_salary ascending */
    @Query("SELECT t FROM TaxBracket t WHERE t.countryId = :countryId ORDER BY t.minSalary ASC")
    List<TaxBracket> findByCountryIdOrderByMinSalaryAsc(@Param("countryId") Long countryId);

    /** Delete all for a country (for seed replace) */
    void deleteByCountryId(Long countryId);

    /** Count brackets per country (quick stat) */
    long countByCountryId(Long countryId);
}
