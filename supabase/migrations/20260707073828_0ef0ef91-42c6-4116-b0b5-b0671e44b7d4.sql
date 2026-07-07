
-- Tighten SELECT policies to IT staff (and owners where relevant)
DROP POLICY IF EXISTS assets_read ON public.assets;
CREATE POLICY assets_read ON public.assets FOR SELECT
  USING (public.is_it_staff(auth.uid()) OR assigned_user_id = auth.uid());

DROP POLICY IF EXISTS moves_read ON public.asset_movements;
CREATE POLICY moves_read ON public.asset_movements FOR SELECT
  USING (public.is_it_staff(auth.uid()) OR from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS net_read ON public.network_devices;
CREATE POLICY net_read ON public.network_devices FOR SELECT
  USING (public.is_it_staff(auth.uid()));

DROP POLICY IF EXISTS srv_read ON public.servers;
CREATE POLICY srv_read ON public.servers FOR SELECT
  USING (public.is_it_staff(auth.uid()));

DROP POLICY IF EXISTS sw_read ON public.software;
CREATE POLICY sw_read ON public.software FOR SELECT
  USING (public.is_it_staff(auth.uid()));

-- Profiles: users read their own; IT staff read all
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
CREATE POLICY profiles_read_own_or_it ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_it_staff(auth.uid()));

-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
