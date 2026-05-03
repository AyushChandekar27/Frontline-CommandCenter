package com.commandCenter.backend.controller;

import com.commandCenter.backend.DTO.AlertRequest;
import com.commandCenter.backend.DTO.AlertResponse;
import com.commandCenter.backend.model.Alert;
import com.commandCenter.backend.repository.AlertRepository;
import com.commandCenter.backend.service.AlertService;
import com.commandCenter.backend.service.SlaSchedulerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;
    private final AlertRepository alertRepository;
    private final SlaSchedulerService slaSchedulerService;


    // ── POST /api/alerts
    @PostMapping
    public ResponseEntity<AlertResponse> createAlert(@Valid @RequestBody AlertRequest request) {
        AlertResponse response = alertService.createAlert(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── GET /api/alerts
    @GetMapping
    public ResponseEntity<List<AlertResponse>> getAlerts(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(alertService.filterAlerts(type, severity, status));
    }

    // ── GET /api/alerts/recent
    @GetMapping("/recent")
    public ResponseEntity<List<AlertResponse>> getRecentAlerts() {
        return ResponseEntity.ok(alertService.getRecentAlerts());
    }

    // ── GET /api/alerts/active
    @GetMapping("/active")
    public ResponseEntity<List<AlertResponse>> getActiveAlerts() {
        return ResponseEntity.ok(alertService.getActiveAlerts());
    }

    // ── GET /api/alerts/search?q=wildfire
    @GetMapping("/search")
    public ResponseEntity<List<AlertResponse>> searchAlerts(@RequestParam String q) {
        return ResponseEntity.ok(alertService.searchAlerts(q));
    }

    // ── GET /api/alerts/stats
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(alertService.getDashboardStats());
    }

    // ── GET /api/alerts/{id}
    @GetMapping("/{id}")
    public ResponseEntity<AlertResponse> getAlertById(@PathVariable UUID id) {
        return ResponseEntity.ok(alertService.getAlertById(id));
    }

    // ── PUT /api/alerts/{id}
    @PutMapping("/{id}")
    public ResponseEntity<AlertResponse> updateAlert(
            @PathVariable UUID id,
            @Valid @RequestBody AlertRequest request
    ) {
        return ResponseEntity.ok(alertService.updateAlert(id, request));
    }

    // ── PATCH /api/alerts/{id}/status
    @PatchMapping("/{id}/status")
    public ResponseEntity<AlertResponse> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body
    ) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(alertService.updateAlertStatus(id, newStatus));
    }

    // ── DELETE /api/alerts/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAlert(@PathVariable UUID id) {
        alertService.deleteAlert(id);
        return ResponseEntity.noContent().build();
    }

    // ── POST /api/alerts/{id}/acknowledge
    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<AlertResponse> acknowledgeAlert(@PathVariable UUID id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found: " + id));
        slaSchedulerService.acknowledge(alert);
        return ResponseEntity.ok(alertService.getAlertById(id));
    }
}







