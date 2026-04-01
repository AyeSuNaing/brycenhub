package jp.co.brycen.asn.controller;

import jp.co.brycen.asn.dto.ai.AiUiDesignRequest;
import jp.co.brycen.asn.dto.ai.AiUiDesignResponse;
import jp.co.brycen.asn.service.AiUiDesignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai-ui-design")
@RequiredArgsConstructor
public class AiUiDesignController {

    private final AiUiDesignService aiUiDesignService;

    @PostMapping("/generate")
    public ResponseEntity<AiUiDesignResponse> generate(
            @RequestBody AiUiDesignRequest request) {
        AiUiDesignResponse response = aiUiDesignService.generate(request);
        return ResponseEntity.ok(response);
    }
}
