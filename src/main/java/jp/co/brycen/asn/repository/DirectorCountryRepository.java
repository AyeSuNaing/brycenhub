package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.DirectorCountry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DirectorCountryRepository extends JpaRepository<DirectorCountry, Long> {
    List<DirectorCountry> findByDirectorId(Long directorId);
    List<DirectorCountry> findByCountryId(Long countryId);
    boolean existsByDirectorIdAndCountryId(Long directorId, Long countryId);
    void deleteByDirectorId(Long directorId);
}