package com.tecnicos.tecnicos_backend.admin.api;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Contratos sin credenciales, CI ni documentos privados. */
public final class UsuariosAdminDtos {
    private UsuariosAdminDtos() {}

    public record Fila(Long id, String nombre, String email, String telefono, String rol,
                       String tipoCliente, boolean activo, OffsetDateTime creadoEn) {}
    public record Pagina(List<Fila> elementos, long total, int pagina, int tamano) {}
    public record Detalle(Long id, String nombre, String apellido, String email, String telefono,
                          String rol, String tipoCliente, String razonSocial, String nit,
                          boolean activo, OffsetDateTime creadoEn, Long revision,
                          String acceso, String estadoValidacion) {}
    public record Cambio(Long id, String administrador, String accion, String motivo,
                         Map<String, Object> antes, Map<String, Object> despues, OffsetDateTime creadoEn) {}

    public record Editar(
            @NotNull @PositiveOrZero Long revision,
            @NotBlank @Size(min=2,max=100) String nombre,
            @NotBlank @Size(min=2,max=100) String apellido,
            @Size(max=20) String telefono,
            @Size(max=150) String razonSocial,
            @Size(max=20) String nit,
            @NotBlank @Size(min=5,max=500) String motivo) {}
    public record Estado(
            @NotNull @PositiveOrZero Long revision,
            @NotNull Boolean activo,
            @NotBlank @Size(min=5,max=500) String motivo) {}
    public record Invitacion(
            @NotBlank @Email @Size(max=150) String email,
            @NotBlank @Size(min=2,max=100) String nombre,
            @NotBlank @Size(min=2,max=100) String apellido,
            @Size(max=20) String telefono,
            @NotNull @Pattern(regexp="cliente|tecnico|administrador") String rol,
            @NotNull @Pattern(regexp="persona|empresa") String tipoCliente,
            @Size(max=150) String razonSocial,
            @Size(max=20) String nit,
            @NotBlank @Size(max=72) String passwordAdmin) {}
    public record AceptarInvitacion(
            @NotBlank @Email @Size(max=150) String email,
            @NotBlank @Pattern(regexp="[a-f0-9]{64}") String permiso,
            @NotBlank @Size(min=10,max=72) String password) {}
}
