package jp.co.brycen.asn.dto.ai;

import lombok.Data;

@Data
public class AiUiDesignRequest {
    private String prompt;
    private Integer maxTokens;
}
