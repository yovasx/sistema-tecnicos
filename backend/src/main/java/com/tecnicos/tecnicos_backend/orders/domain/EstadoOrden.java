package com.tecnicos.tecnicos_backend.orders.domain;

/** Espejo de orders.estado_orden (valores en minúsculas). */
public enum EstadoOrden {
    solicitado,
    en_camino,
    en_diagnostico,
    en_reparacion,
    finalizado,
    cancelado
}
