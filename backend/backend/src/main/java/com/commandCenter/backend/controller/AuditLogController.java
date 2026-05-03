
package com.commandCenter.backend.controller;
 
import com.commandCenter.backend.model.AuditLog;
import com.commandCenter.backend.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
 
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditLogController {
 
    private final AuditLogService auditLogService;
 
    @GetMapping
    public ResponseEntity<List<AuditLog>> getAll(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId) {
        if (entityId != null) return ResponseEntity.ok(auditLogService.getByEntityId(entityId));
        if (entityType != null) return ResponseEntity.ok(auditLogService.getByEntityType(entityType));
        return ResponseEntity.ok(auditLogService.getRecent());
    }
}
 