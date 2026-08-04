-- 015_auth_password.sql
-- Soporte para el ingreso con número de documento + contraseña.
--
-- Las contraseñas NO se guardan aquí: viven en Supabase Auth. Esta migración
-- solo agrega el estado que la aplicación necesita conocer (si la persona
-- todavía usa la contraseña por defecto) y la tabla de códigos de
-- verificación para restablecerla.
--
-- Idempotente: se puede re-ejecutar sin riesgo.

-- 1. Marca de "todavía usa la contraseña inicial (su documento)".
--    Arranca en TRUE para todos: nadie ha definido contraseña propia aún.
ALTER TABLE tbd_persona
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Códigos de verificación para restablecer la contraseña.
--    Se guarda solo el hash del código, nunca el código en claro.
CREATE TABLE IF NOT EXISTS tbd_codigo_verificacion (
  id            SERIAL PRIMARY KEY,
  id_persona    INTEGER NOT NULL REFERENCES tbd_persona(id) ON DELETE CASCADE,
  codigo_hash   TEXT NOT NULL,
  canal         VARCHAR(20) NOT NULL,          -- 'sms' | 'correo' | 'consola'
  destino       VARCHAR(120),                  -- a dónde se envió (enmascarado en la respuesta)
  expira_en     TIMESTAMPTZ NOT NULL,
  intentos      INTEGER NOT NULL DEFAULT 0,
  usado_en      TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codigo_verificacion_persona
  ON tbd_codigo_verificacion (id_persona, creado_en DESC);

-- 3. Aviso si hay correos duplicados. El correo es la identidad en Supabase
--    Auth, así que dos personas con el mismo correo compartirían la cuenta.
--    No se fuerza el UNIQUE aquí para no romper el despliegue: primero hay
--    que corregir los datos (ver el SELECT del final de este archivo).
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT lower(correo) FROM tbd_persona
    WHERE correo IS NOT NULL
    GROUP BY lower(correo) HAVING COUNT(*) > 1
  ) x;

  IF duplicados > 0 THEN
    RAISE NOTICE 'ATENCION: % correo(s) duplicado(s). Corregirlos y luego crear el indice unico.', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_persona_correo
      ON tbd_persona (lower(correo)) WHERE correo IS NOT NULL;
    RAISE NOTICE 'Indice unico de correo creado.';
  END IF;
END $$;

-- Para encontrar los duplicados que hay que corregir a mano:
--   SELECT lower(correo) AS correo, COUNT(*), array_agg(id) AS ids
--   FROM tbd_persona WHERE correo IS NOT NULL
--   GROUP BY lower(correo) HAVING COUNT(*) > 1;