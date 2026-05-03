
package com.commandCenter.backend.repository;
import com.commandCenter.backend.model.ResponseTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ResponseTeamRepository extends JpaRepository<ResponseTeam, UUID> {
    List<ResponseTeam> findByAvailabilityIgnoreCase(String availability);
    List<ResponseTeam> findByHandlesTypesContainingIgnoreCase(String type);
}
