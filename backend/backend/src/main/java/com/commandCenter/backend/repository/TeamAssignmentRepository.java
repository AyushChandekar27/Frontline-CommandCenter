// ═══════════════════════════════════════════
// FILE: repository/TeamAssignmentRepository.java
// ═══════════════════════════════════════════
package com.commandCenter.backend.repository;
 
import com.commandCenter.backend.model.TeamAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;
 
@Repository
public interface TeamAssignmentRepository extends JpaRepository<TeamAssignment, UUID> {
    List<TeamAssignment> findByAlertIdOrderByAssignedAtDesc(UUID alertId);
    List<TeamAssignment> findByTeamIdOrderByAssignedAtDesc(UUID teamId);
    List<TeamAssignment> findByStatusOrderByAssignedAtDesc(String status);
    List<TeamAssignment> findAllByOrderByAssignedAtDesc();
    boolean existsByAlertIdAndStatus(UUID alertId, String status);
}