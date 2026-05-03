package com.commandCenter.backend.controller;
 
import com.commandCenter.backend.model.TeamAssignment;
import com.commandCenter.backend.service.AssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
 
@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {
 
    private final AssignmentService assignmentService;
 
    // GET /api/assignments
    @GetMapping
    public ResponseEntity<List<TeamAssignment>> getAll(
            @RequestParam(required = false) String status) {
        if (status != null) return ResponseEntity.ok(assignmentService.getByStatus(status));
        return ResponseEntity.ok(assignmentService.getAll());
    }
 
    // GET /api/assignments/alert/{alertId}
    @GetMapping("/alert/{alertId}")
    public ResponseEntity<List<TeamAssignment>> getByAlert(@PathVariable UUID alertId) {
        return ResponseEntity.ok(assignmentService.getByAlert(alertId));
    }
 
    // POST /api/assignments/auto/{alertId}
    @PostMapping("/auto/{alertId}")
    public ResponseEntity<TeamAssignment> autoAssign(@PathVariable UUID alertId) {
        return ResponseEntity.ok(assignmentService.autoAssign(alertId));
    }
 
    // POST /api/assignments/manual
    @PostMapping("/manual")
    public ResponseEntity<TeamAssignment> manualAssign(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(assignmentService.manualAssign(
                UUID.fromString(body.get("alertId")),
                UUID.fromString(body.get("teamId")),
                body.get("assignedBy"),
                body.get("notes")
        ));
    }
 
    // PATCH /api/assignments/{id}/status
    @PatchMapping("/{id}/status")
    public ResponseEntity<TeamAssignment> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(assignmentService.updateStatus(id, body.get("status")));
    }
}
