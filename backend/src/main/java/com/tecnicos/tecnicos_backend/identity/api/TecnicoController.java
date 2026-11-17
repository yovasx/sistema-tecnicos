package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.TecnicoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Onboarding del técnico: registro público y los pasos del expediente.
 *
 * <p>Todo lo autenticado pertenece al usuario del token: no se puede tocar el
 * expediente de otro. Las reglas duras están en la base (V5); acá solo se
 * reciben los datos y se devuelven errores del contrato de la API.</p>
 */
@RestController
@RequestMapping("/api/tecnicos")
public class TecnicoController {

    private final TecnicoService tecnicos;

    public TecnicoController(TecnicoService tecnicos) {
        this.tecnicos = tecnicos;
    }

    @PostMapping("/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse registrar(@Valid @RequestBody TecnicoRegistroRequest request) {
        return tecnicos.registrarTecnico(request);
    }

    @PostMapping("/verificacion/email/solicitar")
    public OtpSolicitadoResponse solicitarOtp() {
        return tecnicos.solicitarOtp(usuarioActual());
    }

    @PostMapping("/verificacion/email/confirmar")
    public void confirmarOtp(@Valid @RequestBody CodigoRequest request) {
        tecnicos.confirmarOtp(usuarioActual(), request.codigo());
    }

    @PutMapping("/expediente/datos-personales")
    public void guardarDatosPersonales(@Valid @RequestBody DatosPersonalesRequest request) {
        tecnicos.guardarDatosPersonales(usuarioActual(), request.ci(), request.fechaNacimiento());
    }

    @PostMapping("/expediente/documentos")
    public void guardarDocumentos(
            @RequestParam("ci_frente") MultipartFile ciFrente,
            @RequestParam("ci_dorso") MultipartFile ciDorso,
            @RequestParam("certificaciones") MultipartFile[] certificaciones) throws IOException {
        tecnicos.guardarDocumentos(usuarioActual(), ciFrente, ciDorso, certificaciones);
    }

    @PutMapping("/expediente/especialidades")
    public void guardarEspecialidades(@Valid @RequestBody EspecialidadesRequest request) {
        tecnicos.guardarEspecialidades(usuarioActual(), request.categorias());
    }

    @PutMapping("/expediente/zonas")
    public void guardarZona(@Valid @RequestBody ZonaRequest request) {
        tecnicos.guardarZona(usuarioActual(), request.nombre(), request.lat(),
                request.lng(), request.radio());
    }

    @PostMapping("/expediente/enviar")
    public void enviar() {
        tecnicos.enviarExpediente(usuarioActual());
    }

    @PostMapping("/expediente/reenviar")
    public void reenviar(@Valid @RequestBody ReenviarRequest request) {
        tecnicos.reenviarExpediente(usuarioActual(), request);
    }

    @GetMapping("/expediente")
    public ExpedienteResponse expediente() {
        return tecnicos.expediente(usuarioActual());
    }

    @GetMapping("/expediente/documentos/{nombre}")
    public org.springframework.core.io.Resource documento(@PathVariable String nombre)
            throws IOException {
        var autenticado = usuarioAutenticado();
        java.io.InputStream contenido = tecnicos.descargarDocumento(
                autenticado.id(), autenticado.rol(), nombre);
        return new org.springframework.core.io.InputStreamResource(contenido);
    }

    private Long usuarioActual() {
        return usuarioAutenticado().id();
    }

    private com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado usuarioAutenticado() {
        return (com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado)
                org.springframework.security.core.context.SecurityContextHolder
                        .getContext().getAuthentication().getPrincipal();
    }
}
