package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findByCountryId(Long countryId);
    boolean existsByNameAndCountryId(String name, Long countryId);
}
