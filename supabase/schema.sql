-- ============================================
-- PCFK Instrument Health Dashboard
-- Supabase Database Schema
-- ============================================

-- Create the equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Healthy', 'Caution', 'Warning')),
  equipment_type TEXT,
  description TEXT,
  functional_location TEXT,
  criticality TEXT,
  alarm_description TEXT,
  rectification TEXT,
  notification_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment(area);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_functional_location ON equipment(functional_location);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Option 1: Disable RLS entirely (simplest for no-auth use case)
ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;

-- OR Option 2: Enable RLS with permissive policies (uncomment below if preferred)
-- ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
--
-- -- Allow anonymous users to read all equipment
-- CREATE POLICY "Allow anonymous read" ON equipment
--   FOR SELECT
--   TO anon
--   USING (true);
--
-- -- Allow anonymous users to insert equipment
-- CREATE POLICY "Allow anonymous insert" ON equipment
--   FOR INSERT
--   TO anon
--   WITH CHECK (true);
--
-- -- Allow anonymous users to update equipment
-- CREATE POLICY "Allow anonymous update" ON equipment
--   FOR UPDATE
--   TO anon
--   USING (true)
--   WITH CHECK (true);
--
-- -- Allow anonymous users to delete equipment
-- CREATE POLICY "Allow anonymous delete" ON equipment
--   FOR DELETE
--   TO anon
--   USING (true);

-- ============================================
-- Function to auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on row update
DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Dashboard Metadata Table
-- Stores when data was last refreshed by admin
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures single row
  last_refreshed_at TIMESTAMPTZ DEFAULT now(),
  refreshed_by TEXT DEFAULT 'Admin'
);

-- Insert initial row if not exists
INSERT INTO dashboard_meta (id, last_refreshed_at)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

-- Disable RLS for dashboard_meta
ALTER TABLE dashboard_meta DISABLE ROW LEVEL SECURITY;
