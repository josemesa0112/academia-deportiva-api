-- ============================================================
-- Migración 004: Índices en columnas FK frecuentemente consultadas
-- PostgreSQL NO crea índices automáticos para FOREIGN KEYS (solo
-- para PK y UNIQUE). Esto acelera JOINs y filtros en producción
-- conforme la DB crezca.
--
-- Todos los CREATE INDEX usan IF NOT EXISTS — idempotente.
-- Se omiten los FKs que ya están cubiertos por índices previos:
--   - tbd_medicion.id_deportista (migración 001)
--   - tbd_deportista_x_posicion.id_deportista (migración 001)
--   - tbd_mensualidad.id_deportista (cubierto como prefijo del
--     UNIQUE INDEX uniq_mensualidad_deportista_periodo en mig. 002)
-- ============================================================

-- Personas: filtros por rol son muy frecuentes (sidebar, validaciones,
-- pendientes, etc.); lookup por correo se hace en cada login.
CREATE INDEX IF NOT EXISTS idx_persona_id_rol      ON tbd_persona (id_rol);
CREATE INDEX IF NOT EXISTS idx_persona_correo      ON tbd_persona (LOWER(correo));

-- Deportista
CREATE INDEX IF NOT EXISTS idx_deportista_id_persona   ON tbd_deportista (id_persona);
CREATE INDEX IF NOT EXISTS idx_deportista_id_categoria ON tbd_deportista (id_categoria);
CREATE INDEX IF NOT EXISTS idx_deportista_id_estado    ON tbd_deportista (id_estado);

-- Profesor y Proveedor
CREATE INDEX IF NOT EXISTS idx_profesor_id_persona  ON tbd_profesor (id_persona);
CREATE INDEX IF NOT EXISTS idx_proveedor_id_persona ON tbd_proveedor (id_persona);

-- Matrícula: el partial idx_matricula_pendientes (mig. 003) solo
-- cubre filas pendientes; agregamos uno completo para el perfil.
CREATE INDEX IF NOT EXISTS idx_matricula_id_deportista ON tbd_matricula (id_deportista);
CREATE INDEX IF NOT EXISTS idx_matricula_id_categoria  ON tbd_matricula (id_categoria);

-- Asistencia: consultas tanto por entrenamiento como por deportista.
CREATE INDEX IF NOT EXISTS idx_asistencia_id_deportista    ON tbd_asistencia (id_deportista);
CREATE INDEX IF NOT EXISTS idx_asistencia_id_entrenamiento ON tbd_asistencia (id_entrenamiento);

-- Entrenamiento: order by fecha DESC es el patrón frecuente.
CREATE INDEX IF NOT EXISTS idx_entrenamiento_id_cancha    ON tbd_entrenamiento (id_cancha);
CREATE INDEX IF NOT EXISTS idx_entrenamiento_id_categoria ON tbd_entrenamiento (id_categoria);
CREATE INDEX IF NOT EXISTS idx_entrenamiento_fecha_desc   ON tbd_entrenamiento (fecha DESC);

-- M:N: entrenamiento ↔ profesor
CREATE INDEX IF NOT EXISTS idx_exp_id_entrenamiento ON tbd_entrenamiento_x_profesor (id_entrenamiento);
CREATE INDEX IF NOT EXISTS idx_exp_id_profesor      ON tbd_entrenamiento_x_profesor (id_profesor);

-- Compra y M:N producto ↔ compra
CREATE INDEX IF NOT EXISTS idx_compra_id_proveedor ON tbd_compra (id_proveedor);
CREATE INDEX IF NOT EXISTS idx_pxc_id_compra       ON tbd_producto_x_compra (id_compra);
CREATE INDEX IF NOT EXISTS idx_pxc_id_producto     ON tbd_producto_x_compra (id_producto);

-- Producto
CREATE INDEX IF NOT EXISTS idx_producto_id_tipo     ON tbd_producto (id_tipo_producto);
CREATE INDEX IF NOT EXISTS idx_producto_id_variante ON tbd_producto (id_variante_producto);

-- Refresca estadísticas del planner para que use los nuevos índices.
ANALYZE;
