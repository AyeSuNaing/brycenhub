package jp.co.brycen.asn.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiAssistantRequest {

    private String message;
    private String language;
    private List<Message> history;
    private FrameContext frameContext;
    private List<GeneratedFile> generatedFiles;
    private List<String> techStacks;
    private List<String> confirmedFiles;
    private Integer fileIndex;
    private Boolean runBackend;
    private String githubContext;

    // ── NEW: for auto-save after generate ──
    private Long projectId;    // ← project ကို identify ဖို့
    private Long generatedBy;  // ← ဘယ် user generate လုပ်တာ

    @Data
    public static class Message {
        private String role;
        private String content;
    }

    @Data
    public static class FrameContext {
        private String frameName;
        private Integer frameWidth;
        private Integer frameHeight;
        private String components;
    }

    @Data
    public static class GeneratedFile {
        private String name;
        private String content;
    }
}