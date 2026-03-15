package jp.co.brycen.asn.service;

import jp.co.brycen.asn.model.Comment;
import jp.co.brycen.asn.repository.CommentRepository;
import jp.co.brycen.asn.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CommentService {

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ActivityLogService activityLogService;

    // GET comments by task
    public List<Comment> getCommentsByTask(Long taskId) {
        return commentRepository.findByTaskId(taskId);
    }

    // CREATE comment
    public Comment createComment(Long taskId, String content, Long userId) {
        var task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Comment comment = new Comment();
        comment.setTaskId(taskId);
        comment.setContent(content);
        comment.setUserId(userId);

        Comment saved = commentRepository.save(comment);

        // Activity log
        activityLogService.log(userId, "COMMENTED", "TASK",
                taskId, null, content, task.getProjectId());

        // Assignee ကို notification ပို့
        if (task.getAssigneeId() != null &&
                !task.getAssigneeId().equals(userId)) {
            notificationService.createNotification(
                    task.getAssigneeId(),
                    "COMMENT",
                    "New comment on task",
                    "New comment on: " + task.getTitle(),
                    "TASK",
                    taskId);
        }

        return saved;
    }

    // UPDATE comment
    public Comment updateComment(Long id, String content, Long userId) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        if (!comment.getUserId().equals(userId)) {
            throw new RuntimeException("You can only edit your own comments");
        }

        comment.setContent(content);
        return commentRepository.save(comment);
    }

    // DELETE comment
    public void deleteComment(Long id, Long userId) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        if (!comment.getUserId().equals(userId)) {
            throw new RuntimeException("You can only delete your own comments");
        }

        commentRepository.deleteById(id);
    }
}
