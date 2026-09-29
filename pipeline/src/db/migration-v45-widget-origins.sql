-- Per-client origin allowlist for the embeddable AI-sales-person widget
-- (pipeline/src/reception/public/widget.js). NULL means "derive from
-- website_url's origin" — the common case where the widget is embedded on
-- the same site already on file, needing zero extra setup.
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS widget_allowed_origins TEXT[];

SELECT 'Migration v45 (widget allowed origins) complete.' AS result;
