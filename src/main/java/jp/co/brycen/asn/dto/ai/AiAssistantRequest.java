package jp.co.brycen.asn.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiAssistantRequest {

    // Current message from user
    private String message;

    // Language: en | my | ja
    private String language;

    // Conversation history (for context)
    private List<Message> history;

    // Frame context (from design-dev)
    private FrameContext frameContext;

    // Generated files context (optional)
    private List<GeneratedFile> generatedFiles;

    @Data
    public static class Message {
        private String role;    // "user" | "assistant"
        private String content;
    }

    @Data
    public static class FrameContext {
        private String frameName;
        private Integer frameWidth;
        private Integer frameHeight;
        private String components;  // JSON string of components
    }

    @Data
    public static class GeneratedFile {
        private String name;
        private String content;
    }
}
