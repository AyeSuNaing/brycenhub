package jp.co.brycen.asn.dto.ai;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class AiAssistantResponse {

    private String message;
    private boolean success;
    private String error;

    // Legacy: offer to generate (Yes/No buttons)
    private boolean offerGenerate;
    private String offerMessage;

    // Generated files
    private List<GeneratedFile> files;
    private String summary;

    // ── NEW: Checklist mode ──
    // true = frontend should show file checklist
    private boolean readyToGenerate;
    // List of suggested files for the checklist
    private List<String> suggestedFiles;

    @Data
    @Builder
    public static class GeneratedFile {
        private String name;
        private String content;
    }
}