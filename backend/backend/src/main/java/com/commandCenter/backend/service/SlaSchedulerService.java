package com.commandCenter.backend.service;

import com.commandCenter.backend.model.Alert;
import com.commandCenter.backend.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class SlaSchedulerService {

    private final AlertRepository alertRepository;
    private final AuditLogService auditLogService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 60_000)
    public void checkSlaBreaches() {
        LocalDateTime now = LocalDateTime.now();
        List<Alert> candidates = alertRepository.findAlertsRequiringSlaCheck();

        for (Alert alert : candidates) {
            if (alert.getSlaMinutes() == null || alert.getCreatedAt() == null) continue;
            long minutes = ChronoUnit.MINUTES.between(alert.getCreatedAt(), now);

            if (alert.getAcknowledgedAt() == null
                    && !Boolean.TRUE.equals(alert.getSlaBreached())
                    && minutes >= alert.getSlaMinutes()) {

                alert.setSlaBreached(true);
                alert.setEscalatedAt(now);
                alertRepository.save(alert);

                auditLogService.log("SLA_BREACHED", "ALERT", alert.getId().toString(),
                        alert.getTitle(), "SLA of " + alert.getSlaMinutes() + " min breached after " + minutes + " min");

                messagingTemplate.convertAndSend("/topic/escalations", alert);
                log.warn("[SLA BREACH] Alert {} '{}' breached {}min SLA",
                        alert.getId(), alert.getTitle(), alert.getSlaMinutes());
            }
        }
    }

    public void acknowledge(Alert alert) {
        if (alert.getAcknowledgedAt() != null) return;
        alert.setAcknowledgedAt(LocalDateTime.now());
        alertRepository.save(alert);
        auditLogService.log("ALERT_ACKNOWLEDGED", "ALERT", alert.getId().toString(),
                alert.getTitle(), "Acknowledged within SLA window");
        log.info("[SLA ACK] Alert {} acknowledged.", alert.getId());
    }
}