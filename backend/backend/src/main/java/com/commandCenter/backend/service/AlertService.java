package com.commandCenter.backend.service;

import com.commandCenter.backend.DTO.AlertRequest;
import com.commandCenter.backend.DTO.AlertResponse;
import com.commandCenter.backend.DTO.AttachmentResponse;
import com.commandCenter.backend.model.Alert;
import com.commandCenter.backend.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;

    // ── CREATE ──────────────────────────────────────────────

    public AlertResponse createAlert(AlertRequest req) {
        com.commandCenter.backend.model.Alert alert = com.commandCenter.backend.model.Alert.builder()
                .title(req.getTitle())
                .type(req.getType())
                .severity(req.getSeverity().toUpperCase())
                .status(req.getStatus().toUpperCase())
                .location(req.getLocation())
                .region(req.getRegion())
                .description(req.getDescription())
                .affectedPopulation(req.getAffectedPopulation())
                .reportingUnit(req.getReportingUnit())
                .mapX(req.getMapX())
                .mapY(req.getMapY())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .radiusKm(req.getRadiusKm())
                .slaMinutes(req.getSlaMinutes())
                .build();

        Alert saved = alertRepository.save(alert);
        return toResponse(saved);
    }

    // ── READ ────────────────────────────────────────────────

    public List<AlertResponse> getAllAlerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public AlertResponse getAlertById(UUID id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + id));
        return toResponse(alert);
    }

    public List<AlertResponse> getActiveAlerts() {
        return alertRepository.findByStatusIgnoreCase("ACTIVE")
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<AlertResponse> getRecentAlerts() {
        return alertRepository.findTop10ByOrderByCreatedAtDesc()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<AlertResponse> searchAlerts(String query) {
        return alertRepository.searchByTitleOrLocation(query)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<AlertResponse> filterAlerts(String type, String severity, String status) {
        List<Alert> results;

        if (status != null && severity != null) {
            results = alertRepository.findByStatusIgnoreCaseAndSeverityIgnoreCase(status, severity);
        } else if (status != null) {
            results = alertRepository.findByStatusIgnoreCase(status);
        } else if (severity != null) {
            results = alertRepository.findBySeverityIgnoreCase(severity);
        } else if (type != null) {
            results = alertRepository.findByTypeIgnoreCase(type);
        } else {
            results = alertRepository.findAllByOrderByCreatedAtDesc();
        }

        return results.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── UPDATE ──────────────────────────────────────────────

    public AlertResponse updateAlertStatus(UUID id, String newStatus) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + id));
        alert.setStatus(newStatus.toUpperCase());
        return toResponse(alertRepository.save(alert));
    }

    public AlertResponse updateAlert(UUID id, AlertRequest req) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + id));

        alert.setTitle(req.getTitle());
        alert.setType(req.getType());
        alert.setSeverity(req.getSeverity().toUpperCase());
        alert.setStatus(req.getStatus().toUpperCase());
        alert.setLocation(req.getLocation());
        alert.setRegion(req.getRegion());
        alert.setDescription(req.getDescription());
        alert.setAffectedPopulation(req.getAffectedPopulation());
        alert.setReportingUnit(req.getReportingUnit());
        alert.setMapX(req.getMapX());
        alert.setMapY(req.getMapY());
        alert.setLatitude(req.getLatitude());
        alert.setLongitude(req.getLongitude());
        alert.setRadiusKm(req.getRadiusKm());
        alert.setSlaMinutes(req.getSlaMinutes());

        return toResponse(alertRepository.save(alert));
    }

    // ── DELETE ──────────────────────────────────────────────

    public void deleteAlert(UUID id) {
        if (!alertRepository.existsById(id)) {
            throw new RuntimeException("Alert not found: " + id);
        }
        alertRepository.deleteById(id);
    }

    // ── DASHBOARD STATS ─────────────────────────────────────

    public Map<String, Object> getDashboardStats() {
        long total = alertRepository.count();
        long active = alertRepository.countByStatusIgnoreCase("ACTIVE");
        long monitoring = alertRepository.countByStatusIgnoreCase("MONITORING");
        long resolved = alertRepository.countByStatusIgnoreCase("RESOLVED");
        long critical = alertRepository.countBySeverityIgnoreCase("CRITICAL");

        int totalAffected = alertRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(a -> a.getAffectedPopulation() != null)
                .mapToInt(Alert::getAffectedPopulation)
                .sum();

        return Map.of(
                "total", total,
                "active", active,
                "monitoring", monitoring,
                "resolved", resolved,
                "critical", critical,
                "totalAffected", totalAffected
        );
    }

    // ── MAPPER ──────────────────────────────────────────────

    // ── Replace the toResponse() method in AlertService.java with this ──

    private AlertResponse toResponse(Alert a) {
        List<AttachmentResponse> attachmentDtos = a.getAttachments() == null
                ? List.of()
                : a.getAttachments().stream()
                  .map(att -> AttachmentResponse.builder()
                              .id(att.getId())
                              .kind(att.getKind())
                              .filename(att.getFilename())
                              .fileUrl(att.getFileUrl())
                              .mimeType(att.getMimeType())
                              .fileSize(att.getFileSize())
                              .uploadedAt(att.getUploadedAt())
                              .build())
                  .collect(Collectors.toList());

        return AlertResponse.builder()
                .id(a.getId())
                .title(a.getTitle())
                .type(a.getType())
                .severity(a.getSeverity())
                .status(a.getStatus())
                .location(a.getLocation())
                .region(a.getRegion())
                .description(a.getDescription())
                .affectedPopulation(a.getAffectedPopulation())
                .reportingUnit(a.getReportingUnit())
                .latitude(a.getLatitude())
                .longitude(a.getLongitude())
                .mapX(a.getMapX())
                .mapY(a.getMapY())
                .radiusKm(a.getRadiusKm())
                .slaMinutes(a.getSlaMinutes())
                .slaBreached(a.getSlaBreached())
                .assignedTeamId(a.getAssignedTeamId() != null ? a.getAssignedTeamId().toString() : null)
                .assignedTeamName(a.getAssignedTeamName())
                .acknowledgedAt(a.getAcknowledgedAt())
                .escalatedAt(a.getEscalatedAt())
                .attachments(attachmentDtos)
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }

}
