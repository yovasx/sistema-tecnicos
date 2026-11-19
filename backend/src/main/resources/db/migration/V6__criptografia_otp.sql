-- Funciones de OTP V5 requieren pgcrypto (Postgres 16 solo incluye gen_random_uuid).
-- V5 ya está aplicada: no modificar su checksum.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
