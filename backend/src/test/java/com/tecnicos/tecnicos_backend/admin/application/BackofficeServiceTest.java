package com.tecnicos.tecnicos_backend.admin.application;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.ZoneId;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class BackofficeServiceTest {
    @Autowired BackofficeService servicio;
    @Autowired JdbcTemplate jdbc;

    @Test void reporte_trata_como_texto_los_nombres_que_inician_con_formula() {
        long tecnico=jdbc.queryForObject(
            "SELECT id FROM identity.usuarios WHERE email='diego.vargas@ejemplo.bo'",Long.class);
        jdbc.update("UPDATE identity.usuarios SET nombre=?,apellido=? WHERE id=?", "\t=1+1","Vargas",tecnico);
        jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,descripcion_falla,
                ubicacion_cliente,direccion_referencia)
            VALUES((SELECT id FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'),?,
                (SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'),
                'Solicitud para probar CSV',ST_SetSRID(ST_MakePoint(-68.13,-16.51),4326)::geography,
                'Referencia de prueba')
            RETURNING id
            """,Long.class,tecnico);

        LocalDate hoy=LocalDate.now(ZoneId.of("America/La_Paz"));
        String csv=servicio.reporteOrdenes(hoy,hoy);

        assertThat(csv).contains("\"'\t=1+1 Vargas\"");
        assertThat(csv).doesNotContain("\"\t=1+1 Vargas\"");
    }
}
