package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.DesignBoard;
import jp.co.brycen.asn.repository.DesignBoardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional
public class DesignService {

    @Autowired
    private DesignBoardRepository designBoardRepository;

    // ── GET by project ───────────────────────────────────────────
    public Optional<DesignBoard> getByProjectId(Long projectId) {
        return designBoardRepository.findByProjectId(projectId);
    }

    // ── SAVE (create or update) ──────────────────────────────────
    public DesignBoard save(Long projectId, String canvasData,
                            String thumbnailUrl, Long updatedBy) {
        DesignBoard board = designBoardRepository
            .findByProjectId(projectId)
            .orElse(DesignBoard.builder()
                .projectId(projectId)
                .version(0)
                .build());

        board.setCanvasData(canvasData);
        board.setThumbnailUrl(thumbnailUrl);
        board.setUpdatedBy(updatedBy);
        board.setVersion(board.getVersion() + 1);

        return designBoardRepository.save(board);
    }

    // ── DELETE ───────────────────────────────────────────────────
    public void deleteByProjectId(Long projectId) {
        designBoardRepository.findByProjectId(projectId)
            .ifPresent(designBoardRepository::delete);
    }
}
