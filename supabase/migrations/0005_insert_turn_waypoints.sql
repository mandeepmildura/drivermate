-- Atomic turn-waypoint insertion.
--
-- The route_stops table has a UNIQUE(route_id, sequence) constraint, so
-- inserting N turn waypoints between two existing stops requires bumping
-- every downstream stop's sequence by N — and PostgreSQL checks UNIQUE on
-- each row update individually, not at end-of-statement, which trips on
-- the intermediate state. This RPC does the rename via a 2-phase offset
-- (+100000 first, then to the final value) so no two rows ever collide.
--
-- Called by AdminImportTurns when an admin imports a leg's turn-by-turn
-- from Google Maps Directions. Runs as the caller (SECURITY INVOKER) so
-- the existing route_stops_admin_write RLS still requires admin + the
-- route to be unlocked.

CREATE OR REPLACE FUNCTION public.insert_turn_waypoints(
  p_route_id uuid,
  p_after_sequence integer,
  p_turns jsonb
)
RETURNS SETOF public.route_stops
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := jsonb_array_length(p_turns);
  v_new_seq integer;
  v_turn jsonb;
  v_inserted public.route_stops;
BEGIN
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN;
  END IF;

  -- Phase 1: move every downstream stop into a high temporary range so
  -- the upcoming insertions don't collide with their original sequence.
  UPDATE public.route_stops
  SET sequence = sequence + 100000
  WHERE route_id = p_route_id
    AND sequence > p_after_sequence;

  -- Phase 2: drop them back, shifted by v_count so there's a gap right
  -- after p_after_sequence for the new turns.
  UPDATE public.route_stops
  SET sequence = sequence - 100000 + v_count
  WHERE route_id = p_route_id
    AND sequence > 100000;

  -- Phase 3: insert the turn rows in order.
  v_new_seq := p_after_sequence;
  FOR v_turn IN SELECT * FROM jsonb_array_elements(p_turns)
  LOOP
    v_new_seq := v_new_seq + 1;
    INSERT INTO public.route_stops (
      route_id, sequence, kind, stop_name, instruction_text, lat, lng
    ) VALUES (
      p_route_id,
      v_new_seq,
      'turn',
      COALESCE(NULLIF(v_turn->>'stop_name', ''), 'Turn'),
      v_turn->>'instruction_text',
      (v_turn->>'lat')::double precision,
      (v_turn->>'lng')::double precision
    )
    RETURNING * INTO v_inserted;
    RETURN NEXT v_inserted;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_turn_waypoints(uuid, integer, jsonb)
  TO authenticated;
