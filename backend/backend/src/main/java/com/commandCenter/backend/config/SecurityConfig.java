package com.commandCenter.backend.config;

import com.commandCenter.backend.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth

                        // ── Public ──────────────────────────────────────────
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()

                        // ── Users: SUPER_ADMIN only ──────────────────────────
                        .requestMatchers("/api/users/**").hasRole("SUPER_ADMIN")

                        // ── Alerts: ADMIN + SUPER_ADMIN ──────────────────────
                        .requestMatchers("/api/alerts/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // ── Assignments, Audit, Escalations ──────────────────
                        .requestMatchers("/api/assignments/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/audit/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/escalations/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // ── Teams: all roles can READ, only ADMIN+ can write ──
                        .requestMatchers(HttpMethod.GET, "/api/teams/**").hasAnyRole("TEAM", "ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/teams/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/teams/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/teams/**").hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // ── Tracking: TEAM + ADMIN + SUPER_ADMIN ─────────────
                        .requestMatchers("/api/tracking/**").hasAnyRole("TEAM", "ADMIN", "SUPER_ADMIN")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "https://frontline-command-center-prod.up.railway.app"
        ));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}