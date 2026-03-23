package jp.co.brycen.asn.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.dto.UserFullProfileDto;
import jp.co.brycen.asn.model.MemberProfileTranslation;
import jp.co.brycen.asn.repository.MemberProfileTranslationRepository;
import jp.co.brycen.asn.translation.TranslationProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ProfileTranslationService {

    @Autowired
    private MemberProfileTranslationRepository translationRepo;

    @Autowired
    private TranslationProvider translationProvider;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String SOURCE_LANG = "en";

    // ============================================================
    // Translate profile — education + experience + projects
    // On-demand + cache pattern (same as TaskTranslation)
    // ============================================================
    public void applyTranslation(UserFullProfileDto dto, String targetLang) {

        // EN → EN — translation မလို
        if (targetLang == null || SOURCE_LANG.equals(targetLang)) return;

        // No CV data — skip
        if (dto.getEducationEn() == null
                && dto.getExperienceDetailEn() == null
                && dto.getProjectsJson() == null) return;

        Long userId = dto.getId();

        // ── Cache check ──────────────────────────────────────
        Optional<MemberProfileTranslation> cached =
                translationRepo.findByUserIdAndLanguageCode(userId, targetLang);

        if (cached.isPresent()) {
            MemberProfileTranslation c = cached.get();
            // Apply cached translations
            if (c.getEducation()        != null) dto.setEducationEn(c.getEducation());
            if (c.getExperienceDetail() != null) dto.setExperienceDetailEn(c.getExperienceDetail());
            if (c.getProjectsJson()     != null) dto.setProjectsJson(c.getProjectsJson());
            return;
        }

        // ── Cache miss → translate ───────────────────────────
        MemberProfileTranslation translation = new MemberProfileTranslation();
        translation.setUserId(userId);
        translation.setLanguageCode(targetLang);

        // 1. Education
        String translatedEdu = null;
        if (dto.getEducationEn() != null) {
            try {
                translatedEdu = translationProvider.translate(
                        dto.getEducationEn(), SOURCE_LANG, targetLang);
                translation.setEducation(translatedEdu);
                dto.setEducationEn(translatedEdu);
            } catch (Exception e) {
                // translate fail → keep EN
                System.err.println("[ProfileTranslation] edu translate failed: " + e.getMessage());
            }
        }

        // 2. Experience
        String translatedExp = null;
        if (dto.getExperienceDetailEn() != null) {
            try {
                translatedExp = translationProvider.translate(
                        dto.getExperienceDetailEn(), SOURCE_LANG, targetLang);
                translation.setExperienceDetail(translatedExp);
                dto.setExperienceDetailEn(translatedExp);
            } catch (Exception e) {
                System.err.println("[ProfileTranslation] exp translate failed: " + e.getMessage());
            }
        }

        // 3. Projects JSON — translate title + description per project
        if (dto.getProjectsJson() != null) {
            try {
                List<Map<String, Object>> projects = objectMapper.readValue(
                        dto.getProjectsJson(),
                        new TypeReference<List<Map<String, Object>>>() {});

                for (Map<String, Object> p : projects) {
                    // title
                    if (p.get("title") instanceof String) {
                        String translated = translationProvider.translate(
                                (String) p.get("title"), SOURCE_LANG, targetLang);
                        p.put("title", translated);
                    }
                    // description
                    if (p.get("description") instanceof String) {
                        String translated = translationProvider.translate(
                                (String) p.get("description"), SOURCE_LANG, targetLang);
                        p.put("description", translated);
                    }
                    // techStack — မပြောင်း (technical terms EN ထားမယ်)
                    // role — မပြောင်း (job title EN ထားမယ်)
                    // duration — မပြောင်း
                }

                String translatedJson = objectMapper.writeValueAsString(projects);
                translation.setProjectsJson(translatedJson);
                dto.setProjectsJson(translatedJson);

            } catch (Exception e) {
                System.err.println("[ProfileTranslation] projects translate failed: " + e.getMessage());
            }
        }

        // ── Save cache ───────────────────────────────────────
        try {
            translationRepo.save(translation);
        } catch (Exception e) {
            System.err.println("[ProfileTranslation] cache save failed: " + e.getMessage());
        }
    }
}
