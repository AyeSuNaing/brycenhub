package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.ActivityLog;
import jp.co.brycen.asn.repository.ActivityLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ActivityLogService {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    public void log(Long userId, String action, String targetType,
                    Long targetId, String oldValue, String newValue,
                    Long projectId) {
        ActivityLog log = new ActivityLog();
        log.setUserId(userId);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setProjectId(projectId);
        activityLogRepository.save(log);
    }

    public List<ActivityLog> getByProject(Long projectId) {
        return activityLogRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    public List<ActivityLog> getByUser(Long userId) {
        return activityLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<ActivityLog> getByTarget(String targetType, Long targetId) {
        return activityLogRepository
                .findByTargetTypeAndTargetIdOrderByCreatedAtDesc(targetType, targetId);
    }
}