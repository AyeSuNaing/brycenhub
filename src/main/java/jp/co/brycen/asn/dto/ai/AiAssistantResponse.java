package jp.co.brycen.asn.dto.ai;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class AiAssistantResponse {

    private String message;         // AI reply text
    private boolean success;
    private String error;

    // If AI wants to generate files
    private boolean offerGenerate;  // true → show Yes/No buttons
    private String offerMessage;    // "Would you like me to generate code?"

    // Generated files (when user says yes)
    private List<GeneratedFile> files;
    private String summary;

    @Data
    @Builder
    public static class GeneratedFile {
        private String name;
        private String content;
    }
}
