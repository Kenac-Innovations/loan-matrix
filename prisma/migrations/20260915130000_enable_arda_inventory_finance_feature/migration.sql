-- Enable the inventory finance workspace only for ARDA. This preserves all
-- existing tenant settings and leaves every other tenant on the default: off.
UPDATE "Tenant"
SET "settings" = jsonb_set(
  COALESCE("settings", '{}'::jsonb),
  '{features}',
  COALESCE("settings"->'features', '{}'::jsonb) || '{"hasInventoryFinance": true}'::jsonb,
  true
)
WHERE "slug" = 'arda';
