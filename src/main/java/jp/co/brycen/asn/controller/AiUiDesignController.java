package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.ai.AiUiDesignRequest;
import jp.co.brycen.asn.dto.ai.AiUiDesignResponse;
import jp.co.brycen.asn.dto.ai.AiAssistantRequest;
import jp.co.brycen.asn.dto.ai.AiAssistantResponse;
import jp.co.brycen.asn.service.AiUiDesignService;
import jp.co.brycen.asn.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai-ui-design")
@RequiredArgsConstructor
public class AiUiDesignController {

    private final AiUiDesignService aiUiDesignService;
    private final AiAssistantService aiAssistantService;

    // ── Code Generator ───────────────────────────
    // POST /api/ai-ui-design/generate
    @PostMapping("/generate")
    public ResponseEntity<AiUiDesignResponse> generate(
            @RequestBody AiUiDesignRequest request) {
        return ResponseEntity.ok(aiUiDesignService.generate(request));
    }

    // ── AI Assistant Chat ────────────────────────
    // POST /api/ai-ui-design/chat
    @PostMapping("/chat")
    public ResponseEntity<AiAssistantResponse> chat(
            @RequestBody AiAssistantRequest request) {
        return ResponseEntity.ok(aiAssistantService.chat(request));
    }
}
