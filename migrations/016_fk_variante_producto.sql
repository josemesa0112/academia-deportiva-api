-- 016_fk_variante_producto.sql
-- Corrige la llave foránea de la variante del producto.
--
-- tbd_producto.id_variante_producto apuntaba por error a tbd_tipo_producto,
-- que solo tiene ids 1..3. Como tbd_variante_producto tiene ids 1..11,
-- cualquier producto con talla o implemento (ids 4 en adelante) fallaba al
-- guardarse con una violación de FK y un 500 poco claro en la interfaz.
--
-- Idempotente: se puede re-ejecutar sin riesgo.

DO $$
BEGIN
  -- 1. Avisar si hay filas que la FK correcta no admitiría. No debería
  --    haberlas: la FK vieja era más restrictiva que la nueva.
  IF EXISTS (
    SELECT 1 FROM tbd_producto pr
     WHERE pr.id_variante_producto IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM tbd_variante_producto v WHERE v.id = pr.id_variante_producto)
  ) THEN
    RAISE EXCEPTION 'Hay productos con id_variante_producto inexistente en tbd_variante_producto. Corregirlos antes de aplicar esta migracion.';
  END IF;

  -- 2. Reemplazar la restricción por la que apunta a la tabla correcta.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tbd_producto_id_variante_producto_fkey'
       AND conrelid = 'tbd_producto'::regclass
  ) THEN
    ALTER TABLE tbd_producto DROP CONSTRAINT tbd_producto_id_variante_producto_fkey;
  END IF;

  ALTER TABLE tbd_producto
    ADD CONSTRAINT tbd_producto_id_variante_producto_fkey
    FOREIGN KEY (id_variante_producto) REFERENCES tbd_variante_producto(id);

  RAISE NOTICE 'FK de id_variante_producto ahora apunta a tbd_variante_producto.';
END $$;

-- 3. Una compra no debe repetir el mismo producto en dos líneas. Hasta ahora
--    solo lo impedía el formulario; la base lo permitía.
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT id_compra, id_producto FROM tbd_producto_x_compra
     GROUP BY id_compra, id_producto HAVING COUNT(*) > 1
  ) x;

  IF duplicados > 0 THEN
    RAISE NOTICE 'ATENCION: % combinacion(es) compra/producto duplicadas. No se crea el indice unico.', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_producto_x_compra
      ON tbd_producto_x_compra (id_compra, id_producto);
    RAISE NOTICE 'Indice unico (id_compra, id_producto) creado.';
  END IF;
END $$;