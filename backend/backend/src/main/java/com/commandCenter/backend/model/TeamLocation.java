package com.commandCenter.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "team_locations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "team_id", nullable = false)
    private UUID teamId;

    @Column(name = "team_name")
    private String teamName;

    @Column(nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    private String status;

    @Column(name = "heading_degrees")
    private Integer headingDegrees;

    @Column(name = "speed_kmh")
    private Double speedKmh;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        recordedAt = LocalDateTime.now();
    }
}