-- Admin PIN reset: lets a depot manager (is_admin = true) set a new PIN for
-- another driver without going through Supabase's email-based password
-- recovery flow. Drivers don't have real email addresses (auth.ts synthesises
-- driver@drivermate.app), so the standard "send reset email" path is unusable.
--
-- The function runs as SECURITY DEFINER so it can update auth.users.
-- It still enforces is_admin() inside the body, so the privilege gate is
-- applied to the *caller*, not the function owner.
--
-- The companion change_pin flow stays client-side via supabase.auth.updateUser
-- — it doesn't need a server function because the driver re-authenticates with
-- their current PIN first.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.admin_reset_driver_pin(
  p_driver_id uuid,
  p_new_pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only depot managers can reset PINs' USING ERRCODE = '42501';
  END IF;

  IF p_new_pin !~ '^\d{6,12}$' THEN
    RAISE EXCEPTION 'PIN must be 6-12 digits' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user_id INTO v_auth_user_id
  FROM public.drivers
  WHERE id = p_driver_id;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'driver has not registered a PIN yet' USING ERRCODE = '22023';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_pin, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = v_auth_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_driver_pin(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reset_driver_pin(uuid, text) TO authenticated;
