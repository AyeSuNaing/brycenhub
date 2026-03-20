package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.UserRole;
import jp.co.brycen.asn.repository.UserRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user-roles")
public class UserRoleController {

    @Autowired
    private UserRoleRepository userRoleRepository;

    // ============================================================
    // GET /api/user-roles
    // Role dropdown မှာ သုံးမယ် — CLIENT ကလွဲပြီး အကုန်
    // ============================================================
    @GetMapping
    public ResponseEntity<List<UserRole>> getAllRoles() {
        List<UserRole> roles = userRoleRepository.findAll();
        // CLIENT role — Add Staff မှာ မပြချင်ဘူး
        roles.removeIf(r -> "CLIENT".equals(r.getName()));
        return ResponseEntity.ok(roles);
    }
}
