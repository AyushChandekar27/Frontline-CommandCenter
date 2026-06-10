package com.commandCenter.backend.service;

import com.commandCenter.backend.model.Alert;
import com.commandCenter.backend.model.ResponseTeam;
import com.commandCenter.backend.model.TeamAssignment;
import com.commandCenter.backend.repository.AlertRepository;
import com.commandCenter.backend.repository.ResponseTeamRepository;
import com.commandCenter.backend.repository.TeamAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssignmentService {

    private final TeamAssignmentRepository assignmentRepository;
    private final AlertRepository alertRepository;
    private final ResponseTeamRepository teamRepository;
    private final AuditLogService auditLogService;
    private final SimpMessagingTemplate messagingTemplate;

    // ── Auto-assign best team to an alert ──────────────────────────────

    public TeamAssignment autoAssign(UUID alertId) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + alertId));

        List<ResponseTeam> teams = teamRepository.findAll();
        if (teams.isEmpty()) throw new RuntimeException("No teams registered in the system.");

        ResponseTeam best = selectBestTeam(teams, alert);

        TeamAssignment assignment = TeamAssignment.builder()
                .alertId(alertId)
                .teamId(best.getId())
                .teamName(best.getName())
                .status("ASSIGNED")
                .assignmentType("AUTO")
                .assignedBy("SYSTEM")
                .etaMinutes(calcEta(best, alert))
                .build();

        TeamAssignment saved = assignmentRepository.save(assignment);

        // Update alert with assigned team
        alert.setAssignedTeamId(best.getId());
        alert.setAssignedTeamName(best.getName());
        alert.setStatus("ACTIVE");
        alertRepository.save(alert);

        // Update team availability
        best.setAvailability("EN_ROUTE");
        teamRepository.save(best);

        auditLogService.log("TEAM_ASSIGNED", "ASSIGNMENT", saved.getId().toString(),
                alert.getTitle(), "Auto-assigned " + best.getName() + " to alert");

        // Push via WebSocket
        messagingTemplate.convertAndSend("/topic/assignments", saved);
        messagingTemplate.convertAndSend("/topic/alerts", alert);

        return saved;
    }

    // ── Manual assignment ──────────────────────────────────────────────

    public TeamAssignment manualAssign(UUID alertId, UUID teamId, String assignedBy, String notes) {
        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + alertId));
        ResponseTeam team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Team not found: " + teamId));
        if (!"AVAILABLE".equalsIgnoreCase(team.getAvailability())) {
            throw new RuntimeException("Team is not available for assignment.");
        }

        TeamAssignment assignment = TeamAssignment.builder()
                .alertId(alertId)
                .teamId(teamId)
                .teamName(team.getName())
                .status("ASSIGNED")
                .assignmentType("MANUAL")
                .assignedBy(assignedBy != null ? assignedBy : "OPS_CONSOLE")
                .etaMinutes(calcEta(team, alert))
                .notes(notes)
                .build();

        TeamAssignment saved = assignmentRepository.save(assignment);

        alert.setAssignedTeamId(teamId);
        alert.setAssignedTeamName(team.getName());
        alertRepository.save(alert);

        team.setAvailability("EN_ROUTE");
        teamRepository.save(team);

        auditLogService.log("TEAM_ASSIGNED", "ASSIGNMENT", saved.getId().toString(),
                alert.getTitle(), "Manual assignment: " + team.getName() + " by " + assignedBy, assignedBy);

        messagingTemplate.convertAndSend("/topic/assignments", saved);

        return saved;
    }

    // ── Update assignment status (EN_ROUTE → ON_SITE → RESOLVED) ──────

    public TeamAssignment updateStatus(UUID assignmentId, String newStatus) {
        TeamAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new RuntimeException("Assignment not found: " + assignmentId));

        a.setStatus(newStatus);
        if ("ON_SITE".equals(newStatus)) a.setArrivedAt(LocalDateTime.now());
        if ("RESOLVED".equals(newStatus)) a.setResolvedAt(LocalDateTime.now());

        TeamAssignment saved = assignmentRepository.save(a);

        // If resolved, free the team
        if ("RESOLVED".equals(newStatus)) {
            teamRepository.findById(a.getTeamId()).ifPresent(t -> {
                t.setAvailability("AVAILABLE");
                teamRepository.save(t);
            });
            // Also resolve the alert
            alertRepository.findById(a.getAlertId()).ifPresent(alert -> {
                alert.setStatus("RESOLVED");
                alertRepository.save(alert);
                messagingTemplate.convertAndSend("/topic/alerts", alert);
            });
        }

        auditLogService.log("STATUS_CHANGED", "ASSIGNMENT", assignmentId.toString(),
                a.getTeamName(), "Assignment status → " + newStatus);

        messagingTemplate.convertAndSend("/topic/assignments", saved);
        return saved;
    }

    // ── Getters ────────────────────────────────────────────────────────

    public List<TeamAssignment> getAll() {
        return assignmentRepository.findAllByOrderByAssignedAtDesc();
    }

    public List<TeamAssignment> getByAlert(UUID alertId) {
        return assignmentRepository.findByAlertIdOrderByAssignedAtDesc(alertId);
    }

    public List<TeamAssignment> getByStatus(String status) {
        return assignmentRepository.findByStatusOrderByAssignedAtDesc(status);
    }

    // ── Internal: best team scoring ───────────────────────────────────

    private ResponseTeam selectBestTeam(List<ResponseTeam> teams, Alert alert) {
        return teams.stream()
                .max(Comparator.comparingDouble(t -> score(t, alert)))
                .orElse(teams.get(0));
    }

    private double score(ResponseTeam t, Alert alert) {
        double s = 0;
        if (t.getHandlesTypes() != null &&
                Arrays.stream(t.getHandlesTypes().split(","))
                      .anyMatch(x -> x.trim().equalsIgnoreCase(alert.getType()))) s += 40;
        if (t.getHandlesSeverities() != null &&
                Arrays.stream(t.getHandlesSeverities().split(","))
                      .anyMatch(x -> x.trim().equalsIgnoreCase(alert.getSeverity()))) s += 30;
        if ("AVAILABLE".equalsIgnoreCase(t.getAvailability())) s += 20;
        else if ("RETURNING".equalsIgnoreCase(t.getAvailability())) s += 10;
        if (alert.getLatitude() != null && t.getBaseLat() != null) {
            double dist = haversine(alert.getLatitude(), alert.getLongitude(),
                                    t.getBaseLat(), t.getBaseLng());
            s += Math.max(0, 10 - dist / 100.0 * 10);
        }
        return s;
    }

    private int calcEta(ResponseTeam team, Alert alert) {
        if (alert.getLatitude() == null || team.getBaseLat() == null) return 30;
        double dist = haversine(alert.getLatitude(), alert.getLongitude(),
                                team.getBaseLat(), team.getBaseLng());
        int speed = team.getAvgSpeedKmh() != null ? team.getAvgSpeedKmh() : 60;
        return (int) Math.ceil((dist / speed) * 60);
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
