-- ============================================================
-- Migración 001: Perfil del deportista
-- Crea tablas para historial físico y posiciones del deportista
-- ============================================================

-- Tabla de historial de mediciones físicas
CREATE TABLE IF NOT EXISTS tbd_medicion (
  id SERIAL PRIMARY KEY,
  id_deportista INT NOT NULL REFERENCES tbd_deportista(id) ON DELETE CASCADE,
  peso DECIMAL(5,2),
  estatura DECIMAL(4,2),
  imc DECIMAL(5,2),
  porcentaje_grasa DECIMAL(5,2),
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicion_deportista_fecha
  ON tbd_medicion (id_deportista, fecha DESC);

-- Tabla de relación M:N entre deportistas y posiciones
CREATE TABLE IF NOT EXISTS tbd_deportista_x_posicion (
  id SERIAL PRIMARY KEY,
  id_deportista INT NOT NULL REFERENCES tbd_deportista(id) ON DELETE CASCADE,
  id_posicion INT NOT NULL REFERENCES tbd_posicion(id),
  UNIQUE (id_deportista, id_posicion)
);

CREATE INDEX IF NOT EXISTS idx_dxp_deportista
  ON tbd_deportista_x_posicion (id_deportista);

-- ============================================================
-- Siembra inicial: una medición por cada deportista existente
-- usando sus valores actuales. Solo si aún no tiene mediciones.
-- ============================================================
INSERT INTO tbd_medicion (id_deportista, peso, estatura, imc, porcentaje_grasa, fecha)
SELECT
  d.id,
  d.peso_actual,
  d.estatura_actual,
  d.IMC_actual,
  d.porcentaje_grasa_actual,
  NOW()
FROM tbd_deportista d
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_medicion m WHERE m.id_deportista = d.id
);
