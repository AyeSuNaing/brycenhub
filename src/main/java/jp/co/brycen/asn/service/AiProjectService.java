package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.MemberSkill;
import jp.co.brycen.asn.model.User;
import jp.co.brycen.asn.repository.MemberSkillRepository;
import jp.co.brycen.asn.repository.UserRepository;
import jp.co.brycen.asn.repository.UserRoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiProjectService {

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL   = "claude-haiku-4-5-20251001";

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Autowired private MemberSkillRepository memberSkillRepository;
    @Autowired private UserRepository        userRepository;
    @Autowired private UserRoleRepository    userRoleRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    // ================================================================
    // ① DETECT TECH STACK
    // ================================================================
    public List<Map<String, String>> detectTechStack(String title, String description) {

        String prompt =
            "You are a senior software architect.\n" +
            "Analyze the project and suggest a technology stack.\n\n" +
            "Project Title: " + title + "\n" +
            "Project Description: " + description + "\n\n" +
            "Rules:\n" +
            "- Suggest 2-3 options per relevant category\n" +
            "- Only include categories relevant to the project\n" +
            "- For frontend: 3 options e.g. Angular, React, Vue\n" +
            "- For backend: 3 options e.g. Spring Boot, Node.js, Django\n" +
            "- For database: 2-3 options e.g. MySQL, PostgreSQL, MongoDB\n" +
            "- For mobile - read carefully:\n" +
            "  * Android mentioned in description: include Android (Kotlin)\n" +
            "  * iOS mentioned in description: include Swift (iOS)\n" +
            "  * Both Android and iOS: include Android (Kotlin), Swift (iOS), Flutter\n" +
            "  * Cross-platform only: include Flutter, React Native\n" +
            "  * Max 3 mobile options\n" +
            "- For payment: only if payment mentioned, 3 options e.g. Stripe, PayPal, Braintree\n" +
            "- For realtime: only if real-time/tracking/chat mentioned, 2-3 options e.g. WebSocket, Firebase, Socket.io\n" +
            "- Return ONLY JSON array, no explanation, no markdown\n\n" +
            "Return format:\n" +
            "[\n" +
            "  {\"name\":\"Angular\",\"category\":\"frontend\"},\n" +
            "  {\"name\":\"React\",\"category\":\"frontend\"},\n" +
            "  {\"name\":\"Spring Boot\",\"category\":\"backend\"},\n" +
            "  {\"name\":\"MySQL\",\"category\":\"database\"},\n" +
            "  {\"name\":\"Android (Kotlin)\",\"category\":\"mobile\"},\n" +
            "  {\"name\":\"Swift (iOS)\",\"category\":\"mobile\"},\n" +
            "  {\"name\":\"Flutter\",\"category\":\"mobile\"},\n" +
            "  {\"name\":\"Stripe\",\"category\":\"payment\"}\n" +
            "]\n\n" +
            "Now analyze and return JSON array:";

        String raw = callClaude(prompt, 800);
        return parseTechStackArray(raw);
    }

    // ================================================================
    // ② SUGGEST TEAM
    // ================================================================
    public List<Map<String, Object>> suggestTeam(List<String> techStack, Long branchId) {

        List<User> branchUsers = userRepository.findByBranchId(branchId)
            .stream()
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .collect(Collectors.toList());

        if (branchUsers.isEmpty()) return Collections.emptyList();

        List<Map<String, Object>> candidates = new ArrayList<>();

        for (User user : branchUsers) {
            String roleName = "";
            if (user.getRoleId() != null) {
                roleName = userRoleRepository.findById(user.getRoleId())
                    .map(r -> r.getName()).orElse("");
            }
            if ("CUSTOMER".equals(roleName) || "BOSS".equals(roleName) ||
                "COUNTRY_DIRECTOR".equals(roleName) || "ADMIN".equals(roleName)) {
                continue;
            }

            List<MemberSkill> skills = memberSkillRepository.findByUserId(user.getId());
            List<String> matched = new ArrayList<>();

            for (MemberSkill skill : skills) {
                String skillEn = skill.getSkillNameEn();
                if (skillEn == null) continue;
                for (String tech : techStack) {
                    if (isSkillMatch(skillEn, tech)) {
                        matched.add(tech);
                        break;
                    }
                }
            }

            if (matched.isEmpty()) continue;

            Map<String, Object> candidate = new HashMap<>();
            candidate.put("userId",        user.getId());
            candidate.put("name",          user.getName());
            candidate.put("role",          roleName);
            candidate.put("profileImage",  user.getProfileImage());
            candidate.put("matchedSkills", matched);
            candidate.put("totalSkills",   skills.size());
            candidate.put("matchCount",    matched.size());
            candidates.add(candidate);
        }

        if (candidates.isEmpty()) return Collections.emptyList();

        candidates.sort((a, b) ->
            ((Integer) b.get("matchCount")).compareTo((Integer) a.get("matchCount")));

        List<Map<String, Object>> top = candidates.stream()
            .limit(10).collect(Collectors.toList());

        return rankWithClaude(top, techStack);
    }

    // ================================================================
    // Claude rank + reason
    // ================================================================
    private List<Map<String, Object>> rankWithClaude(
            List<Map<String, Object>> candidates, List<String> techStack) {

        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> c : candidates) {
            sb.append("- userId: ").append(c.get("userId"))
              .append(", name: ").append(c.get("name"))
              .append(", role: ").append(c.get("role"))
              .append(", matchedSkills: ").append(c.get("matchedSkills"))
              .append("\n");
        }

        String prompt =
            "You are a project team advisor.\n" +
            "Required tech stack: " + techStack + "\n\n" +
            "Candidates:\n" + sb +
            "\nRank these candidates. Return ONLY a JSON array:\n" +
            "[{\"userId\":5,\"score\":90,\"reason\":\"Senior Java and MySQL expert\"}]\n\n" +
            "Return ONLY the JSON array, no other text.";

        String raw = callClaude(prompt, 600);
        List<Map<String, Object>> ranked = parseJsonArrayOfObjects(raw);

        Map<Long, Map<String, Object>> candidateMap = new HashMap<>();
        for (Map<String, Object> c : candidates) {
            candidateMap.put(((Number) c.get("userId")).longValue(), c);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> r : ranked) {
            Long uid = ((Number) r.get("userId")).longValue();
            Map<String, Object> c = candidateMap.get(uid);
            if (c == null) continue;
            Map<String, Object> item = new HashMap<>();
            item.put("userId",        uid);
            item.put("name",          c.get("name"));
            item.put("role",          c.get("role"));
            item.put("profileImage",  c.get("profileImage"));
            item.put("matchedSkills", c.get("matchedSkills"));
            item.put("score",         r.getOrDefault("score", 50));
            item.put("reason",        r.getOrDefault("reason", "Good skill match"));
            result.add(item);
        }

        if (result.isEmpty()) {
            for (Map<String, Object> c : candidates) {
                Map<String, Object> item = new HashMap<>(c);
                int mc = ((Integer) c.get("matchCount"));
                item.put("score",  Math.min(mc * 20, 95));
                item.put("reason", "Matched " + mc + " required skills");
                result.add(item);
            }
        }

        return result;
    }

    // ================================================================
    // Claude API call
    // ================================================================
    private String callClaude(String prompt, int maxTokens) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("anthropic-version", "2023-06-01");

            Map<String, Object> message = new HashMap<>();
            message.put("role",    "user");
            message.put("content", prompt);

            Map<String, Object> body = new HashMap<>();
            body.put("model",      CLAUDE_MODEL);
            body.put("max_tokens", maxTokens);
            body.put("messages",   List.of(message));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                CLAUDE_API_URL, entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<?> content = (List<?>) response.getBody().get("content");
                if (content != null && !content.isEmpty()) {
                    Map<?, ?> first = (Map<?, ?>) content.get(0);
                    String text = (String) first.get("text");
                    String result = text != null ? text.trim() : "";
                    System.out.println("[AiProjectService] Claude raw: " + result);
                    return result;
                }
            }
        } catch (Exception e) {
            System.err.println("[AiProjectService] Claude API error: " + e.getMessage());
        }
        return "";
    }

    // ================================================================
    // Skill match — "JavaScript" vs "Java" false match ကာကွယ်
    // ================================================================
    private boolean isSkillMatch(String skillNameEn, String tech) {
        if (skillNameEn == null || tech == null) return false;
        String skill = skillNameEn.toLowerCase().trim();
        String t     = tech.toLowerCase().trim();
        if (!skill.contains(t)) return false;
        if (t.equals("java") &&
            (skill.contains("javascript") || skill.contains("java script"))) {
            return false;
        }
        return true;
    }

    // ================================================================
    // JSON parse helpers
    // ================================================================
    @SuppressWarnings("unchecked")
    private List<Map<String, String>> parseTechStackArray(String raw) {
        try {
            System.out.println("[AiProjectService] parseTechStackArray raw: " + raw);
            int start = raw.indexOf('[');
            int end   = raw.lastIndexOf(']');
            if (start == -1 || end == -1 || end <= start) {
                return getDefaultTechStack();
            }
            String json = raw.substring(start, end + 1);
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, String>> result = mapper.readValue(
                json,
                mapper.getTypeFactory().constructCollectionType(
                    List.class,
                    mapper.getTypeFactory().constructMapType(
                        java.util.HashMap.class, String.class, String.class)));
            System.out.println("[AiProjectService] Parsed: " + result);
            return result.isEmpty() ? getDefaultTechStack() : result;
        } catch (Exception e) {
            System.err.println("[AiProjectService] parseTechStackArray error: " + e.getMessage());
            return getDefaultTechStack();
        }
    }

    private List<Map<String, String>> getDefaultTechStack() {
        List<Map<String, String>> defaults = new ArrayList<>();
        String[][] items = {
            {"Angular",     "frontend"},
            {"Spring Boot", "backend"},
            {"MySQL",       "database"}
        };
        for (String[] item : items) {
            Map<String, String> m = new java.util.HashMap<>();
            m.put("name",     item[0]);
            m.put("category", item[1]);
            defaults.add(m);
        }
        return defaults;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseJsonArrayOfObjects(String raw) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
            int start = raw.indexOf('[');
            int end   = raw.lastIndexOf(']');
            if (start == -1 || end == -1) return Collections.emptyList();
            return mapper.readValue(raw.substring(start, end + 1), List.class);
        } catch (Exception e) {
            System.err.println("[AiProjectService] parseJsonArrayOfObjects error: " + e.getMessage());
            return Collections.emptyList();
        }
    }
}