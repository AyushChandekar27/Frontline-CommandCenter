package com.commandCenter.backend.service;


import com.commandCenter.backend.DTO.TeamRecommendationResponse;
import com.commandCenter.backend.model.ResponseTeam;
import com.commandCenter.backend.repository.ResponseTeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeamRecommendationService {

    private final ResponseTeamRepository teamRepository;

    /**
     * Returns top-3 recommended teams scored by:
     *   - Type match (40 pts)
     *   - Severity certification (30 pts)
     *   - Proximity (20 pts — closer = higher)
     *   - Availability (10 pts: AVAILABLE=10, STANDBY=5, DEPLOYED=0)
     */
    public List<TeamRecommendationResponse> recommend(
            String alertType,
            String severity,
            Double lat,
            Double lng,
            int topN
    ) {
        List<ResponseTeam> all = teamRepository.findAll();

        List<ScoredTeam> scored = all.stream()
                .map(t -> new ScoredTeam(t, score(t, alertType, severity, lat, lng)))
                .sorted(Comparator.comparingDouble(ScoredTeam::score).reversed())
                .limit(topN)
                .collect(Collectors.toList());

        return scored.stream()
                .map(st -> toDto(st.team(), st.score(), lat, lng))
                .collect(Collectors.toList());
    }

    private double score(ResponseTeam t, String alertType, String severity, Double lat, Double lng) {
        double score = 0;

        // Type match (40 pts)
        if (t.getHandlesTypes() != null &&
            Arrays.stream(t.getHandlesTypes().split(","))
                  .anyMatch(type -> type.trim().equalsIgnoreCase(alertType))) {
            score += 40;
        }

        // Severity match (30 pts)
        if (t.getHandlesSeverities() != null &&
            Arrays.stream(t.getHandlesSeverities().split(","))
                  .anyMatch(sev -> sev.trim().equalsIgnoreCase(severity))) {
            score += 30;
        }

        // Proximity (20 pts) — inverse distance, capped at 200km
        if (lat != null && lng != null && t.getBaseLat() != null && t.getBaseLng() != null) {
            double dist = haversineKm(lat, lng, t.getBaseLat(), t.getBaseLng());
            double proximityScore = Math.max(0, 20 - (dist / 200.0) * 20);
            score += proximityScore;
        } else {
            score += 10; // neutral if no location
        }

        // Availability (10 pts)
        if ("AVAILABLE".equalsIgnoreCase(t.getAvailability())) score += 10;
        else if ("STANDBY".equalsIgnoreCase(t.getAvailability())) score += 5;

        return score;
    }

    private TeamRecommendationResponse toDto(ResponseTeam t, double score, Double lat, Double lng) {
        double distKm = 0;
        int etaMin = 0;

        if (lat != null && lng != null && t.getBaseLat() != null && t.getBaseLng() != null) {
            distKm = haversineKm(lat, lng, t.getBaseLat(), t.getBaseLng());
            int speed = t.getAvgSpeedKmh() != null ? t.getAvgSpeedKmh() : 60;
            etaMin = (int) Math.ceil((distKm / speed) * 60);
        }

        return TeamRecommendationResponse.builder()
                .id(t.getId().toString())
                .name(t.getName())
                .specialty(t.getSpecialty())
                .icon(t.getIcon())
                .members(t.getMembers())
                .availability(t.getAvailability())
                .distanceKm(Math.round(distKm * 10.0) / 10.0)
                .etaMinutes(etaMin)
                .score(Math.round(score * 10.0) / 10.0)
                .baseLocation(t.getBaseLocation())
                .build();
    }

    /** Haversine distance in km */
    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private record ScoredTeam(ResponseTeam team, double score) {}
}