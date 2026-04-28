-- Register driver: link the currently signed-in auth user to the
-- pre-created drivermate.drivers row matching the given driver_number.
--
-- Called from the client during first-time PIN setup (registerDriver in
-- src/lib/auth.ts) immediately after supabase.auth.signUp + signIn. The
-- function was previously only present in the live database via an ad-hoc
-- SQL editor run; this migration captures it so the schema is reproducible.
--
-- SECURITY DEFINER bypasses the drivers_admin_write RLS policy, which
-- would otherwise block a non-admin user from updating their own row.
-- The auth_user_id IS NULL guard ensures the function can only claim a
-- row that has not yet been linked to any auth user.

CREATE OR REPLACE FUNCTION drivermate.register_driver(p_driver_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  UPDATE drivermate.drivers
  SET auth_user_id = v_uid
  WHERE driver_number = p_driver_number
    AND auth_user_id IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION
      'Driver number % is not registered or has already been linked',
      p_driver_number;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION drivermate.register_driver(text) TO authenticated;
