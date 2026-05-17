package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.Client;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.ClientRepository;
import jp.co.brycen.asn.repository.ProjectRepository;
import jp.co.brycen.asn.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    @Autowired private ClientRepository  clientRepository;
    @Autowired private UserRepository    userRepository;
    @Autowired private ProjectRepository projectRepository;

    // ================================================================
    // GET /api/clients
    // ================================================================
    @GetMapping
    public ResponseEntity<List<Client>> getClients(
            @AuthenticationPrincipal User user) {
        List<Client> clients = user.getBranchId() != null
            ? clientRepository.findByBranchIdAndStatus(user.getBranchId(), "ACTIVE")
            : clientRepository.findByStatus("ACTIVE");
        return ResponseEntity.ok(clients);
    }

    // ================================================================
    // GET /api/clients/{id}
    // ================================================================
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return clientRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // ================================================================
    // GET /api/clients/{id}/projects
    // ================================================================
    @GetMapping("/{id}/projects")
    public ResponseEntity<List<Map<String, Object>>> getClientProjects(
            @PathVariable Long id) {
        List<Project> projects = projectRepository.findByClientId(id);
        List<Map<String, Object>> result = projects.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",       p.getId());
            m.put("title",    p.getTitle());
            m.put("status",   p.getStatus());
            m.put("progress", p.getProgress() != null ? p.getProgress() : 0);
            m.put("priority", p.getPriority());
            m.put("endDate",  p.getEndDate());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ================================================================
    // GET /api/clients/{clientId}/users
    // ================================================================
    @GetMapping("/{clientId}/users")
    public ResponseEntity<List<User>> getClientUsers(@PathVariable Long clientId) {
        return ResponseEntity.ok(userRepository.findByClientId(clientId));
    }

    // ================================================================
    // POST /api/clients — create new client
    // ================================================================
    @PostMapping
    public ResponseEntity<?> createClient(
            @RequestBody Client client,
            @AuthenticationPrincipal User user) {
        try {
            if (client.getCompanyName() == null || client.getCompanyName().isBlank()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("message", "Company name is required"));
            }
            // branch + createdBy from current user
            if (client.getBranchId() == null && user.getBranchId() != null) {
                client.setBranchId(user.getBranchId());
            }
            client.setCreatedBy(user.getId());
            if (client.getStatus() == null) {
                client.setStatus("ACTIVE");
            }
            Client saved = clientRepository.save(client);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("message", "Failed to create client: " + e.getMessage()));
        }
    }
}