package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.model.Project;
import jp.co.brycen.asn.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches commit history from GitHub API for a project's linked repo.
 * Created: 2026-04-19
 */
@Service
public class ProjectCommitsService {

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final Pattern GITHUB_URL_PATTERN = Pattern.compile(
        "github\\.com[/:]([\\w.-]+)/([\\w.-]+?)(?:\\.git)?/?$"
    );

    @Autowired private ProjectRepository projectRepo;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Fetch recent commits for a project.
     *
     * @param projectId project to fetch commits for
     * @param limit     max commits to return (default 10, max 30)
     * @return map with commits + metadata or error code
     */
    public Map<String, Object> fetchCommits(Long projectId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 30);
        Map<String, Object> result = new HashMap<>();

        Project project = projectRepo.findById(projectId)
            .orElseThrow(() -> new RuntimeException("Project not found"));

        String repoUrl = project.getRepoUrl();
        if (repoUrl == null || repoUrl.trim().isEmpty()) {
            result.put("error", "REPO_NOT_CONFIGURED");
            result.put("message", "Repository URL not set for this project");
            result.put("commits", new ArrayList<>());
            return result;
        }

        String[] parsed = parseOwnerRepo(repoUrl);
        if (parsed == null) {
            result.put("error", "INVALID_REPO_URL");
            result.put("message", "Could not parse GitHub URL: " + repoUrl);
            result.put("commits", new ArrayList<>());
            return result;
        }

        String owner = parsed[0];
        String repo  = parsed[1];

        try {
            List<Map<String, Object>> commits = callGitHubAPI(
                owner, repo, safeLimit, project.getGithubToken()
            );
            result.put("owner",   owner);
            result.put("repo",    repo);
            result.put("repoUrl", repoUrl);
            result.put("commits", commits);
            result.put("count",   commits.size());
            return result;
        } catch (HttpClientErrorException.NotFound e) {
            result.put("error",   "REPO_NOT_FOUND");
            result.put("message", "Repository not found: " + owner + "/" + repo);
            result.put("commits", new ArrayList<>());
            return result;
        } catch (HttpClientErrorException.Forbidden e) {
            result.put("error",   "RATE_LIMITED_OR_PRIVATE");
            result.put("message", "Rate limited or private repo. Add GitHub token in Project Settings.");
            result.put("commits", new ArrayList<>());
            return result;
        } catch (HttpClientErrorException.Unauthorized e) {
            result.put("error",   "INVALID_TOKEN");
            result.put("message", "GitHub token is invalid or expired");
            result.put("commits", new ArrayList<>());
            return result;
        } catch (Exception e) {
            result.put("error",   "FETCH_FAILED");
            result.put("message", "Failed to fetch commits: " + e.getMessage());
            result.put("commits", new ArrayList<>());
            return result;
        }
    }

    private String[] parseOwnerRepo(String url) {
        if (url == null) return null;
        Matcher matcher = GITHUB_URL_PATTERN.matcher(url.trim());
        if (matcher.find()) {
            return new String[] { matcher.group(1), matcher.group(2) };
        }
        return null;
    }

    private List<Map<String, Object>> callGitHubAPI(
            String owner, String repo, int limit, String token) throws Exception {

        String url = GITHUB_API_BASE + "/repos/" + owner + "/" + repo
                   + "/commits?per_page=" + limit;

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.valueOf("application/vnd.github.v3+json")));
        headers.set("User-Agent", "BrycenHub-PMS/1.0");

        if (token != null && !token.trim().isEmpty()) {
            headers.set("Authorization", "Bearer " + token.trim());
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(
            url, org.springframework.http.HttpMethod.GET, entity, String.class
        );

        List<Map<String, Object>> result = new ArrayList<>();
        JsonNode array = objectMapper.readTree(response.getBody());

        if (!array.isArray()) return result;

        for (JsonNode node : array) {
            Map<String, Object> commit = new HashMap<>();

            commit.put("sha",       textOrNull(node, "sha"));
            commit.put("shortSha",  shortSha(textOrNull(node, "sha")));
            commit.put("htmlUrl",   textOrNull(node, "html_url"));

            JsonNode commitNode = node.get("commit");
            if (commitNode != null) {
                String fullMessage = textOrEmpty(commitNode, "message");
                commit.put("message",      firstLine(fullMessage));
                commit.put("fullMessage",  fullMessage);

                JsonNode authorNode = commitNode.get("author");
                if (authorNode != null) {
                    commit.put("authorName",  textOrNull(authorNode, "name"));
                    commit.put("authorEmail", textOrNull(authorNode, "email"));
                    commit.put("date",        textOrNull(authorNode, "date"));
                }
            }

            JsonNode githubAuthor = node.get("author");
            if (githubAuthor != null && !githubAuthor.isNull()) {
                commit.put("githubLogin",   textOrNull(githubAuthor, "login"));
                commit.put("avatarUrl",     textOrNull(githubAuthor, "avatar_url"));
                commit.put("githubProfile", textOrNull(githubAuthor, "html_url"));
            }

            result.add(commit);
        }

        return result;
    }

    private String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode f = node.get(field);
        return (f == null || f.isNull()) ? null : f.asText();
    }

    private String textOrEmpty(JsonNode node, String field) {
        String v = textOrNull(node, field);
        return v == null ? "" : v;
    }

    private String shortSha(String sha) {
        if (sha == null || sha.length() < 7) return sha;
        return sha.substring(0, 7);
    }

    private String firstLine(String message) {
        if (message == null) return "";
        int idx = message.indexOf('\n');
        return (idx < 0) ? message : message.substring(0, idx);
    }
}
