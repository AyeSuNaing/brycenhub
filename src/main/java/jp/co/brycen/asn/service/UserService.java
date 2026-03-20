package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.UserDto;
import jp.co.brycen.asn.model.MemberSkill;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired private UserRepository         userRepository;
    @Autowired private BranchRepository       branchRepository;
    @Autowired private UserRoleRepository     userRoleRepository;
    @Autowired private MemberSkillRepository  memberSkillRepository;
    @Autowired private DepartmentRepository   departmentRepository;
    @Autowired private PasswordEncoder        passwordEncoder;

    private static final List<String> VALID_LANGUAGES =
            Arrays.asList("en", "ja", "my", "vi", "ko", "km");

    // ============================================================
    // GET all users
    // ============================================================
    public List<User> getAllUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(u -> u.setPassword(null));
        return users;
    }

    // ============================================================
    // GET users by branch — plain User list (existing)
    // ============================================================
    public List<User> getUsersByBranch(Long branchId) {
        List<User> users = userRepository.findByBranchId(branchId);
        users.forEach(u -> u.setPassword(null));
        return users;
    }

    // ============================================================
    // GET users by branch — with role name + skills (dashboard)
    // ============================================================
    public List<UserDto.UserResponse> getUsersByBranchAsResponse(Long branchId) {
        List<User> users = branchId != null
            ? userRepository.findByBranchId(branchId)
            : userRepository.findAll();

        return users.stream().map(u -> {
            UserDto.UserResponse r = new UserDto.UserResponse();
            r.setId(u.getId());
            r.setName(u.getName());
            r.setEmail(u.getEmail());
            r.setBranchId(u.getBranchId());
            r.setIsActive(u.getIsActive());
            r.setPreferredLanguage(u.getPreferredLanguage());
            r.setProfileImage(u.getProfileImage());
            r.setPhone(u.getPhone());
            r.setLastSeen(u.getLastSeen());
            r.setRoleId(u.getRoleId());

            // departments join
            if (u.getDepartmentId() != null) {
                departmentRepository.findById(u.getDepartmentId()).ifPresent(dept -> {
                    r.setDepartmentId(dept.getId());
                    r.setDepartmentName(dept.getName());
                });
            }

            // user_roles join
            if (u.getRoleId() != null) {
                userRoleRepository.findById(u.getRoleId()).ifPresent(role -> {
                    r.setRoleName(role.getName());
                    r.setRoleDisplayName(role.getDisplayName());
                    r.setRoleColor(role.getColor());
                });
            }

            // member_skills join — top 3 EN standard
            List<String> skills = memberSkillRepository
                .findByUserId(u.getId())
                .stream()
                .limit(3)
                .map(MemberSkill::getSkillNameEn)
                .collect(Collectors.toList());
            r.setSkills(skills.isEmpty() ? null : skills);

            // cvAnalyzed — skills ရှိရင် true
            r.setCvAnalyzed(!skills.isEmpty());

            return r;
        }).collect(Collectors.toList());
    }

    // ============================================================
    // GET user by id
    // ============================================================
    public User getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPassword(null);
        return user;
    }

    // ============================================================
    // CREATE user
    // ============================================================
    public User createUser(UserDto.CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        if (!branchRepository.existsById(request.getBranchId())) {
            throw new RuntimeException("Branch not found");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoleId(request.getRoleId());
        user.setClientId(request.getClientId());
        user.setBranchId(request.getBranchId());
        user.setPreferredLanguage(
                request.getPreferredLanguage() != null
                ? request.getPreferredLanguage() : "en");
        user.setPhone(request.getPhone());
        user.setProfileImage(request.getProfileImage());
        user.setIsActive(true);

        User saved = userRepository.save(user);
        saved.setPassword(null);
        return saved;
    }

    // ============================================================
    // UPDATE user
    // ============================================================
    public User updateUser(Long id, UserDto.UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getName() != null)
            user.setName(request.getName());
        if (request.getPhone() != null)
            user.setPhone(request.getPhone());
        if (request.getProfileImage() != null)
            user.setProfileImage(request.getProfileImage());
        if (request.getPreferredLanguage() != null &&
                VALID_LANGUAGES.contains(request.getPreferredLanguage()))
            user.setPreferredLanguage(request.getPreferredLanguage());
        if (request.getBranchId() != null)
            user.setBranchId(request.getBranchId());
        if (request.getRoleId() != null)
            user.setRoleId(request.getRoleId());
        if (request.getClientId() != null)
            user.setClientId(request.getClientId());

        User saved = userRepository.save(user);
        saved.setPassword(null);
        return saved;
    }

    // ============================================================
    // UPDATE last_seen
    // ============================================================
    public void updateLastSeen(Long id) {
        userRepository.findById(id).ifPresent(user -> {
            user.setLastSeen(java.time.LocalDateTime.now());
            userRepository.save(user);
        });
    }

    // ============================================================
    // ACTIVATE / DEACTIVATE
    // ============================================================
    public void activateUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setIsActive(true);
        userRepository.save(user);
    }

    public void deactivateUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setIsActive(false);
        userRepository.save(user);
    }

    // ============================================================
    // CHANGE PASSWORD
    // ============================================================
    public void changePassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ============================================================
    // DELETE
    // ============================================================
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found");
        }
        userRepository.deleteById(id);
    }
}