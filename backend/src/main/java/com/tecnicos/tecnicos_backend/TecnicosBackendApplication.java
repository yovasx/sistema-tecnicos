package com.tecnicos.tecnicos_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

/**
 * La API usa JWT, no usuarios en memoria: se excluye la autoconfiguración que
 * genera una contraseña aleatoria y ensucia el log de arranque.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class TecnicosBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(TecnicosBackendApplication.class, args);
	}

}
