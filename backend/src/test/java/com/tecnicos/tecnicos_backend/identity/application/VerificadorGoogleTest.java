package com.tecnicos.tecnicos_backend.identity.application;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import java.security.*;
import java.security.interfaces.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class VerificadorGoogleTest {
    static KeyPair claves;
    VerificadorGoogle verificador;
    @BeforeAll static void claves() throws Exception {
        var generador=KeyPairGenerator.getInstance("RSA"); generador.initialize(2048); claves=generador.generateKeyPair();
    }
    @BeforeEach void crear() {
        verificador=new VerificadorGoogle("web.apps.googleusercontent.com",
            NimbusJwtDecoder.withPublicKey((RSAPublicKey)claves.getPublic()).build());
    }
    JWTClaimsSet.Builder perfil() {
        return new JWTClaimsSet.Builder().subject("google-123").issuer("https://accounts.google.com")
            .audience("web.apps.googleusercontent.com").expirationTime(Date.from(Instant.now().plusSeconds(300)))
            .issueTime(new Date()).claim("email","ana@prueba.bo").claim("email_verified",true).claim("nonce","nonce");
    }
    String firmar(JWTClaimsSet.Builder p) throws Exception {
        var token=new SignedJWT(new JWSHeader(JWSAlgorithm.RS256),p.build());
        token.sign(new RSASSASigner((RSAPrivateKey)claves.getPrivate())); return token.serialize();
    }
    @Test void acepta_firma_correcta_audiencia_emisor_y_nonce() throws Exception {
        assertThat(verificador.verificar(firmar(perfil()),"nonce").getSubject()).isEqualTo("google-123");
    }
    @Test void rechaza_email_no_verificado() throws Exception { rechazar(perfil().claim("email_verified",false)); }
    @Test void rechaza_audiencia_ajena() throws Exception { rechazar(perfil().audience("otra")); }
    @Test void rechaza_emisor_ajeno() throws Exception { rechazar(perfil().issuer("https://malicioso.test")); }
    @Test void rechaza_token_expirado() throws Exception { rechazar(perfil().expirationTime(Date.from(Instant.now().minusSeconds(300)))); }
    @Test void rechaza_nonce_distinto() throws Exception { rechazar(perfil().claim("nonce","otro")); }
    @Test void rechaza_firma_ajena() throws Exception {
        var generador=KeyPairGenerator.getInstance("RSA");generador.initialize(2048);
        var otro=generador.generateKeyPair();
        var token=new SignedJWT(new JWSHeader(JWSAlgorithm.RS256),perfil().build());
        token.sign(new RSASSASigner((RSAPrivateKey)otro.getPrivate()));
        assertThatThrownBy(()->verificador.verificar(token.serialize(),"nonce")).hasMessageContaining("verificar");
    }
    @Test void configuracion_vacia_no_acepta_tokens() throws Exception {
        var vacio=new VerificadorGoogle("",NimbusJwtDecoder.withPublicKey((RSAPublicKey)claves.getPublic()).build());
        assertThatThrownBy(()->vacio.verificar(firmar(perfil()),"nonce")).hasMessageContaining("configurado");
    }
    void rechazar(JWTClaimsSet.Builder p) throws Exception {
        String token=firmar(p);
        assertThatThrownBy(()->verificador.verificar(token,"nonce")).hasMessageContaining("verificar");
    }
}
