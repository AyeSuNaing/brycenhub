package jp.co.brycen.asn.service;

import jp.co.brycen.asn.dto.ProjectDesignDto;
import jp.co.brycen.asn.model.*;
import jp.co.brycen.asn.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ProjectDesignService {

    private final ProjectGeneratedFileRepository generatedFileRepo;
    private final ProjectApiEndpointRepository apiEndpointRepo;
    private final ProjectDbTableRepository dbTableRepo;

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

        // ── 3. DB Tables — overwrite by frame_name ──
        dbTableRepo.deleteByProjectIdAndFrameName(projectId, frameName);
        if (req.getDbTables() != null) {
            List<ProjectDbTable> tables = req.getDbTables().stream().map(t -> {
                ProjectDbTable dt = new ProjectDbTable();
                dt.setProjectId(projectId);
                dt.setFrameName(frameName);
                dt.setTableName(t.getTableName());
                dt.setColumns(t.getColumns());
                dt.setDescription(t.getDescription());
                return dt;
            }).collect(Collectors.toList());
            dbTableRepo.saveAll(tables);
        }

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
}