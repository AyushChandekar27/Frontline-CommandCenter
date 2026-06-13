package com.commandCenter.backend.config;

import com.commandCenter.backend.model.User;
import com.commandCenter.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements ApplicationRunner {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) return;  // already seeded

        userRepository.save(User.builder()
                .username("superadmin")
                .password(passwordEncoder.encode("superadmin123"))
                .role(User.Role.SUPER_ADMIN)
                .build());

        userRepository.save(User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(User.Role.ADMIN)
                .build());

        userRepository.save(User.builder()
                .username("team1")
                .password(passwordEncoder.encode("team123"))
                .role(User.Role.TEAM)
                .build());

        userRepository.save(User.builder()
                .username("team2")
                .password(passwordEncoder.encode("team123"))
                .role(User.Role.TEAM)
                .build());

        log.info("[DataSeeder] Default users created: superadmin / admin / team1");
    }
}