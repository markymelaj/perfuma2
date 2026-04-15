# Consigna Privada — paquete nuevo y limpio

Proyecto interno de venta a consignación con Next.js + Supabase + Vercel.

## Incluye
- Login por email + contraseña
- Roles `super_admin`, `owner`, `seller`
- Alta manual de usuarios sin depender de magic link
- Activar / desactivar vendedores
- Reset manual de contraseña temporal
- Proveedores, productos, consignaciones, ventas y rendiciones
- Ubicación puntual
- Mensajería interna owner/seller
- `proxy.ts` listo para Next 16
- `package-lock.json` incluido
- `.npmrc` incluido para instalación más estable

## Este paquete sirve para reemplazar el proyecto actual en GitHub y desplegar en Vercel
Para un proyecto Supabase nuevo, ejecuta solo:
1. `supabase/schema.sql`
2. crea tu primer usuario en Supabase Auth
3. conviértelo a `super_admin`

## Usuario inicial
Después de crear tu usuario en Auth:

```sql
update public.profiles
set role = 'super_admin', is_active = true, must_reenroll_security = false
where email = 'TU_CORREO';
```

## Variables de entorno
Copia `.env.example` a `.env.local` en local, y en Vercel crea estas variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Despliegue recomendado
1. Sube este paquete a un repo nuevo de GitHub
2. Importa ese repo en Vercel
3. Configura las variables de entorno
4. Desactiva signup libre en Supabase
5. Haz el primer login con tu `super_admin`

## Nota
Este paquete fue probado localmente con `npm run build` antes de empaquetarse.


## Mejoras incluidas en esta versión
- Flujo de owner y seller más cómodo en móvil
- Navegación móvil inferior
- Tablas adaptadas a cards en pantallas pequeñas
- Formularios principales con manejo correcto de reset y feedback
- Rutas internas unificadas para no repetir el problema de `No autorizado` en acciones admin
- Manifest básico para instalar como app web (PWA ligera)
