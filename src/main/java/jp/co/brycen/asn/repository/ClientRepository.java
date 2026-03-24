package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    List<Client> findByStatus(String status);

    List<Client> findByBranchIdAndStatus(Long branchId, String status);
}