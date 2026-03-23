package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.UserDto;
import jp.co.brycen.asn.model.MemberSkill;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.dto.UserFullProfileDto;
import jp.co.brycen.asn.model.MemberProfile;
import jp.co.brycen.asn.model.MemberSkill;
import jp.co.brycen.asn.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

	@Autowired
	private UserRepository userRepository;
	@Autowired
	private BranchRepository branchRepository;
	@Autowired
	private UserRoleRepository userRoleRepository;
	@Autowired
	private MemberSkillRepository memberSkillRepository;
	@Autowired
	private DepartmentRepository departmentRepository;
	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private MemberProfileRepository memberProfileRepository;

	private static final List<String> VALID_LANGUAGES = Arrays.asList("en", "ja", "my", "vi", "ko", "km");

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
		List<User> users = branchId != null ? userRepository.findByBranchId(branchId) : userRepository.findAll();

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
			List<String> skills = memberSkillRepository.findByUserId(u.getId()).stream().limit(3)
					.map(MemberSkill::getSkillNameEn).collect(Collectors.toList());
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
		User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
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
		user.setDepartmentId(request.getDepartmentId());
		user.setPreferredLanguage(request.getPreferredLanguage() != null ? request.getPreferredLanguage() : "en");
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
		User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));

		if (request.getName() != null)
			user.setName(request.getName());
		if (request.getPhone() != null)
			user.setPhone(request.getPhone());
		if (request.getProfileImage() != null)
			user.setProfileImage(request.getProfileImage());
		if (request.getPreferredLanguage() != null && VALID_LANGUAGES.contains(request.getPreferredLanguage()))
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
		User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
		user.setIsActive(true);
		userRepository.save(user);
	}

	public void deactivateUser(Long id) {
		User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
		user.setIsActive(false);
		userRepository.save(user);
	}

	// ============================================================
	// CHANGE PASSWORD
	// ============================================================
	public void changePassword(Long id, String newPassword) {
		User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
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

	// deleteUser() method ရဲ့ နောက်မှာ ထည့်ပါ
	// ============================================================
	// CHECK email exists
	// ============================================================
	public boolean existsByEmail(String email) {
		return userRepository.existsByEmail(email.trim().toLowerCase());
	}

	// ============================================================
    // GET /api/users/{id}/full-profile
    // Staff profile page — all data in one response
    // ============================================================
    public UserFullProfileDto getFullProfile(Long userId) {
 
        // 1. User basic
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
 
        UserFullProfileDto dto = new UserFullProfileDto();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setIsActive(user.getIsActive());
        dto.setPreferredLanguage(user.getPreferredLanguage());
        dto.setProfileImage(user.getProfileImage());
        dto.setLastSeen(user.getLastSeen());
 
        // 2. Role — user_roles join
        if (user.getRoleId() != null) {
            userRoleRepository.findById(user.getRoleId()).ifPresent(role -> {
                dto.setRoleId(role.getId());
                dto.setRoleName(role.getName());
                dto.setRoleDisplayName(role.getDisplayName());
                dto.setRoleColor(role.getColor());
            });
        }
 
        // 3. Department — departments join
        if (user.getDepartmentId() != null) {
            departmentRepository.findById(user.getDepartmentId()).ifPresent(dept -> {
                dto.setDepartmentId(dept.getId());
                dto.setDepartmentName(dept.getName());
            });
        }
 
        // 4. CV / member_profiles
        memberProfileRepository.findByUserId(userId).ifPresent(profile -> {
            dto.setCvAnalyzed(profile.getCvAnalyzed());
            dto.setCvFileUrl(profile.getCvFileUrl());
            dto.setExperienceYears(profile.getExperienceYears());
            dto.setEducationEn(profile.getEducationEn());
            dto.setExperienceDetailEn(profile.getExperienceDetailEn());
            dto.setCvOriginalLanguage(profile.getCvOriginalLanguage());
            dto.setProjectsJson(profile.getProjectsJson());
            dto.setSocialLinksJson(profile.getSocialLinksJson());
        });
 
        // 5. Skills — member_skills
        List<MemberSkill> skillEntities = memberSkillRepository.findByUserId(userId);
        List<UserFullProfileDto.SkillItem> skillItems = skillEntities.stream().map(s -> {
            UserFullProfileDto.SkillItem item = new UserFullProfileDto.SkillItem();
            item.setId(s.getId());
            item.setSkillName(s.getSkillName());
            item.setSkillNameEn(s.getSkillNameEn());
            item.setSkillLevel(s.getSkillLevel());
            item.setInputType(s.getInputType());
            return item;
        }).collect(java.util.stream.Collectors.toList());
        dto.setSkills(skillItems);
 
        return dto;
    }

}