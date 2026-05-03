package com.commandCenter.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "response_teams")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResponseTeam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String specialty;

    private String icon;

    @Column(name = "handles_types")
    private String handlesTypes;

    @Column(name = "handles_severities")
    private String handlesSeverities;

    @Column(name = "base_lat")
    private Double baseLat;

    @Column(name = "base_lng")
    private Double baseLng;

    @Column(name = "base_location")
    private String baseLocation;

    private Integer members;

    private String availability;

    @Column(name = "avg_speed_kmh")
    private Integer avgSpeedKmh;
}