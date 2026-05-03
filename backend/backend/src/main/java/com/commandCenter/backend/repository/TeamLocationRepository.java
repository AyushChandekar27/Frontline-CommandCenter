
// ═══════════════════════════════════════════
// FILE: repository/TeamLocationRepository.java
// ═══════════════════════════════════════════
package com.commandCenter.backend.repository;
 
import com.commandCenter.backend.model.TeamLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
 
@Repository
public interface TeamLocationRepository extends JpaRepository<TeamLocation, UUID> {
    Optional<TeamLocation> findTopByTeamIdOrderByRecordedAtDesc(UUID teamId);
 
    @Query("SELECT t FROM TeamLocation t WHERE t.recordedAt = " +
           "(SELECT MAX(t2.recordedAt) FROM TeamLocation t2 WHERE t2.teamId = t.teamId)")
    List<TeamLocation> findLatestForAllTeams();
}
 