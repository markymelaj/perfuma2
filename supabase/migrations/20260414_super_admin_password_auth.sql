-- BLOQUE 1: ejecutar solo este statement y esperar a que termine
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- BLOQUE 2: ejecutar aparte, en una segunda corrida
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.current_user_role() IN ('owner'::public.app_role, 'super_admin'::public.app_role),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
