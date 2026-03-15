package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectId(Long projectId);

    List<Task> findByProjectIdAndStatus(Long projectId, String status);

    List<Task> findByProjectIdAndSprintId(Long projectId, Long sprintId);

    List<Task> findByAssigneeId(Long assigneeId);

    List<Task> findByParentTaskId(Long parentTaskId);

    List<Task> findByProjectIdAndParentTaskIdIsNull(Long projectId);

    // ── NEW: overdue tasks (due_date < today AND status != DONE) ──
    @Query("SELECT t FROM Task t WHERE t.projectId IN :projectIds " +
           "AND t.dueDate < :today AND t.status != 'DONE'")
    List<Task> findOverdueTasks(
            @Param("projectIds") List<Long> projectIds,
            @Param("today") LocalDate today);

    // ── NEW: upcoming deadlines (today ~ today+14days) ────────────
    @Query("SELECT t FROM Task t WHERE t.projectId IN :projectIds " +
           "AND t.dueDate >= :today AND t.dueDate <= :maxDate " +
           "AND t.status != 'DONE' ORDER BY t.dueDate ASC")
    List<Task> findUpcomingDeadlines(
            @Param("projectIds") List<Long> projectIds,
            @Param("today") LocalDate today,
            @Param("maxDate") LocalDate maxDate);

    // ── NEW: tasks by projectIds (for stats) ─────────────────────
    @Query("SELECT t FROM Task t WHERE t.projectId IN :projectIds")
    List<Task> findByProjectIdIn(@Param("projectIds") List<Long> projectIds);
}
