# PCFK Instrument Health Dashboard

Equipment Health Monitoring Dashboard for PETRONAS Chemicals Fertiliser Kedah (PCFK) - Maintenance Department.

## Features

- 📊 Real-time equipment health visualization
- 📈 Overview, By Area, By Equipment views
- ⚠️ Alerts and Obsolescence tracking
- 📁 Excel file upload support
- 🎨 PETRONAS corporate branding

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
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Build settings will be auto-detected from `netlify.toml`
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

### Option 3: Drag & Drop

1. **Build locally:**
   ```bash
   npm install
   npm run build
   ```

2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)

3. Drag the `dist` folder to deploy

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

## Project Structure

```
├── index.html          # HTML entry point
├── netlify.toml        # Netlify configuration
├── package.json        # Dependencies & scripts
├── vite.config.js      # Vite bundler config
├── public/
│   └── favicon.svg     # Site icon
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Dashboard component
```

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

## License

PETRONAS Chemicals Fertiliser Kedah © 2025
