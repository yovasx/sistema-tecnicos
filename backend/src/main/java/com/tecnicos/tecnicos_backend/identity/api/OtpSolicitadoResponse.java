package com.tecnicos.tecnicos_backend.identity.api;

import java.util.List;

/**
 * Respuesta de pedir código OTP.
 *
 * @param mensaje  texto para la UI
 * @param codigoDev código plano, solo cuando {@code app.otp.dev-mode=true};
 *                 en producción es null y el código viaja por email
 */
public record OtpSolicitadoResponse(String mensaje, String codigoDev) {
}
