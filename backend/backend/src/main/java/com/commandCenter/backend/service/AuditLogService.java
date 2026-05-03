package com.commandCenter.backend.service;

import com.commandCenter.backend.model.AuditLog;
import com.commandCenter.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void log(String action, String entityType, String entityId, String entityTitle, String details) {
        AuditLog entry = AuditLog.builder()
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .entityTitle(entityTitle)
                .details(details)
                .performedBy("SYSTEM")
                .build();
        auditLogRepository.save(entry);
    }

    public void log(String action, String entityType, String entityId, String entityTitle,
                    String details, String performedBy) {
        AuditLog entry = AuditLog.builder()
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .entityTitle(entityTitle)
                .details(details)
                .performedBy(performedBy)
                .build();
        auditLogRepository.save(entry);
    }

    public List<AuditLog> getAll() {
        return auditLogRepository.findAllByOrderByPerformedAtDesc();
    }

    public List<AuditLog> getRecent() {
        return auditLogRepository.findTop50ByOrderByPerformedAtDesc();
    }

    public List<AuditLog> getByEntityId(String entityId) {
        return auditLogRepository.findByEntityIdOrderByPerformedAtDesc(entityId);
    }

    public List<AuditLog> getByEntityType(String entityType) {
        return auditLogRepository.findByEntityTypeOrderByPerformedAtDesc(entityType);
    }
}