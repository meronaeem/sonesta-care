CREATE TABLE public.briefing_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL UNIQUE REFERENCES public.briefings(id) ON DELETE CASCADE,
  occupancy_today integer NOT NULL DEFAULT 0 CHECK (occupancy_today >= 0),
  occupancy_rate_today numeric(5,2) NOT NULL DEFAULT 0 CHECK (occupancy_rate_today >= 0 AND occupancy_rate_today <= 100),
  breakfast_pax_tomorrow integer NOT NULL DEFAULT 0 CHECK (breakfast_pax_tomorrow >= 0),
  duty_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vip0_rooms integer NOT NULL DEFAULT 0 CHECK (vip0_rooms >= 0),
  vip1_rooms integer NOT NULL DEFAULT 0 CHECK (vip1_rooms >= 0),
  vip2_rooms integer NOT NULL DEFAULT 0 CHECK (vip2_rooms >= 0),
  vip3_rooms integer NOT NULL DEFAULT 0 CHECK (vip3_rooms >= 0),
  occupancy_mtd numeric(5,2) NOT NULL DEFAULT 0 CHECK (occupancy_mtd >= 0 AND occupancy_mtd <= 100),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_rooms TO authenticated;
GRANT ALL ON public.briefing_rooms TO service_role;

ALTER TABLE public.briefing_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rooms info for visible briefings"
ON public.briefing_rooms FOR SELECT TO authenticated
USING (public.can_see_briefing(briefing_id));

CREATE POLICY "Manage rooms info"
ON public.briefing_rooms FOR ALL TO authenticated
USING (
  public.is_it_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid()))
)
WITH CHECK (
  public.is_it_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND (b.created_by = auth.uid() OR b.organizer_id = auth.uid()))
);

CREATE TRIGGER trg_briefing_rooms_updated
BEFORE UPDATE ON public.briefing_rooms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();