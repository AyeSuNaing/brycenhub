package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import jp.co.brycen.asn.translation.TranslationProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class TranslationService {

    @Autowired
    private TranslationProvider translationProvider;

    @Autowired
    private TaskTranslationRepository taskTranslationRepo;

    @Autowired
    private CommentTranslationRepository commentTranslationRepo;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private ProjectRepository projectRepository;   // ✅ NEW

    // =============================================
    // TASK TRANSLATION
    // =============================================
    public Map<String, Object> translateTask(Long taskId, String targetLang) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        String sourceLang = task.getOriginalLanguage() != null
                ? task.getOriginalLanguage() : "en";

        if (sourceLang.equals(targetLang)) {
            return Map.of(
                    "taskId", taskId,
                    "language", targetLang,
                    "title", task.getTitle(),
                    "description", task.getDescription() != null ? task.getDescription() : "",
                    "cached", false,
                    "provider", "original"
            );
        }

        Optional<TaskTranslation> cached = taskTranslationRepo
                .findByTaskIdAndLanguageCode(taskId, targetLang);

        if (cached.isPresent()) {
            TaskTranslation c = cached.get();
            return Map.of(
                    "taskId", taskId,
                    "language", targetLang,
                    "title", c.getTranslatedTitle() != null ? c.getTranslatedTitle() : "",
                    "description", c.getTranslatedDescription() != null ? c.getTranslatedDescription() : "",
                    "cached", true,
                    "provider", "cache"
            );
        }

        String translatedTitle = translationProvider.translate(
                task.getTitle(), sourceLang, targetLang);
        String translatedDesc = task.getDescription() != null
                ? translationProvider.translate(task.getDescription(), sourceLang, targetLang)
                : "";

        TaskTranslation translation = new TaskTranslation();
        translation.setTaskId(taskId);
        translation.setLanguageCode(targetLang);
        translation.setTranslatedTitle(translatedTitle);
        translation.setTranslatedDescription(translatedDesc);
        taskTranslationRepo.save(translation);

        return Map.of(
                "taskId", taskId,
                "language", targetLang,
                "title", translatedTitle,
                "description", translatedDesc,
                "cached", false,
                "provider", translationProvider.getProviderName()
        );
    }

    // =============================================
    // COMMENT TRANSLATION
    // =============================================
    public Map<String, Object> translateComment(Long commentId, String targetLang) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        String sourceLang = comment.getOriginalLanguage() != null
                ? comment.getOriginalLanguage() : "en";

        if (sourceLang.equals(targetLang)) {
            return Map.of(
                    "commentId", commentId,
                    "language", targetLang,
                    "content", comment.getContent() != null ? comment.getContent() : "",
                    "cached", false,
                    "provider", "original"
            );
        }

        Optional<CommentTranslation> cached = commentTranslationRepo
                .findByCommentIdAndLanguageCode(commentId, targetLang);

        if (cached.isPresent()) {
            CommentTranslation c = cached.get();
            return Map.of(
                    "commentId", commentId,
                    "language", targetLang,
                    "content", c.getTranslatedContent() != null ? c.getTranslatedContent() : "",
                    "cached", true,
                    "provider", "cache"
            );
        }

        String translatedContent = translationProvider.translate(
                comment.getContent(), sourceLang, targetLang);

        CommentTranslation translation = new CommentTranslation();
        translation.setCommentId(commentId);
        translation.setLanguageCode(targetLang);
        translation.setTranslatedContent(translatedContent);
        commentTranslationRepo.save(translation);

        return Map.of(
                "commentId", commentId,
                "language", targetLang,
                "content", translatedContent,
                "cached", false,
                "provider", translationProvider.getProviderName()
        );
    }

    // =============================================
    // ✅ PROJECT TRANSLATION — NEW
    // =============================================
    /**
     * Project description + title ကို တောင်းဆိုသော language ဖြင့် ပြန်ပေး
     * Task translation နဲ့ အတူတူ — cache မရှိ (project description မကြာမကြာ မပြောင်းဘူး)
     * ဒါကြောင့် translate ပြီး direct return — cache မသိမ်း
     */
    public Map<String, Object> translateProject(Long projectId, String targetLang) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        String sourceLang = project.getOriginalLanguage() != null
                ? project.getOriginalLanguage() : "en";

        // Same language — original ပြန်ပေး
        if (sourceLang.equals(targetLang)) {
            return Map.of(
                    "projectId", projectId,
                    "language", targetLang,
                    "title", project.getTitle(),
                    "description", project.getDescription() != null ? project.getDescription() : "",
                    "cached", false,
                    "provider", "original"
            );
        }

        // Translate title + description
        String translatedTitle = translationProvider.translate(
                project.getTitle(), sourceLang, targetLang);

        String translatedDesc = project.getDescription() != null
                ? translationProvider.translate(project.getDescription(), sourceLang, targetLang)
                : "";

        return Map.of(
                "projectId", projectId,
                "language", targetLang,
                "title", translatedTitle,
                "description", translatedDesc,
                "cached", false,
                "provider", translationProvider.getProviderName()
        );
    }

    // =============================================
    // SUPPORTED LANGUAGES
    // =============================================
    public List<Map<String, String>> getSupportedLanguages() {
        return List.of(
                Map.of("code", "en", "name", "English",    "flag", "🇺🇸"),
                Map.of("code", "ja", "name", "Japanese",   "flag", "🇯🇵"),
                Map.of("code", "my", "name", "Myanmar",    "flag", "🇲🇲"),
                Map.of("code", "km", "name", "Khmer",      "flag", "🇰🇭"),
                Map.of("code", "vi", "name", "Vietnamese", "flag", "🇻🇳"),
                Map.of("code", "ko", "name", "Korean",     "flag", "🇰🇷")
        );
    }
}