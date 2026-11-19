package com.tecnicos.tecnicos_backend.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Seguridad de la API: stateless, con JWT como único mecanismo.
 *
 * <p>Todo lo que no esté permitido explícitamente exige un token válido. El
 * entry point se registra tanto a nivel global (petición sin token) como en el
 * resource server (token presente pero inválido), porque cada caso lo resuelve
 * un filtro distinto.</p>
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            CorsConfigurationSource corsConfigurationSource,
            ConversorJwt conversorJwt,
            FiltroAuditoria filtroAuditoria,
            AutenticacionEntryPoint autenticacionEntryPoint,
            AccesoDenegadoHandler accesoDenegadoHandler) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // El controlador de login llega en T2; la ruta se abre ya para no
                        // volver a tocar este archivo.
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/recuperacion/*", "/api/auth/google", "/api/auth/google/desafio").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/registro").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/invitaciones/aceptar").permitAll()
                        // Alta pública del técnico (nivel 0 del expediente).
                        .requestMatchers(HttpMethod.POST, "/api/tecnicos/registro").permitAll()
                        // Catálogo público: solo nombre, descripción y tarifas.
                        .requestMatchers(HttpMethod.GET, "/api/publico/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/ping").permitAll()
                        .requestMatchers("/error").permitAll()
                        // El backoffice solo lo abre el administrador.
                        .requestMatchers("/api/admin/**").hasRole("ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/tecnicos/expediente/documentos/*")
                            .hasAnyRole("TECNICO", "ADMINISTRADOR")
                        .requestMatchers("/api/tecnicos/**").hasRole("TECNICO")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(errores -> errores
                        .authenticationEntryPoint(autenticacionEntryPoint)
                        .accessDeniedHandler(accesoDenegadoHandler))
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(conversorJwt))
                        .authenticationEntryPoint(autenticacionEntryPoint)
                        .accessDeniedHandler(accesoDenegadoHandler))
                // Después de autorizar: ya hay autenticación y el usuario puede
                // publicarse en el contexto de auditoría.
                .addFilterAfter(filtroAuditoria, AuthorizationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${CORS_ALLOWED_ORIGINS:http://localhost:9081,http://127.0.0.1:9081}")
            String allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split("\\s*,\\s*")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
