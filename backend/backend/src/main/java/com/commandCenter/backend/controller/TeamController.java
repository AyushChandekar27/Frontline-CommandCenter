package com.commandCenter.backend.controller;

import com.commandCenter.backend.DTO.TeamRecommendationResponse;
import com.commandCenter.backend.model.ResponseTeam;
import com.commandCenter.backend.repository.ResponseTeamRepository;
import com.commandCenter.backend.service.TeamRecommendationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamRecommendationService teamService;
    private final ResponseTeamRepository teamRepository;

    // GET /api/teams — all teams (for Teams management page)
    @GetMapping
    public ResponseEntity<List<ResponseTeam>> getAllTeams() {
        return ResponseEntity.ok(teamRepository.findAll());
    }

    // POST /api/teams — create a team from UI form
    @PostMapping
    public ResponseEntity<ResponseTeam> createTeam(@Valid @RequestBody ResponseTeam team) {
        ResponseTeam saved = teamRepository.save(team);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // PUT /api/teams/{id} — update a team
    @PutMapping("/{id}")
    public ResponseEntity<ResponseTeam> updateTeam(
            @PathVariable UUID id,
            @RequestBody ResponseTeam updated
    ) {
        ResponseTeam existing = teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found: " + id));

        existing.setName(updated.getName());
        existing.setSpecialty(updated.getSpecialty());
        existing.setIcon(updated.getIcon());
        existing.setHandlesTypes(updated.getHandlesTypes());
        existing.setHandlesSeverities(updated.getHandlesSeverities());
        existing.setBaseLat(updated.getBaseLat());
        existing.setBaseLng(updated.getBaseLng());
        existing.setBaseLocation(updated.getBaseLocation());
        existing.setMembers(updated.getMembers());
        existing.setAvailability(updated.getAvailability());
        existing.setAvgSpeedKmh(updated.getAvgSpeedKmh());

        return ResponseEntity.ok(teamRepository.save(existing));
    }

    // DELETE /api/teams/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID id) {
        if (!teamRepository.existsById(id)) {
            throw new RuntimeException("Team not found: " + id);
        }
        teamRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/teams/recommend?type=Fire&severity=CRITICAL&lat=34.05&lng=-118.24&top=3
    @GetMapping("/recommend")
    public ResponseEntity<List<TeamRecommendationResponse>> recommend(
            @RequestParam String type,
            @RequestParam String severity,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "3") int top
    ) {
        return ResponseEntity.ok(teamService.recommend(type, severity, lat, lng, top));
    }
}