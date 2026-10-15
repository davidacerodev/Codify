CREATE OR REPLACE FUNCTION public.reject_operational_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Los registros institucionales no se eliminan; usa cancelación, retiro o desactivación.'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_operational_delete() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'medicamentos',
    'lotes',
    'citas',
    'despachos',
    'despacho_items',
    'auditoria',
    'horarios'
  ] LOOP
    EXECUTE pg_catalog.format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'preserve_' || table_name || '_on_delete',
      table_name
    );
    EXECUTE pg_catalog.format(
      'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_operational_delete()',
      'preserve_' || table_name || '_on_delete',
      table_name
    );
  END LOOP;
END;
$$;
