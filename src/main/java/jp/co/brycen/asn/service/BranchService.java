package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.CountryBranchDto;
import jp.co.brycen.asn.model.Branch;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.CountryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class BranchService {

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private CountryRepository countryRepository;

    // GET all branches
    public List<Branch> getAllBranches() {
        return branchRepository.findAll();
    }

    // GET branches by country
    public List<Branch> getBranchesByCountry(Long countryId) {
        return branchRepository.findByCountryId(countryId);
    }

    // GET branch by id
    public Branch getBranchById(Long id) {
        return branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));
    }

    // CREATE branch
    public Branch createBranch(CountryBranchDto.BranchRequest request) {
        // Country ရှိလားစစ်
        if (!countryRepository.existsById(request.getCountryId())) {
            throw new RuntimeException("Country not found");
        }
        // Same country မှာ same name ရှိလားစစ်
        if (branchRepository.existsByNameAndCountryId(
                request.getName(), request.getCountryId())) {
            throw new RuntimeException("Branch name already exists in this country");
        }
        Branch branch = new Branch();
        branch.setName(request.getName());
        branch.setCountryId(request.getCountryId());
        branch.setAddress(request.getAddress());
        return branchRepository.save(branch);
    }

    // UPDATE branch
    public Branch updateBranch(Long id, CountryBranchDto.BranchRequest request) {
        Branch branch = getBranchById(id);
        branch.setName(request.getName());
        branch.setCountryId(request.getCountryId());
        branch.setAddress(request.getAddress());
        return branchRepository.save(branch);
    }

    // DELETE branch
    public void deleteBranch(Long id) {
        if (!branchRepository.existsById(id)) {
            throw new RuntimeException("Branch not found");
        }
        branchRepository.deleteById(id);
    }
}
