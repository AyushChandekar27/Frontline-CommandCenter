package com.commandCenter.backend.repository;

import com.commandCenter.backend.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {

    List<Alert> findByStatusIgnoreCase(String status);
    List<Alert> findByTypeIgnoreCase(String type);
    List<Alert> findBySeverityIgnoreCase(String severity);
    List<Alert> findByStatusIgnoreCaseAndSeverityIgnoreCase(String status, String severity);
    long countByStatusIgnoreCase(String status);
    long countBySeverityIgnoreCase(String severity);
    List<Alert> findTop10ByOrderByCreatedAtDesc();
    List<Alert> findAllByOrderByCreatedAtDesc();
    List<Alert> findBySlaBreachedTrue();

    @Query("SELECT a FROM Alert a WHERE " +
            "LOWER(a.status) IN ('active', 'monitoring') AND " +
            "a.slaMinutes IS NOT NULL AND " +
            "(a.slaBreached IS NULL OR a.slaBreached = false) AND " +
            "a.acknowledgedAt IS NULL")
    List<Alert> findAlertsRequiringSlaCheck();

    @Query("SELECT a FROM Alert a WHERE " +
            "LOWER(a.title) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "LOWER(a.location) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<Alert> searchByTitleOrLocation(@Param("q") String query);
}