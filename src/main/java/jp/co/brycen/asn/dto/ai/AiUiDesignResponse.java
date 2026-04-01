package jp.co.brycen.asn.dto.ai;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiUiDesignResponse {
    private String content;
    private boolean success;
    private String error;
}
