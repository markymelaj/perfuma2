# Consigna Privada V3

Versión enfocada en operar mejor desde celular y centrar la gestión en cada vendedor.

## Cambios principales
- acceso con **usuario o correo + contraseña**
- alta de vendedores solo con usuario + contraseña
- stock acumulado por vendedor y producto
- si cargas el mismo producto al mismo vendedor, se suma en la misma cuenta abierta
- panel owner centrado en la **cuenta del vendedor**
- proveedores fuera del flujo principal
- tablas responsivas a cards en móvil
- manifest listo para instalar como app web

## Importante para sesiones largas
Si en tu proyecto Supabase el sistema desloguea demasiado rápido, revisa en:

`Auth > Settings > JWT expiry`

Para uso interno diario conviene dejar una duración más alta, por ejemplo 7 días.

## SQL para proyecto nuevo
Ejecuta:
1. `supabase/schema.sql`
2. `supabase/migrations/20260415_v3_username_mobile.sql`

## SQL para proyecto existente
Ejecuta solo:
1. `supabase/migrations/20260415_v3_username_mobile.sql`

## Primer super admin
Después de crear tu usuario inicial:

```sql
update public.profiles
set role = 'super_admin', is_active = true, must_reenroll_security = false
where email = 'TU_CORREO_O_CORREO_INTERNO';
```

## Usuario sin mail real
El sistema genera un acceso interno basado en el nombre de usuario.
Ejemplo:
- usuario: `camila`
- login interno: `camila@usuarios.consigna.local`

En la práctica, el vendedor puede ingresar escribiendo solo `camila`.

## Variables de entorno
Configura:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Despliegue
1. reemplaza el repo con este contenido
2. push a GitHub
3. redeploy en Vercel
4. verifica variables y corre la migración SQL

## Pruebas recomendadas
1. login super admin
2. crear usuario seller con username
3. crear producto
4. cargar stock dos veces al mismo vendedor y mismo producto
5. registrar venta
6. registrar rendición parcial o total
7. revisar saldo pendiente y stock actual del vendedor
