// ═══════════════════════════════════════════
// FILE: repository/AuditLogRepository.java
// ═══════════════════════════════════════════
package com.commandCenter.backend.repository;
 
import com.commandCenter.backend.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;
 
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findAllByOrderByPerformedAtDesc();
    List<AuditLog> findByEntityTypeOrderByPerformedAtDesc(String entityType);
    List<AuditLog> findByEntityIdOrderByPerformedAtDesc(String entityId);
    List<AuditLog> findTop50ByOrderByPerformedAtDesc();
}