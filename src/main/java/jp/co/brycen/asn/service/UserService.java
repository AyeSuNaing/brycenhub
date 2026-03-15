package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.UserDto;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.BranchRepository;
import jp.co.brycen.asn.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final List<String> VALID_LANGUAGES =
            Arrays.asList("en", "ja", "my", "vi", "ko", "km");

    // GET all users
    public List<User> getAllUsers() {
        List<User> users = userRepository.findAll();
        users.forEach(u -> u.setPassword(null));
        return users;
    }

    // GET users by branch
    public List<User> getUsersByBranch(Long branchId) {
        List<User> users = userRepository.findByBranchId(branchId);
        users.forEach(u -> u.setPassword(null));
        return users;
    }

    // GET user by id
    public User getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPassword(null);
        return user;
    }

    // CREATE user
    public User createUser(UserDto.CreateUserRequest request) {
        // Email စစ်
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }
        // Branch စစ်
        if (!branchRepository.existsById(request.getBranchId())) {
            throw new RuntimeException("Branch not found");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoleId(request.getRoleId());       // ← role_id သုံး
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

    // UPDATE user
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
        if (request.getRoleId() != null)              // ← NEW
            user.setRoleId(request.getRoleId());
        if (request.getClientId() != null)            // ← NEW
            user.setClientId(request.getClientId());

        User saved = userRepository.save(user);
        saved.setPassword(null);
        return saved;
    }

    // UPDATE last_seen (call this on every authenticated request)
    public void updateLastSeen(Long id) {             // ← NEW
        userRepository.findById(id).ifPresent(user -> {
            user.setLastSeen(java.time.LocalDateTime.now());
            userRepository.save(user);
        });
    }

    // ACTIVATE user
    public void activateUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setIsActive(true);
        userRepository.save(user);
    }

    // DEACTIVATE user
    public void deactivateUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setIsActive(false);
        userRepository.save(user);
    }

    // CHANGE PASSWORD
    public void changePassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // DELETE user
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found");
        }
        userRepository.deleteById(id);
    }
}
