package com.commandCenter.backend.controller;

import com.commandCenter.backend.model.Alert;
import com.commandCenter.backend.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/escalations")
@RequiredArgsConstructor
public class EscalationController {

    private final AlertRepository alertRepository;

    @GetMapping
    public ResponseEntity<List<Alert>> getBreached() {
        return ResponseEntity.ok(alertRepository.findBySlaBreachedTrue());
    }
}