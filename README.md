# PCFK Instrument Health Dashboard

Equipment Health Monitoring Dashboard for PETRONAS Chemicals Fertiliser Kedah (PCFK) - Maintenance Department.

## Features

- Real-time equipment health visualization
- Overview, By Area, By Equipment views
- Alerts and Obsolescence tracking
- Excel file upload support
- **Supabase data persistence** - Data persists after page refresh
- PETRONAS corporate branding

---

## Supabase Setup (Data Persistence)

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter a project name and database password
4. Select your preferred region
5. Click "Create new project" and wait for setup to complete

### Step 2: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy the **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy the **anon public** key under "Project API keys"

### Step 3: Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `supabase/schema.sql`
4. Click "Run" to execute the SQL

This creates the `equipment` table with all required columns and disables Row Level Security for anonymous access.

### Step 4: Configure Environment Variables

**For Local Development:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

**For Netlify Deployment:**

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add two variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Redeploy the site for changes to take effect

---

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Deployment to Netlify

### Option 1: Deploy via Netlify Dashboard (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/pcfk-dashboard.git
   git push -u origin main
   ```

2. **Deploy on Netlify:**
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "Add new site" > "Import an existing project"
   - Connect your GitHub repository
   - Build settings will be auto-detected from `netlify.toml`
   - **Add environment variables** (see Supabase setup above)
   - Click "Deploy site"

### Option 2: Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod --dir=dist
   ```

   Note: You'll need to set environment variables in the Netlify dashboard.

### Option 3: Drag & Drop

1. **Build locally:**
   ```bash
   npm install
   npm run build
   ```

2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)

3. Drag the `dist` folder to deploy

   Note: You'll need to configure the site afterwards to add environment variables.

---

## Project Structure

```
├── index.html              # HTML entry point
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite bundler config
├── .env.example            # Environment variables template
├── public/
│   └── favicon.svg         # Site icon
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Dashboard component
│   ├── lib/
│   │   └── supabase.js     # Supabase client
│   └── hooks/
│       └── useEquipmentData.js  # Data operations hook
├── supabase/
│   └── schema.sql          # Database schema
└── tasks/
    └── todo.md             # Development tasks
```

---

## Excel File Format

Upload Excel files with sheets named:
- Ammonia
- Utility
- Urea
- PDF UET
- System
- Turbomachinery

Required columns:
- Status (Healthy/Caution/Warning)
- Equipment Type
- Description
- Functional Location
- Criticality (High/Medium/Low or C1/C2/C3)
- Alarm Description
- Rectification
- Notification Date

---

## How Data Persistence Works

1. **On App Load:** Dashboard fetches existing equipment data from Supabase
2. **On Excel Upload:** Data is parsed and saved to Supabase (upserts based on Functional Location)
3. **On Clear All:** All equipment records are deleted from Supabase

If Supabase is not configured (missing environment variables), the dashboard will show a warning and operate in local-only mode where data is lost on page refresh.

---

## License

PETRONAS Chemicals Fertiliser Kedah © 2025
