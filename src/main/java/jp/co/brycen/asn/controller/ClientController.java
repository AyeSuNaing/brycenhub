package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.model.Client;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.ClientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clients")
public class ClientController {

    @Autowired
    private ClientRepository clientRepository;

    // ================================================================
    // GET /api/clients
    // PM + ADMIN + BOSS + DIRECTOR → ကိုယ့် branch ရဲ့ clients
    // Project create မှာ client dropdown သုံးမည်
    // ================================================================
    @GetMapping
    public ResponseEntity<List<Client>> getClients(
            @AuthenticationPrincipal User user) {

        List<Client> clients;

        if (user.getBranchId() != null) {
            clients = clientRepository.findByBranchIdAndStatus(user.getBranchId(), "ACTIVE");
        } else {
            clients = clientRepository.findByStatus("ACTIVE");
        }

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
}