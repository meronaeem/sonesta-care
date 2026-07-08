
REVOKE ALL ON FUNCTION public.log_activity(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_log_asset_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_log_ticket_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_log_pm_task_change() FROM PUBLIC, anon, authenticated;
