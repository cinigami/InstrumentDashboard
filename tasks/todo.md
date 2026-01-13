# Supabase Data Persistence - Implementation Plan

## Overview
Add Supabase integration to persist equipment data, replacing in-memory state storage.

---

## Todo Checklist

### 1. Setup & Configuration
- [x] Install `@supabase/supabase-js` dependency (update package.json)
- [x] Create `.env.example` file with placeholder variables
- [x] Create `src/lib/supabase.js` - Supabase client setup
- [x] Update `vite.config.js` to expose env variables (not needed - Vite handles VITE_ prefix automatically)

### 2. Database Schema (SQL file for user to run)
- [x] Create `supabase/schema.sql` with:
  - `equipment` table creation
  - RLS policy to allow anon access (disabled RLS)
  - Indexes for common queries
  - Unique constraint on functional_location for UPSERT
  - Auto-update trigger for updated_at

### 3. Custom Hook for Data Operations
- [x] Create `src/hooks/useEquipmentData.js` with:
  - `fetchEquipment()` - Load all data on app start
  - `saveEquipment(data)` - UPSERT after Excel upload
  - `clearAllData()` - Delete all records
  - Loading states (`isLoading`, `isSaving`)
  - Error handling with user-friendly messages

### 4. Update App.jsx
- [x] Import and use `useEquipmentData` hook
- [x] Fetch data on initial load (removed DEMO_DATA default)
- [x] Save to Supabase after Excel upload
- [x] Add "Clear All Data" button in the UI
- [x] Show loading states during fetch/save operations
- [x] Display error messages when operations fail
- [x] Show warning when Supabase is not configured
- [x] Show data source indicator (file name or "Loaded from database")

### 5. Documentation Updates
- [x] Update README.md with:
  - Supabase project setup instructions
  - Environment variable configuration
  - SQL schema execution steps
  - Netlify environment variable setup
  - Project structure update

---

## Technical Notes

### Data Flow
1. **App Load**: Fetch from Supabase -> populate React state
2. **Excel Upload**: Parse XLSX -> save to Supabase -> update React state
3. **Clear Data**: Delete from Supabase -> clear React state

### Database Table Structure
```sql
equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  status text NOT NULL CHECK (status IN ('Healthy', 'Caution', 'Warning')),
  equipment_type text,
  description text,
  functional_location text,
  criticality text,
  alarm_description text,
  rectification text,
  notification_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### File Changes Summary
| File | Action |
|------|--------|
| package.json | Add @supabase/supabase-js |
| .env.example | Create new |
| src/lib/supabase.js | Create new |
| src/hooks/useEquipmentData.js | Create new |
| src/App.jsx | Modify - integrate hook |
| supabase/schema.sql | Create new |
| README.md | Modify - add setup docs |

---

## Out of Scope
- Authentication (using anon key only)
- Real-time subscriptions
- Pagination (all data loaded at once)

---

## Review Summary

### Changes Made

**1. New Files Created:**
- `.env.example` - Template for environment variables
- `src/lib/supabase.js` - Supabase client initialization with graceful fallback when not configured
- `src/hooks/useEquipmentData.js` - Custom React hook for all data operations (fetch, save, clear)
- `supabase/schema.sql` - Complete database schema with table, indexes, RLS config, and auto-update trigger

**2. Files Modified:**
- `package.json` - Added `@supabase/supabase-js` dependency
- `src/App.jsx` - Integrated Supabase hook, removed DEMO_DATA, added UI for loading/saving states, error display, and Clear All button
- `README.md` - Added comprehensive Supabase setup instructions for local dev and Netlify deployment

**3. Key Features Implemented:**
- Data fetches from Supabase on app load
- Excel upload saves to Supabase (UPSERT based on functional_location)
- "Clear All Data" button with confirmation modal
- Visual indicators for loading, saving, and errors
- Warning banner when Supabase is not configured
- Data source indicator in header (file name or "Loaded from database")

**4. Graceful Degradation:**
- App works without Supabase configured (local-only mode)
- Shows warning but doesn't block functionality
- Errors don't crash the app - displayed as dismissible messages

### Next Steps for User
1. Create Supabase project at supabase.com
2. Run `supabase/schema.sql` in Supabase SQL Editor
3. Copy `.env.example` to `.env` and add credentials
4. Run `npm install` to install new dependency
5. For Netlify: Add environment variables in site settings
