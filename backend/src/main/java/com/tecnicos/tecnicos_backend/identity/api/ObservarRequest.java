package com.tecnicos.tecnicos_backend.identity.api;

import java.util.Map;

/** Cuerpo de "observar": clave = campo del expediente, valor = motivo. */
public record ObservarRequest(Map<String, String> observaciones) {
}
