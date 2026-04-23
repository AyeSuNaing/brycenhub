package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.AttendanceLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;


import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, Long> {

    Optional<AttendanceLog> findByUserIdAndWorkDate(Long userId, LocalDate workDate);

    List<AttendanceLog> findByUserIdAndWorkDateBetween(Long userId, LocalDate start, LocalDate end);

    @Query("SELECT a FROM AttendanceLog a WHERE a.workDate BETWEEN :start AND :end")
    List<AttendanceLog> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(a) FROM AttendanceLog a WHERE a.userId = :userId " +
           "AND a.workDate BETWEEN :start AND :end AND a.isDayoff = false")
    long countWorkedDays(@Param("userId") Long userId,
                         @Param("start") LocalDate start,
                         @Param("end") LocalDate end);

    List<AttendanceLog> findByWorkDateOrderByUserId(LocalDate workDate);
    
	
	/**
	 * Count days a user actually worked in [start, end] inclusive.
	 * Definition of "worked" = is_dayoff = 0 AND time_in IS NOT NULL.
	 */
	@Query("SELECT COUNT(a) FROM AttendanceLog a " +
	       "WHERE a.userId = :userId " +
	       "  AND a.workDate BETWEEN :start AND :end " +
	       "  AND (a.isDayoff IS NULL OR a.isDayoff = false) " +
	       "  AND a.timeIn IS NOT NULL")
	int countWorkedDaysInPeriod(@Param("userId") Long userId,
	                            @Param("start")  LocalDate start,
	                            @Param("end")    LocalDate end);

}
