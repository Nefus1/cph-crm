-- Matter numbers: CPH-YY-0001 (sequence is global, the year prefix is informational).
CREATE SEQUENCE IF NOT EXISTS matter_number_seq START 1;
--> statement-breakpoint
-- All data access goes through the server (DATABASE_URL, table owner). Enabling RLS with
-- no policies means Supabase's public anon/authenticated keys can read nothing.
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE matter_parties ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE court_holidays ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- California judicial holidays (Gov. Code §6700 / CCP §135). Editable in Settings.
INSERT INTO court_holidays (date, name) VALUES
  ('2026-01-01','New Year''s Day'),
  ('2026-01-19','Martin Luther King Jr. Day'),
  ('2026-02-12','Lincoln''s Birthday'),
  ('2026-02-16','Presidents'' Day'),
  ('2026-03-31','Cesar Chavez Day'),
  ('2026-05-25','Memorial Day'),
  ('2026-06-19','Juneteenth'),
  ('2026-07-03','Independence Day (observed)'),
  ('2026-09-07','Labor Day'),
  ('2026-09-25','Native American Day'),
  ('2026-10-12','Indigenous Peoples'' Day / Columbus Day'),
  ('2026-11-11','Veterans Day'),
  ('2026-11-26','Thanksgiving Day'),
  ('2026-11-27','Day after Thanksgiving'),
  ('2026-12-25','Christmas Day'),
  ('2027-01-01','New Year''s Day'),
  ('2027-01-18','Martin Luther King Jr. Day'),
  ('2027-02-12','Lincoln''s Birthday'),
  ('2027-02-15','Presidents'' Day'),
  ('2027-03-31','Cesar Chavez Day'),
  ('2027-05-31','Memorial Day'),
  ('2027-06-18','Juneteenth (observed)'),
  ('2027-07-05','Independence Day (observed)'),
  ('2027-09-06','Labor Day'),
  ('2027-09-24','Native American Day'),
  ('2027-10-11','Indigenous Peoples'' Day / Columbus Day'),
  ('2027-11-11','Veterans Day'),
  ('2027-11-25','Thanksgiving Day'),
  ('2027-11-26','Day after Thanksgiving'),
  ('2027-12-24','Christmas Day (observed)'),
  ('2027-12-31','New Year''s Day (observed)')
ON CONFLICT DO NOTHING;
