
package com.commandCenter.backend.controller;
 
import com.commandCenter.backend.model.TeamLocation;
import com.commandCenter.backend.repository.TeamLocationRepository;
import com.commandCenter.backend.repository.ResponseTeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;
 
@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
public class LiveTrackingController {
 
    private final TeamLocationRepository locationRepository;
    private final ResponseTeamRepository teamRepository;
    private final SimpMessagingTemplate messagingTemplate;
 
    // GET /api/tracking/latest — latest location for every team
    @GetMapping("/latest")
    public ResponseEntity<List<TeamLocation>> getLatest() {
        return ResponseEntity.ok(locationRepository.findLatestForAllTeams());
    }
 
    // POST /api/tracking/update — team pushes their location
    @PostMapping("/update")
    public ResponseEntity<TeamLocation> updateLocation(@RequestBody Map<String, Object> body) {
        UUID teamId = UUID.fromString(body.get("teamId").toString());
        String teamName = teamRepository.findById(teamId)
                .map(t -> t.getName()).orElse("Unknown");
 
        TeamLocation loc = TeamLocation.builder()
                .teamId(teamId)
                .teamName(teamName)
                .latitude(Double.parseDouble(body.get("latitude").toString()))
                .longitude(Double.parseDouble(body.get("longitude").toString()))
                .status(body.getOrDefault("status", "IDLE").toString())
                .headingDegrees(body.get("heading") != null
                        ? Integer.parseInt(body.get("heading").toString()) : null)
                .speedKmh(body.get("speed") != null
                        ? Double.parseDouble(body.get("speed").toString()) : null)
                .build();
 
        TeamLocation saved = locationRepository.save(loc);
        messagingTemplate.convertAndSend("/topic/tracking", saved);
        return ResponseEntity.ok(saved);
    }
}