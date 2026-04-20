package jp.co.brycen.asn.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jp.co.brycen.asn.dto.ProjectDesignDto;
import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ProjectDesignService {

    private final ProjectGeneratedFileRepository generatedFileRepo;
    private final ProjectApiEndpointRepository apiEndpointRepo;
    private final ProjectDbTableRepository dbTableRepo;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${anthropic.api.key}")
    private String apiKey;

    private static final String CLAUDE_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_MODEL = "claude-sonnet-4-20250514";

    // ── Save generated files + API + DB (overwrite by frame_name) ──
    public void saveGenerated(ProjectDesignDto.SaveRequest req) {
        String frameName = req.getFrameName();
        Long projectId   = req.getProjectId();

        log.info("[ProjectDesign] Saving frame={} project={}", frameName, projectId);

        // ── 1. Generated Files — delete old, insert new ──
        // Delete existing session entirely to avoid duplicate constraint
        generatedFileRepo.findByProjectIdAndFrameName(projectId, frameName)
            .ifPresent(existing -> generatedFileRepo.delete(existing));

        // Flush to ensure delete is committed before insert
        generatedFileRepo.flush();

        // Create fresh session
        ProjectGeneratedFile session = new ProjectGeneratedFile();
        session.setProjectId(projectId);
        session.setFrameName(frameName);
        session.setGeneratedBy(req.getGeneratedBy());
        session.setItems(new java.util.ArrayList<>());

        if (req.getFiles() != null) {
            req.getFiles().forEach(f -> {
                ProjectGeneratedFileItem item = new ProjectGeneratedFileItem();
                item.setGeneratedFile(session);
                item.setFileName(f.getFileName());
                item.setFileContent(f.getFileContent());
                session.getItems().add(item);
            });
        }
        generatedFileRepo.save(session);

        // ── 2. API Endpoints — overwrite by frame_name ──
        apiEndpointRepo.deleteByProjectIdAndFrameName(projectId, frameName);
        if (req.getApiEndpoints() != null) {
            List<ProjectApiEndpoint> endpoints = req.getApiEndpoints().stream().map(e -> {
                ProjectApiEndpoint ep = new ProjectApiEndpoint();
                ep.setProjectId(projectId);
                ep.setFrameName(frameName);
                ep.setMethod(e.getMethod());
                ep.setUrl(e.getUrl());
                ep.setDescription(e.getDescription());
                // ── New fields ──
                ep.setRequestBody(e.getRequestBody());
                ep.setResponseBody(e.getResponseBody());
                ep.setPathParams(e.getPathParams());
                ep.setQueryParams(e.getQueryParams());
                ep.setStatusCodes(e.getStatusCodes());
                return ep;
            }).collect(Collectors.toList());
            apiEndpointRepo.saveAll(endpoints);
        }

        // ── 3. DB Tables — AI-MERGE if exists project-wide ──
        // Strategy:
        //   - For each new table from AI:
        //     • If (projectId, tableName) does NOT exist → INSERT new row
        //     • If exists → AI-merge columns, UPDATE existing row
        //   - Delete this frame's previous rows that AREN'T in the new set
        //     (so stale rows get cleaned up)
        dbTableRepo.deleteByProjectIdAndFrameName(projectId, frameName);
        dbTableRepo.flush();  // ensure delete committed before checks

        int inserted = 0, merged = 0;
        if (req.getDbTables() != null) {
            for (ProjectDesignDto.DbTable t : req.getDbTables()) {
                if (t.getTableName() == null || t.getTableName().isBlank()) continue;

                var existingOpt = dbTableRepo.findByProjectIdAndTableName(projectId, t.getTableName());

                if (existingOpt.isPresent()) {
                    // ─── AI Merge ───
                    ProjectDbTable existing = existingOpt.get();
                    log.info("[ProjectDesign] Merging table '{}' (existing frame={}, new frame={})",
                        t.getTableName(), existing.getFrameName(), frameName);

                    String mergedColumns = mergeColumnsWithAI(
                        t.getTableName(),
                        existing.getColumns(),
                        t.getColumns()
                    );
                    existing.setColumns(mergedColumns);

                    // Merge description: keep original, append new if different
                    if (t.getDescription() != null && !t.getDescription().isBlank()) {
                        String oldDesc = existing.getDescription() != null ? existing.getDescription() : "";
                        if (!oldDesc.contains(t.getDescription())) {
                            String combined = oldDesc.isBlank()
                                ? t.getDescription()
                                : oldDesc + " | " + t.getDescription();
                            existing.setDescription(combined);
                        }
                    }
                    // Track frame origins in frame_name (comma-separated)
                    String origFrames = existing.getFrameName() != null ? existing.getFrameName() : "";
                    if (!origFrames.contains(frameName)) {
                        existing.setFrameName(origFrames.isBlank() ? frameName : origFrames + "," + frameName);
                    }
                    dbTableRepo.save(existing);
                    merged++;
                } else {
                    // ─── Insert new ───
                    ProjectDbTable dt = new ProjectDbTable();
                    dt.setProjectId(projectId);
                    dt.setFrameName(frameName);
                    dt.setTableName(t.getTableName());
                    dt.setColumns(t.getColumns());
                    dt.setDescription(t.getDescription());
                    dbTableRepo.save(dt);
                    inserted++;
                }
            }
        }
        log.info("[ProjectDesign] DB Tables — inserted={}, merged={}", inserted, merged);

        log.info("[ProjectDesign] Saved: {} files, {} APIs, {} tables",
            req.getFiles() != null ? req.getFiles().size() : 0,
            req.getApiEndpoints() != null ? req.getApiEndpoints().size() : 0,
            req.getDbTables() != null ? req.getDbTables().size() : 0);
    }

    // ── Get all for project ──
    public ProjectDesignDto.GeneratedFileResponse getByProjectAndFrame(Long projectId, String frameName) {
        ProjectGeneratedFile session = generatedFileRepo
            .findByProjectIdAndFrameName(projectId, frameName).orElse(null);

        ProjectDesignDto.GeneratedFileResponse resp = new ProjectDesignDto.GeneratedFileResponse();
        resp.setProjectId(projectId);
        resp.setFrameName(frameName);

        if (session != null) {
            resp.setId(session.getId());
            resp.setGeneratedAt(session.getGeneratedAt());
            resp.setFiles(session.getItems().stream().map(i -> {
                ProjectDesignDto.FileItem fi = new ProjectDesignDto.FileItem();
                fi.setFileName(i.getFileName());
                fi.setFileContent(i.getFileContent());
                return fi;
            }).collect(Collectors.toList()));
        }

        resp.setApiEndpoints(apiEndpointRepo.findByProjectIdOrderByMethod(projectId).stream().map(e -> {
            ProjectDesignDto.ApiEndpoint ae = new ProjectDesignDto.ApiEndpoint();
            ae.setMethod(e.getMethod());
            ae.setUrl(e.getUrl());
            ae.setDescription(e.getDescription());
            ae.setRequestBody(e.getRequestBody());
            ae.setResponseBody(e.getResponseBody());
            ae.setPathParams(e.getPathParams());
            ae.setQueryParams(e.getQueryParams());
            ae.setStatusCodes(e.getStatusCodes());
            return ae;
        }).collect(Collectors.toList()));

        resp.setDbTables(dbTableRepo.findByProjectIdOrderByTableName(projectId).stream().map(t -> {
            ProjectDesignDto.DbTable dt = new ProjectDesignDto.DbTable();
            dt.setTableName(t.getTableName());
            dt.setColumns(t.getColumns());
            dt.setDescription(t.getDescription());
            return dt;
        }).collect(Collectors.toList()));

        return resp;
    }

    // ════════════════════════════════════════════════════════════════
    // AI-powered Column Merge — merges existing + new columns intelligently
    // (Kept inside this service to avoid circular dependency with ExtractService)
    // ════════════════════════════════════════════════════════════════
    private String mergeColumnsWithAI(String tableName, String existingColumns, String newColumns) {
        log.info("[Merge] Table={} | existing={} chars | new={} chars",
            tableName,
            existingColumns != null ? existingColumns.length() : 0,
            newColumns != null ? newColumns.length() : 0);

        // Fast-path: if either is empty, return the other
        if (existingColumns == null || existingColumns.isBlank()) return newColumns;
        if (newColumns == null || newColumns.isBlank()) return existingColumns;

        // Fast-path: identical strings
        if (existingColumns.trim().equals(newColumns.trim())) return existingColumns;

        try {
            String prompt = buildMergePrompt(tableName, existingColumns, newColumns);
            String aiJson = callClaudeForMerge(prompt);
            log.debug("[Merge] AI preview: {}",
                aiJson.substring(0, Math.min(200, aiJson.length())));

            // Strip markdown fences if present
            String clean = aiJson.trim();
            if (clean.startsWith("```")) {
                int firstNl = clean.indexOf('\n');
                if (firstNl > 0) clean = clean.substring(firstNl + 1);
                int lastFence = clean.lastIndexOf("```");
                if (lastFence > 0) clean = clean.substring(0, lastFence).trim();
            }

            JsonNode node = objectMapper.readTree(clean);
            String result = node.has("columns") ? node.get("columns").asText() : null;

            if (result == null || result.isBlank()) {
                log.warn("[Merge] AI returned empty columns — fallback to union");
                return simpleUnionMerge(existingColumns, newColumns);
            }

            log.info("[Merge] Merged successfully — {} chars", result.length());
            return result;

        } catch (Exception e) {
            log.error("[Merge] Failed: {} — using simple union fallback", e.getMessage());
            return simpleUnionMerge(existingColumns, newColumns);
        }
    }

    // ── Call Claude API for merge ──
    @SuppressWarnings("unchecked")
    private String callClaudeForMerge(String prompt) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
            "model", CLAUDE_MODEL,
            "max_tokens", 2000,
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(
            CLAUDE_URL, HttpMethod.POST, entity, Map.class);

        if (response.getBody() == null) throw new RuntimeException("Empty AI response");
        List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
        if (content == null || content.isEmpty()) throw new RuntimeException("No content in AI response");
        return (String) content.get(0).get("text");
    }

    // ── AI merge prompt ──
    private String buildMergePrompt(String tableName, String existingCols, String newCols) {
        return "You are a database architect. Merge two versions of columns for the same table.\n\n"
            + "Table name: " + tableName + "\n\n"
            + "=== EXISTING COLUMNS ===\n" + existingCols + "\n\n"
            + "=== NEW COLUMNS (from a different UI frame) ===\n" + newCols + "\n\n"
            + "Rules:\n"
            + "1. UNION all unique columns (by column name)\n"
            + "2. If same column name appears in both with DIFFERENT types:\n"
            + "   - Prefer the more permissive type (VARCHAR(255) over VARCHAR(100))\n"
            + "   - Prefer TEXT over VARCHAR for long fields\n"
            + "   - Prefer DECIMAL(10,2) over FLOAT for money\n"
            + "3. Keep PRIMARY KEY / FK / NOT NULL / UNIQUE constraints from either side\n"
            + "4. Order: id PK first, then FKs, then data fields, timestamps last\n"
            + "5. Output ONE LINE comma-separated column definition string\n\n"
            + "Return ONLY a valid JSON (no markdown, no explanation):\n"
            + "{\n"
            + "  \"columns\": \"id INT PK, user_id INT FK, name VARCHAR(255), email VARCHAR(255) UNIQUE, created_at TIMESTAMP\"\n"
            + "}";
    }

    // ── Fallback: simple union merge (no AI) ──
    private String simpleUnionMerge(String existing, String newCols) {
        LinkedHashMap<String, String> colMap = new LinkedHashMap<>();
        parseColumnsInto(existing, colMap);
        parseColumnsInto(newCols, colMap);  // new overwrites existing for same key
        return String.join(", ", colMap.values());
    }

    private void parseColumnsInto(String colStr, LinkedHashMap<String, String> map) {
        if (colStr == null) return;
        for (String part : colStr.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            // Extract column name (first word)
            String colName = trimmed.split("\\s+")[0].toLowerCase();
            map.put(colName, trimmed);
        }
    }
}