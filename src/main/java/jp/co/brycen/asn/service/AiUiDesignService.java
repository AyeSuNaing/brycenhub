package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.ai.AiUiDesignRequest;
import jp.co.brycen.asn.dto.ai.AiUiDesignResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiUiDesignService {

    @Value("${anthropic.api.key}")
    private String anthropicApiKey;

    private static final String ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-sonnet-4-20250514";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public AiUiDesignResponse generate(AiUiDesignRequest request) {
        try {
            // Build request body
            Map<String, Object> body = new HashMap<>();
            body.put("model", MODEL);
            body.put("max_tokens", request.getMaxTokens() != null ? request.getMaxTokens() : 4000);
            body.put("messages", List.of(
                Map.of("role", "user", "content", request.getPrompt())
            ));

            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", anthropicApiKey);
            headers.set("anthropic-version", "2023-06-01");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            // Call Anthropic API
            ResponseEntity<String> resp = restTemplate.postForEntity(
                ANTHROPIC_URL, entity, String.class
            );

            // Parse response
            JsonNode root = objectMapper.readTree(resp.getBody());
            String content = root.path("content").get(0).path("text").asText();

            return AiUiDesignResponse.builder()
                .content(content)
                .success(true)
                .build();

        } catch (Exception e) {
            log.error("[AiUiDesign] Error: {}", e.getMessage());
            return AiUiDesignResponse.builder()
                .content("")
                .success(false)
                .error(e.getMessage())
                .build();
        }
    }
}
