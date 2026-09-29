-- Speeds up admin/reception-leads filtering by reception_config_id (previously
-- no index existed on this column even though it's the natural per-campaign key).
CREATE INDEX IF NOT EXISTS call_logs_config_idx ON call_logs (reception_config_id);
