package com.commandCenter.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "alert_attachments")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AlertAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alert_id", nullable = false)
    @ToString.Exclude
    private com.commandCenter.backend.model.Alert alert;

    @Column(nullable = false)
    private String kind;        // image | document | video

    @Column(nullable = false)
    private String filename;    // original file name or URL

    @Column(name = "file_url")
    private String fileUrl;     // stored URL (e.g. S3 / local path)

    @Column(name = "mime_type")
    private String mimeType;    // image/jpeg, application/pdf, video/url, etc.

    @Column(name = "file_size")
    private Long fileSize;      // bytes

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}