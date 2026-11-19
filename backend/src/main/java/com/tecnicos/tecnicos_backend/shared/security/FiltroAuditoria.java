package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Publica el usuario del JWT en {@link AuditoriaContexto} antes de que corra el
 * controlador.
 *
 * <p>Los triggers de Postgres leen {@code app.usuario_id}, que se setea dentro
 * de la transacción con {@code AuditoriaContexto.aplicarEnTransaccion()}. Este
 * filtro solo deja el ID disponible en el hilo; la limpieza va en
 * {@code finally} porque un request de lectura no abre transacción y nunca
 * llegaría a la limpieza automática.</p>
 */
@Component
public class FiltroAuditoria extends OncePerRequestFilter {

    private final AuditoriaContexto auditoria;

    public FiltroAuditoria(AuditoriaContexto auditoria) {
        this.auditoria = auditoria;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
            if (autenticacion != null
                    && autenticacion.getPrincipal() instanceof UsuarioAutenticado usuario) {
                auditoria.definirUsuario(usuario.id());
            }
            chain.doFilter(request, response);
        } finally {
            auditoria.limpiar();
        }
    }
}
