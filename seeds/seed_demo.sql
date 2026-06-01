-- ============================================================
-- SEED DEMO — Academia Estrellas del Milenio (fútbol)
--
-- Genera datos completos para sustentar el proyecto:
--   - 5 profesores
--   - 200 deportistas (40 por categoría: Sub 6, 8, 10, 12, 14)
--   - 10 proveedores con 2-5 productos cada uno
--   - 30 productos deportivos con historial de precio inicial
--   - 40 compras combinadas en los últimos 6 meses
--   - 1 matrícula por deportista (80% pagadas, 20% pendientes)
--   - 1 mensualidad del mes actual por deportista (60% pagadas)
--   - 1 medición física inicial por deportista
--   - 1-3 posiciones por deportista
--
-- Reset total: limpia tablas transaccionales antes de sembrar.
--   Se preservan: catálogos, canchas, y el usuario administrador.
--
-- Todo en una transacción. Si algo falla, ROLLBACK.
-- ============================================================

BEGIN;

-- ============================================================
-- FASE 1: RESET
-- Borra explícitamente las tablas hija/join antes que las padre.
-- Algunas FKs no tienen CASCADE por el lado del producto (ej.
-- tbd_proveedor_x_producto.id_producto), así que lo hacemos manual.
-- ============================================================

-- Tablas hija / join (deben borrarse primero)
DELETE FROM tbd_producto_x_compra;
DELETE FROM tbd_proveedor_x_producto;
DELETE FROM tbd_precio_producto_historico;
DELETE FROM tbd_asistencia;
DELETE FROM tbd_entrenamiento_x_profesor;
DELETE FROM tbd_deportista_x_posicion;
DELETE FROM tbd_medicion;
DELETE FROM tbd_mensualidad;
DELETE FROM tbd_matricula;

-- Tablas principales transaccionales
DELETE FROM tbd_compra;
DELETE FROM tbd_entrenamiento;
DELETE FROM tbd_producto;
DELETE FROM tbd_deportista;
DELETE FROM tbd_proveedores;
DELETE FROM tbd_profesor;

-- Personas no-admin (se preserva el usuario administrador)
DELETE FROM tbd_persona
WHERE id_rol IN (
  SELECT id FROM tbd_rol
  WHERE LOWER(nombre_rol) IN ('profesor', 'deportista', 'proveedor')
);

-- ============================================================
-- FASE 2: CATÁLOGOS COMPLEMENTARIOS (idempotente)
-- Solo inserta si faltan. Posiciones de fútbol, tipos y variantes
-- de producto necesarios para los inserts posteriores.
-- ============================================================

INSERT INTO tbd_posicion (nombre)
SELECT v.nombre FROM (VALUES
  ('Portero'),
  ('Defensa Central'),
  ('Lateral Derecho'),
  ('Lateral Izquierdo'),
  ('Mediocampista Defensivo'),
  ('Mediocampista Central'),
  ('Mediocampista Ofensivo'),
  ('Extremo Derecho'),
  ('Extremo Izquierdo'),
  ('Delantero Centro')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_posicion p WHERE LOWER(TRIM(p.nombre)) = LOWER(v.nombre)
);

INSERT INTO tbd_tipo_producto (nombre)
SELECT v.nombre FROM (VALUES
  ('Balones'),
  ('Calzado'),
  ('Indumentaria'),
  ('Entrenamiento'),
  ('Protección'),
  ('Accesorios')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_tipo_producto p WHERE LOWER(TRIM(p.nombre)) = LOWER(v.nombre)
);

INSERT INTO tbd_variante_producto (nombre)
SELECT v.nombre FROM (VALUES
  ('Pequeño'),
  ('Mediano'),
  ('Grande'),
  ('Único')
) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM tbd_variante_producto p WHERE LOWER(TRIM(p.nombre)) = LOWER(v.nombre)
);

-- Géneros y tipos de documento (por si la DB está sin ellos)
INSERT INTO tbd_genero (nombre_genero)
SELECT v.n FROM (VALUES ('Masculino'), ('Femenino')) AS v(n)
WHERE NOT EXISTS (SELECT 1 FROM tbd_genero g WHERE LOWER(g.nombre_genero) = LOWER(v.n));

-- Abreviaturas cortas porque tbd_tipo_documento.nombre es VARCHAR(10).
-- Si la DB ya tiene otras variantes (CC, C.C., Cédula...), no se duplican.
INSERT INTO tbd_tipo_documento (nombre)
SELECT v.n FROM (VALUES ('CC'), ('TI'), ('CE')) AS v(n)
WHERE NOT EXISTS (SELECT 1 FROM tbd_tipo_documento t WHERE LOWER(TRIM(t.nombre)) = LOWER(v.n));

-- ============================================================
-- FASE 3: PRODUCTOS + HISTORIAL DE PRECIO INICIAL
-- 30 productos de fútbol con precios coherentes.
-- ============================================================
WITH productos_data(nombre, tipo, variante, precio) AS (
  VALUES
    -- Balones (5)
    ('Balón fútbol profesional Nike Premier League',   'Balones',       'Único',   180000),
    ('Balón fútbol profesional Adidas Champions',      'Balones',       'Único',   175000),
    ('Balón entrenamiento Mikasa',                     'Balones',       'Único',    65000),
    ('Balón fútbol juvenil Wilson',                    'Balones',       'Mediano',  45000),
    ('Balón fútbol infantil colores',                  'Balones',       'Pequeño',  30000),
    -- Calzado (5)
    ('Guayos Nike Mercurial adulto',                   'Calzado',       'Grande',  280000),
    ('Guayos Adidas Predator entrenamiento',           'Calzado',       'Grande',  220000),
    ('Guayos Puma juvenil',                            'Calzado',       'Mediano', 160000),
    ('Guayos infantiles antideslizantes',              'Calzado',       'Pequeño', 110000),
    ('Tenis de portería con guantes integrados',       'Calzado',       'Grande',  240000),
    -- Indumentaria (5)
    ('Uniforme oficial completo (camiseta+pantaloneta)','Indumentaria', 'Grande',  140000),
    ('Camiseta entrenamiento dry-fit',                 'Indumentaria', 'Mediano',  55000),
    ('Pantaloneta deportiva oficial',                  'Indumentaria', 'Mediano',  45000),
    ('Medias largas profesionales (par)',              'Indumentaria', 'Único',    22000),
    ('Buzo de calentamiento juvenil',                  'Indumentaria', 'Mediano', 120000),
    -- Entrenamiento (8)
    ('Set de 10 conos plásticos 23cm',                 'Entrenamiento', 'Único',    38000),
    ('Set de 20 platillos marcadores',                 'Entrenamiento', 'Único',    32000),
    ('Estacas de coordinación (8 unidades)',           'Entrenamiento', 'Único',    65000),
    ('Escalera de coordinación 4 metros',              'Entrenamiento', 'Único',    75000),
    ('Arco portátil plegable 1.5x1m',                  'Entrenamiento', 'Grande',  185000),
    ('Mallas para arco (par)',                         'Entrenamiento', 'Grande',  110000),
    ('Petos reversibles set de 11',                    'Entrenamiento', 'Mediano', 140000),
    ('Cronómetro digital profesional',                 'Entrenamiento', 'Único',    55000),
    -- Protección (4)
    ('Espinilleras adulto con tobillera',              'Protección',   'Grande',   40000),
    ('Espinilleras juveniles',                         'Protección',   'Mediano',  30000),
    ('Espinilleras infantiles',                        'Protección',   'Pequeño',  22000),
    ('Rodilleras de portero',                          'Protección',   'Único',    48000),
    -- Accesorios (3)
    ('Maletín deportivo grande',                       'Accesorios',   'Grande',   75000),
    ('Botella deportiva 1L con boquilla',              'Accesorios',   'Único',    18000),
    ('Bombín inflador con manómetro',                  'Accesorios',   'Único',    42000)
)
INSERT INTO tbd_producto (nombre_producto, id_tipo_producto, id_variante_producto, precio_producto)
SELECT
  pd.nombre,
  tp.id,
  vp.id,
  pd.precio
FROM productos_data pd
JOIN tbd_tipo_producto tp ON LOWER(TRIM(tp.nombre)) = LOWER(pd.tipo)
JOIN tbd_variante_producto vp ON LOWER(TRIM(vp.nombre)) = LOWER(pd.variante);

-- Historial: precio inicial con fecha de hoy
INSERT INTO tbd_precio_producto_historico (id_producto, precio, fecha)
SELECT id, precio_producto, NOW() FROM tbd_producto;

-- ============================================================
-- FASE 4: PERSONAS + ROLES DERIVADOS + RELACIONES
-- Un solo bloque DO con loops procedurales para mantener IDs.
-- ============================================================
DO $$
DECLARE
  -- Catálogos
  v_rol_profesor   INT;
  v_rol_deportista INT;
  v_rol_proveedor  INT;
  v_estado_activo  INT;
  v_estado_inactivo INT;
  v_genero_m       INT;
  v_genero_f       INT;
  v_tipo_cc        INT;
  v_tipo_ti        INT;
  v_clasif_bajo    INT;
  v_clasif_saludable INT;
  v_clasif_sobrepeso INT;

  -- Categorías
  v_categorias_ids INT[];
  v_categorias_edad INT[];

  -- Valores de matrícula/mensualidad por categoría (ordenados Sub 6 → Sub 14)
  v_valores_matricula INT[]   := ARRAY[150000, 170000, 200000, 220000, 250000];
  v_valores_mensualidad INT[] := ARRAY[100000, 120000, 140000, 160000, 180000];

  -- Pools de nombres (combinables para 215 personas únicas)
  v_nombres_m TEXT[] := ARRAY[
    'Juan','Carlos','Andrés','José','Luis','Pedro','Miguel','Diego','Fernando','Ricardo',
    'Alejandro','Daniel','Santiago','Sebastián','Felipe','Camilo','David','Mateo','Tomás','Nicolás',
    'Emilio','Esteban','Julián','Hugo','Sergio','Iván','Pablo','Eduardo','Joaquín','Mauricio'
  ];
  v_nombres_f TEXT[] := ARRAY[
    'María','Ana','Sofía','Valentina','Camila','Isabella','Mariana','Laura','Daniela','Catalina',
    'Lucía','Paula','Sara','Juliana','Manuela','Gabriela','Andrea','Carolina','Natalia','Diana',
    'Carmen','Patricia','Elena','Adriana','Beatriz','Cristina','Verónica','Mónica','Pilar','Rosa'
  ];
  v_apellidos TEXT[] := ARRAY[
    'García','Rodríguez','Martínez','Hernández','López','González','Pérez','Sánchez','Ramírez','Torres',
    'Flores','Rivera','Gómez','Díaz','Reyes','Cruz','Morales','Ortiz','Castro','Vargas',
    'Romero','Suárez','Mendoza','Salazar','Núñez','Restrepo','Cardona','Ospina','Henao','Quintero',
    'Gutiérrez','Velásquez','Echeverri','Marín','Jaramillo','Arango','Mejía','Bedoya','Zapata','Patiño'
  ];

  -- Variables de iteración
  i               INT;
  v_persona_id    INT;
  v_profesor_id   INT;
  v_deportista_id INT;
  v_proveedor_id  INT;
  v_compra_id     INT;
  v_doc           BIGINT := 1100000000;

  v_nombre        TEXT;
  v_apellido      TEXT;
  v_correo        TEXT;
  v_genero        INT;
  v_fecha_nac     DATE;
  v_telefono      TEXT;

  -- Para deportistas
  v_cat_idx       INT;       -- 1..5 (índice en arrays)
  v_cat_id        INT;
  v_edad_target   INT;
  v_peso          NUMERIC(5,2);
  v_estatura      NUMERIC(4,2);
  v_imc           NUMERIC(5,2);
  v_grasa         NUMERIC(5,2);
  v_clasif_id     INT;
  v_valor_mens    INT;
  v_valor_matr    INT;
  v_fecha_matr    DATE;
  v_matr_pagada   BOOLEAN;
  v_mens_pagada   BOOLEAN;

  -- Para asignación posiciones
  v_num_pos       INT;
  v_pos_ids       INT[];
  v_pos_id        INT;
  j               INT;

  -- Para compras
  v_num_compras   INT := 40;
  v_provs_con_prod INT[];   -- array de proveedores que sí tienen productos
  v_prods_del_prov INT[];   -- productos del proveedor en curso
  v_num_lineas    INT;
  v_prod_id       INT;
  v_cant          INT;
  v_precio_unit   NUMERIC;
  v_total_compra  NUMERIC;
  v_fecha_compra  DATE;
  v_productos_usados INT[]; -- para evitar duplicados en una misma compra
  v_intentos      INT;

  -- Para mensualidad del mes actual
  v_mes_actual    INT := EXTRACT(MONTH FROM CURRENT_DATE);
  v_año_actual    INT := EXTRACT(YEAR FROM CURRENT_DATE);

BEGIN
  -- ----------------------------------------------------------
  -- Lookups
  -- ----------------------------------------------------------
  SELECT id INTO v_rol_profesor   FROM tbd_rol WHERE LOWER(nombre_rol) = 'profesor';
  SELECT id INTO v_rol_deportista FROM tbd_rol WHERE LOWER(nombre_rol) = 'deportista';
  SELECT id INTO v_rol_proveedor  FROM tbd_rol WHERE LOWER(nombre_rol) = 'proveedor';
  SELECT id INTO v_estado_activo   FROM tbd_estado WHERE LOWER(nombre) = 'activo';
  SELECT id INTO v_estado_inactivo FROM tbd_estado WHERE LOWER(nombre) = 'inactivo';

  SELECT id INTO v_genero_m FROM tbd_genero WHERE LOWER(nombre_genero) IN ('masculino','m','hombre') LIMIT 1;
  SELECT id INTO v_genero_f FROM tbd_genero WHERE LOWER(nombre_genero) IN ('femenino','f','mujer') LIMIT 1;

  -- Lookup tolerante: acepta cualquier variante razonable de CC y TI
  -- (CC, C.C., Cédula, Cedula, cédula de ciudadanía...).
  SELECT id INTO v_tipo_cc FROM tbd_tipo_documento
    WHERE LOWER(TRIM(nombre)) IN ('cc', 'c.c.', 'c.c')
       OR LOWER(nombre) LIKE 'cédula%'
       OR LOWER(nombre) LIKE 'cedula%'
    LIMIT 1;
  SELECT id INTO v_tipo_ti FROM tbd_tipo_documento
    WHERE LOWER(TRIM(nombre)) IN ('ti', 't.i.', 't.i')
       OR LOWER(nombre) LIKE 'tarjeta%'
    LIMIT 1;

  -- Si TI no existe, usa CC para todos
  IF v_tipo_ti IS NULL THEN v_tipo_ti := v_tipo_cc; END IF;
  -- Y al revés: si CC no existe (caso muy raro), usa lo primero disponible.
  IF v_tipo_cc IS NULL THEN
    SELECT id INTO v_tipo_cc FROM tbd_tipo_documento ORDER BY id LIMIT 1;
    IF v_tipo_ti IS NULL THEN v_tipo_ti := v_tipo_cc; END IF;
  END IF;

  SELECT id INTO v_clasif_bajo       FROM tbd_clasificacion WHERE LOWER(TRIM(nombre)) = 'bajo en grasa';
  SELECT id INTO v_clasif_saludable  FROM tbd_clasificacion WHERE LOWER(TRIM(nombre)) = 'saludable';
  SELECT id INTO v_clasif_sobrepeso  FROM tbd_clasificacion WHERE LOWER(TRIM(nombre)) = 'sobrepeso';

  -- Categorías Sub 6, 8, 10, 12, 14 ordenadas por edad ascendente
  SELECT ARRAY(
    SELECT id FROM tbd_categoria
    WHERE LOWER(TRIM(nombre)) IN ('sub 6','sub 8','sub 10','sub 12','sub 14')
    ORDER BY CASE LOWER(TRIM(nombre))
      WHEN 'sub 6'  THEN 1
      WHEN 'sub 8'  THEN 2
      WHEN 'sub 10' THEN 3
      WHEN 'sub 12' THEN 4
      WHEN 'sub 14' THEN 5
    END
  ) INTO v_categorias_ids;
  v_categorias_edad := ARRAY[6, 8, 10, 12, 14];

  -- ----------------------------------------------------------
  -- 5 PROFESORES
  -- ----------------------------------------------------------
  FOR i IN 1..5 LOOP
    v_genero    := CASE WHEN i % 2 = 0 THEN v_genero_f ELSE v_genero_m END;
    v_nombre    := CASE WHEN v_genero = v_genero_m
                        THEN v_nombres_m[((i - 1) % array_length(v_nombres_m, 1)) + 1]
                        ELSE v_nombres_f[((i - 1) % array_length(v_nombres_f, 1)) + 1] END;
    v_apellido  := v_apellidos[((i - 1) % array_length(v_apellidos, 1)) + 1];
    v_doc       := v_doc + 1;
    v_correo    := LOWER(v_nombre || '.' || v_apellido || '.prof' || i || '@academia.demo');
    v_telefono  := '3' || LPAD((floor(random() * 1000000000)::BIGINT)::TEXT, 9, '0');
    v_fecha_nac := (CURRENT_DATE - (INTERVAL '1 year' * (25 + floor(random() * 25)::INT)))::DATE;

    INSERT INTO tbd_persona
      (nombre, apellido, fecha_nacimiento, correo, numero_telefono, numero_documento,
       id_genero, id_tipo_documento, id_rol, id_estado)
    VALUES
      (v_nombre, v_apellido, v_fecha_nac, v_correo, v_telefono, v_doc::TEXT,
       v_genero, v_tipo_cc, v_rol_profesor, v_estado_activo)
    RETURNING id INTO v_persona_id;

    INSERT INTO tbd_profesor (id_persona, salario, id_estado)
    VALUES (v_persona_id, 1500000 + floor(random() * 1500000)::INT, v_estado_activo);
  END LOOP;

  -- ----------------------------------------------------------
  -- 10 PROVEEDORES
  -- ----------------------------------------------------------
  FOR i IN 1..10 LOOP
    v_genero    := CASE WHEN i % 2 = 0 THEN v_genero_f ELSE v_genero_m END;
    v_nombre    := CASE WHEN v_genero = v_genero_m
                        THEN v_nombres_m[((i + 4) % array_length(v_nombres_m, 1)) + 1]
                        ELSE v_nombres_f[((i + 4) % array_length(v_nombres_f, 1)) + 1] END;
    v_apellido  := v_apellidos[((i + 4) % array_length(v_apellidos, 1)) + 1];
    v_doc       := v_doc + 1;
    v_correo    := LOWER(v_nombre || '.' || v_apellido || '.prov' || i || '@academia.demo');
    v_telefono  := '3' || LPAD((floor(random() * 1000000000)::BIGINT)::TEXT, 9, '0');
    v_fecha_nac := (CURRENT_DATE - (INTERVAL '1 year' * (30 + floor(random() * 30)::INT)))::DATE;

    INSERT INTO tbd_persona
      (nombre, apellido, fecha_nacimiento, correo, numero_telefono, numero_documento,
       id_genero, id_tipo_documento, id_rol, id_estado)
    VALUES
      (v_nombre, v_apellido, v_fecha_nac, v_correo, v_telefono, v_doc::TEXT,
       v_genero, v_tipo_cc, v_rol_proveedor, v_estado_activo)
    RETURNING id INTO v_persona_id;

    INSERT INTO tbd_proveedores (id_persona, id_estado)
    VALUES (v_persona_id, v_estado_activo)
    RETURNING id INTO v_proveedor_id;

    -- Asigna 2-5 productos aleatorios al proveedor (sin duplicados)
    INSERT INTO tbd_proveedor_x_producto (id_proveedor, id_producto)
    SELECT v_proveedor_id, p.id
    FROM (
      SELECT id FROM tbd_producto ORDER BY random() LIMIT (2 + floor(random() * 4)::INT)
    ) p
    ON CONFLICT (id_proveedor, id_producto) DO NOTHING;
  END LOOP;

  -- ----------------------------------------------------------
  -- 200 DEPORTISTAS (40 por categoría)
  -- ----------------------------------------------------------
  FOR i IN 1..200 LOOP
    -- Distribución equitativa: 40 por categoría
    v_cat_idx := ((i - 1) / 40) + 1;   -- 1..5
    v_cat_id := v_categorias_ids[v_cat_idx];
    v_edad_target := v_categorias_edad[v_cat_idx];

    v_genero    := CASE WHEN i % 2 = 0 THEN v_genero_f ELSE v_genero_m END;
    v_nombre    := CASE WHEN v_genero = v_genero_m
                        THEN v_nombres_m[((i * 7 + 11) % array_length(v_nombres_m, 1)) + 1]
                        ELSE v_nombres_f[((i * 7 + 11) % array_length(v_nombres_f, 1)) + 1] END;
    v_apellido  := v_apellidos[((i * 3 + 5) % array_length(v_apellidos, 1)) + 1];
    v_doc       := v_doc + 1;
    v_correo    := LOWER(v_nombre || '.' || v_apellido || '.dep' || i || '@academia.demo');
    v_telefono  := '3' || LPAD((floor(random() * 1000000000)::BIGINT)::TEXT, 9, '0');

    -- Edad coherente con la categoría (±1 año)
    v_fecha_nac := (CURRENT_DATE
      - (INTERVAL '1 year' * v_edad_target)
      - (INTERVAL '1 day' * floor(random() * 365)::INT))::DATE;

    INSERT INTO tbd_persona
      (nombre, apellido, fecha_nacimiento, correo, numero_telefono, numero_documento,
       id_genero, id_tipo_documento, id_rol, id_estado)
    VALUES
      (v_nombre, v_apellido, v_fecha_nac, v_correo, v_telefono, v_doc::TEXT,
       v_genero, v_tipo_ti, v_rol_deportista, v_estado_activo)
    RETURNING id INTO v_persona_id;

    -- Peso y estatura realistas por edad, con variación para diversidad de IMC
    -- (peso_base ± 30% para generar mezcla de Bajo/Saludable/Sobrepeso)
    CASE v_edad_target
      WHEN 6  THEN v_estatura := 1.15 + (random() * 0.10 - 0.05);  -- 1.10-1.20
                   v_peso     := 21 + (random() * 12 - 4);          -- 17-33
      WHEN 8  THEN v_estatura := 1.27 + (random() * 0.10 - 0.05);  -- 1.22-1.32
                   v_peso     := 28 + (random() * 14 - 4);          -- 24-42
      WHEN 10 THEN v_estatura := 1.39 + (random() * 0.12 - 0.06);
                   v_peso     := 36 + (random() * 18 - 6);
      WHEN 12 THEN v_estatura := 1.52 + (random() * 0.14 - 0.07);
                   v_peso     := 46 + (random() * 22 - 8);
      WHEN 14 THEN v_estatura := 1.62 + (random() * 0.16 - 0.08);
                   v_peso     := 56 + (random() * 24 - 10);
    END CASE;

    v_imc := ROUND((v_peso / (v_estatura * v_estatura))::NUMERIC, 2);
    v_grasa := ROUND((10 + random() * 18)::NUMERIC, 1);  -- 10-28%

    -- Clasificación OMS según IMC (misma lógica que usa el backend)
    IF v_imc < 18.5 THEN
      v_clasif_id := v_clasif_bajo;
    ELSIF v_imc < 25 THEN
      v_clasif_id := v_clasif_saludable;
    ELSE
      v_clasif_id := v_clasif_sobrepeso;
    END IF;

    v_valor_mens := v_valores_mensualidad[v_cat_idx];
    v_valor_matr := v_valores_matricula[v_cat_idx];

    INSERT INTO tbd_deportista
      (id_persona, peso_actual, estatura_actual, IMC_actual, porcentaje_grasa_actual,
       valor_mensualidad, id_clasificacion, id_categoria, id_estado)
    VALUES
      (v_persona_id, ROUND(v_peso::NUMERIC, 2), ROUND(v_estatura::NUMERIC, 2), v_imc, v_grasa,
       v_valor_mens, v_clasif_id, v_cat_id, v_estado_activo)
    RETURNING id INTO v_deportista_id;

    -- Medición inicial (la fecha del seed)
    INSERT INTO tbd_medicion (id_deportista, peso, estatura, imc, porcentaje_grasa, fecha)
    VALUES (v_deportista_id, ROUND(v_peso::NUMERIC, 2), ROUND(v_estatura::NUMERIC, 2),
            v_imc, v_grasa, NOW());

    -- Posiciones aleatorias (1-3 por deportista)
    v_num_pos := 1 + floor(random() * 3)::INT;
    SELECT ARRAY(SELECT id FROM tbd_posicion ORDER BY random() LIMIT v_num_pos)
      INTO v_pos_ids;
    FOREACH v_pos_id IN ARRAY v_pos_ids LOOP
      INSERT INTO tbd_deportista_x_posicion (id_deportista, id_posicion)
      VALUES (v_deportista_id, v_pos_id)
      ON CONFLICT (id_deportista, id_posicion) DO NOTHING;
    END LOOP;

    -- Matrícula: fecha en los últimos 6 meses, 80% pagadas
    v_fecha_matr := (CURRENT_DATE - (INTERVAL '1 day' * floor(random() * 180)::INT))::DATE;
    v_matr_pagada := random() < 0.80;

    INSERT INTO tbd_matricula
      (id_deportista, fecha_inicio, valor, id_categoria, id_estado, fecha_pago)
    VALUES
      (v_deportista_id, v_fecha_matr, v_valor_matr, v_cat_id, v_estado_activo,
       CASE WHEN v_matr_pagada THEN (v_fecha_matr + (INTERVAL '1 day' * floor(random() * 10)::INT)) ELSE NULL END);

    -- Mensualidad del mes actual: 60% pagadas
    v_mens_pagada := random() < 0.60;
    INSERT INTO tbd_mensualidad
      (id_deportista, mes, año, valor, id_estado, fecha_pago)
    VALUES
      (v_deportista_id, v_mes_actual, v_año_actual, v_valor_mens, v_estado_activo,
       CASE WHEN v_mens_pagada THEN (CURRENT_DATE - (INTERVAL '1 day' * floor(random() * 5)::INT)) ELSE NULL END);
  END LOOP;

  -- ----------------------------------------------------------
  -- 40 COMPRAS COMBINADAS
  -- Cada una con 1-5 líneas. Productos respetan el catálogo del proveedor.
  -- Fechas distribuidas en los últimos 6 meses.
  -- ----------------------------------------------------------
  SELECT ARRAY(
    SELECT DISTINCT pv.id
    FROM tbd_proveedores pv
    JOIN tbd_proveedor_x_producto pxp ON pxp.id_proveedor = pv.id
  ) INTO v_provs_con_prod;

  IF array_length(v_provs_con_prod, 1) IS NULL THEN
    RAISE NOTICE 'No hay proveedores con productos asignados; se omiten las compras.';
  ELSE
    FOR i IN 1..v_num_compras LOOP
      -- Proveedor al azar
      v_proveedor_id := v_provs_con_prod[floor(random() * array_length(v_provs_con_prod, 1))::INT + 1];

      -- Productos disponibles para ese proveedor
      SELECT ARRAY(SELECT id_producto FROM tbd_proveedor_x_producto WHERE id_proveedor = v_proveedor_id)
        INTO v_prods_del_prov;

      v_fecha_compra := (CURRENT_DATE - (INTERVAL '1 day' * floor(random() * 180)::INT))::DATE;
      v_total_compra := 0;

      INSERT INTO tbd_compra (id_proveedor, total_compra, fecha_compra, id_estado)
      VALUES (v_proveedor_id, 0, v_fecha_compra, v_estado_activo)
      RETURNING id INTO v_compra_id;

      -- Líneas (1-5, no exceder el catálogo del proveedor)
      v_num_lineas := LEAST(1 + floor(random() * 5)::INT, array_length(v_prods_del_prov, 1));
      v_productos_usados := ARRAY[]::INT[];
      v_intentos := 0;

      WHILE array_length(v_productos_usados, 1) IS DISTINCT FROM v_num_lineas AND v_intentos < 30 LOOP
        v_intentos := v_intentos + 1;
        v_prod_id := v_prods_del_prov[floor(random() * array_length(v_prods_del_prov, 1))::INT + 1];

        -- Sin duplicados de producto en una misma compra
        IF v_prod_id = ANY(v_productos_usados) THEN
          CONTINUE;
        END IF;

        SELECT precio_producto INTO v_precio_unit FROM tbd_producto WHERE id = v_prod_id;
        v_cant := 1 + floor(random() * 20)::INT;  -- 1-20 unidades

        INSERT INTO tbd_producto_x_compra (id_producto, id_compra, cantidad_productos, precio)
        VALUES (v_prod_id, v_compra_id, v_cant, v_precio_unit);

        v_total_compra := v_total_compra + (v_cant * v_precio_unit);
        v_productos_usados := array_append(v_productos_usados, v_prod_id);
      END LOOP;

      -- Actualiza total_compra con la suma real (BIGINT para evitar decimales
      -- que pudieran exceder un VARCHAR pequeño en la columna).
      UPDATE tbd_compra SET total_compra = v_total_compra::BIGINT WHERE id = v_compra_id;
    END LOOP;
  END IF;

  -- ----------------------------------------------------------
  -- Resumen final
  -- ----------------------------------------------------------
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE 'SEED COMPLETADO';
  RAISE NOTICE '─────────────────────────────────────────';
  RAISE NOTICE '  Profesores:    %', (SELECT COUNT(*) FROM tbd_profesor);
  RAISE NOTICE '  Deportistas:   %', (SELECT COUNT(*) FROM tbd_deportista);
  RAISE NOTICE '  Proveedores:   %', (SELECT COUNT(*) FROM tbd_proveedores);
  RAISE NOTICE '  Productos:     %', (SELECT COUNT(*) FROM tbd_producto);
  RAISE NOTICE '  Compras:       %', (SELECT COUNT(*) FROM tbd_compra);
  RAISE NOTICE '  Líneas compra: %', (SELECT COUNT(*) FROM tbd_producto_x_compra);
  RAISE NOTICE '  Matrículas:    %', (SELECT COUNT(*) FROM tbd_matricula);
  RAISE NOTICE '  Mensualidades: %', (SELECT COUNT(*) FROM tbd_mensualidad);
  RAISE NOTICE '  Mediciones:    %', (SELECT COUNT(*) FROM tbd_medicion);
  RAISE NOTICE '─────────────────────────────────────────';
END $$;

COMMIT;
