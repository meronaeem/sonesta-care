REVOKE EXECUTE ON FUNCTION public.trg_log_briefing_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_action_point_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_briefing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_briefing(uuid) TO authenticated, service_role;