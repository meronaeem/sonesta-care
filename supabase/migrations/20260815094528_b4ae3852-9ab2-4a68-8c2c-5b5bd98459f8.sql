ALTER TABLE public.briefing_action_points ADD COLUMN IF NOT EXISTS point_number integer;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY briefing_id ORDER BY created_at) AS n
  FROM public.briefing_action_points
)
UPDATE public.briefing_action_points p
SET point_number = numbered.n
FROM numbered
WHERE p.id = numbered.id AND p.point_number IS NULL;

CREATE OR REPLACE FUNCTION public.bap_set_point_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.point_number IS NULL THEN
    SELECT COALESCE(MAX(point_number), 0) + 1 INTO NEW.point_number
    FROM public.briefing_action_points
    WHERE briefing_id = NEW.briefing_id;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.bap_set_point_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bap_point_number ON public.briefing_action_points;
CREATE TRIGGER trg_bap_point_number
BEFORE INSERT ON public.briefing_action_points
FOR EACH ROW EXECUTE FUNCTION public.bap_set_point_number();