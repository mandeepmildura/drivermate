-- Register driver: link the currently signed-in auth user to the
-- pre-created drivers row matching the given driver_number.
--
-- Called from the client during first-time PIN setup (registerDriver in
-- src/lib/auth.ts) immediately after supabase.auth.signUp + signIn. The
-- function was previously only present in the live database via an ad-hoc
-- SQL editor run; this migration captures it verbatim so the schema is
-- reproducible.
--
-- SECURITY DEFINER bypasses the drivers_admin_write RLS policy, which
-- would otherwise block a non-admin user from updating their own row.

CREATE OR REPLACE FUNCTION public.register_driver(p_driver_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_driver_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'must be authenticated' USING ERRCODE = '42501';
  END IF;

  -- Refuse if this auth user is already linked to a driver row.
  IF EXISTS (SELECT 1 FROM public.drivers WHERE auth_user_id = v_uid) THEN
    RAISE EXCEPTION 'this account is already linked to a driver';
  END IF;

  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE driver_number = p_driver_number
    AND auth_user_id IS NULL
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'unknown driver number, or already registered';
  END IF;

  UPDATE public.drivers SET auth_user_id = v_uid WHERE id = v_driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_driver(text) TO authenticated;
