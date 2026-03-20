package jp.co.brycen.asn.repository;

import jp.co.brycen.asn.model.PublicHoliday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PublicHolidayRepository extends JpaRepository<PublicHoliday, Long> {

    // ── Country + this month ──────────────────────────────────────
    @Query("SELECT h FROM PublicHoliday h " +
           "WHERE h.countryId = :countryId " +
           "AND YEAR(h.holidayDate) = :year " +
           "AND MONTH(h.holidayDate) = :month " +
           "ORDER BY h.holidayDate ASC")
    List<PublicHoliday> findByCountryIdAndYearAndMonth(
            @Param("countryId") Long countryId,
            @Param("year")      int year,
            @Param("month")     int month);

    // ── All countries + this month (Company Admin) ────────────────
    @Query("SELECT h FROM PublicHoliday h " +
           "WHERE YEAR(h.holidayDate) = :year " +
           "AND MONTH(h.holidayDate) = :month " +
           "ORDER BY h.holidayDate ASC")
    List<PublicHoliday> findByYearAndMonth(
            @Param("year")  int year,
            @Param("month") int month);

    // ── Country + full year (Settings page) ──────────────────────
    @Query("SELECT h FROM PublicHoliday h " +
           "WHERE h.countryId = :countryId " +
           "AND YEAR(h.holidayDate) = :year " +
           "ORDER BY h.holidayDate ASC")
    List<PublicHoliday> findByCountryIdAndYear(
            @Param("countryId") Long countryId,
            @Param("year")      int year);

    // ── Next upcoming holiday (preview) ──────────────────────────
    @Query("SELECT h FROM PublicHoliday h " +
           "WHERE h.countryId = :countryId " +
           "AND h.holidayDate > :fromDate " +
           "ORDER BY h.holidayDate ASC")
    List<PublicHoliday> findNextHolidays(
            @Param("countryId") Long countryId,
            @Param("fromDate")  LocalDate fromDate);

    // ── Check if date is a holiday (for OT rate calc) ────────────
    @Query("SELECT COUNT(h) > 0 FROM PublicHoliday h " +
           "WHERE h.countryId = :countryId " +
           "AND h.holidayDate = :date")
    boolean existsByCountryIdAndDate(
            @Param("countryId") Long countryId,
            @Param("date")      LocalDate date);
}
