import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEquipmentData } from './hooks/useEquipmentData';

const STATUS_COLORS = {
  'Healthy': '#00B1A9',   // PETRONAS Emerald Green
  'Caution': '#FDB924',   // PETRONAS Yellow
  'Warning': '#E31837'    // Red
};

const AREA_COLORS = {
  'Ammonia': '#00B1A9',       // PETRONAS Emerald Green
  'Utility': '#20419A',       // PETRONAS Blue
  'Urea': '#763F98',          // PETRONAS Purple
  'PDF UET': '#BFD730',       // PETRONAS Lime Green
  'System': '#FDB924',        // PETRONAS Yellow
  'Turbomachinery': '#00B1A9' // PETRONAS Emerald Green
};

const AREAS = ['Ammonia', 'Utility', 'Urea', 'PDF UET', 'System', 'Turbomachinery'];

export default function InstrumentHealthDashboard() {
  // Use Supabase data hook
  const {
    data,
    setData,
    isLoading: isLoadingData,
    isSaving,
    error,
    lastRefreshedAt,
    isSupabaseConfigured,
    saveEquipment,
    clearAllData,
    clearError
  } = useEquipmentData();

  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [fileName, setFileName] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [viewMode, setViewMode] = useState('overview');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Format criticality to C1/C2/C3 format
  const formatCriticality = (criticality) => {
    if (!criticality) return '-';
    const critMap = {
      'high': 'C1',
      'medium': 'C2',
      'low': 'C3',
      'c1': 'C1',
      'c2': 'C2',
      'c3': 'C3'
    };
    return critMap[criticality.toLowerCase()] || criticality;
  };

  // Format last refreshed timestamp
  const formatRefreshTime = (date) => {
    if (!date) return null;
    return date.toLocaleString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format date to mmm-yy format
  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
    
    let date;
    
    // Handle Excel serial date number
    if (typeof dateValue === 'number') {
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } 
    // Handle string date
    else if (typeof dateValue === 'string') {
      // Try to parse DD-MMM-YYYY format (e.g., "15-Nov-2025")
      const ddMmmYyyyMatch = dateValue.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (ddMmmYyyyMatch) {
        const day = parseInt(ddMmmYyyyMatch[1]);
        const monthStr = ddMmmYyyyMatch[2].toLowerCase();
        const year = parseInt(ddMmmYyyyMatch[3]);
        if (monthMap[monthStr] !== undefined) {
          date = new Date(year, monthMap[monthStr], day);
        }
      }
      // Try standard date parsing
      if (!date || isNaN(date.getTime())) {
        date = new Date(dateValue);
      }
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    
    if (!date || isNaN(date.getTime())) return dateValue; // Return original if can't parse
    
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    
    return `${month}-${year}`;
  };

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileName(file.name);
    clearError();

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const allData = [];

        AREAS.forEach(sheetName => {
          if (workbook.SheetNames.includes(sheetName)) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            jsonData.forEach(row => {
              const status = row['Status'] || 'Unknown';
              const equipType = (row['Equiment Type'] || row['Equipment Type'] || 'Unknown').trim();
              if (status && ['Healthy', 'Caution', 'Warning'].includes(status)) {
                allData.push({
                  area: sheetName,
                  equipmentType: equipType,
                  description: row['Description'] || '',
                  functionalLocation: row['Functional Location'] || '',
                  criticality: row['Criticality'] || row['Fleet'] || '',
                  status: status,
                  alarmDescription: row['Alarm Description'] || '',
                  rectification: row['Rectification'] || '',
                  notificationDate: row['Notification Date'] || row['Date'] || ''
                });
              }
            });
          }
        });

        // Save to Supabase if configured
        if (isSupabaseConfigured && allData.length > 0) {
          const success = await saveEquipment(allData);
          if (!success) {
            // Still show the data locally even if save failed
            setData(allData);
          }
        } else {
          // No Supabase - just set local state
          setData(allData);
        }

        setIsProcessingFile(false);
      } catch (err) {
        console.error('Error parsing file:', err);
        setIsProcessingFile(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [isSupabaseConfigured, saveEquipment, setData, clearError]);

  // Handle clear all data with confirmation
  const handleClearAllData = useCallback(async () => {
    const success = await clearAllData();
    if (success) {
      setFileName('');
      setShowClearConfirm(false);
    }
  }, [clearAllData]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      if (selectedArea !== 'All' && item.area !== selectedArea) return false;
      if (selectedEquipment !== 'All' && item.equipmentType !== selectedEquipment) return false;
      if (selectedStatus !== 'All' && item.status !== selectedStatus) return false;
      return true;
    });
  }, [data, selectedArea, selectedEquipment, selectedStatus]);

  const equipmentTypes = useMemo(() => {
    if (!data) return [];
    const types = [...new Set(data.map(d => d.equipmentType))].filter(t => t && t !== 'Unknown');
    return types.sort();
  }, [data]);

  const stats = useMemo(() => {
    if (!filteredData.length) return { total: 0, healthy: 0, caution: 0, warning: 0 };
    return {
      total: filteredData.length,
      healthy: filteredData.filter(d => d.status === 'Healthy').length,
      caution: filteredData.filter(d => d.status === 'Caution').length,
      warning: filteredData.filter(d => d.status === 'Warning').length
    };
  }, [filteredData]);

  const areaChartData = useMemo(() => {
    if (!data) return [];
    const areaData = selectedArea === 'All' ? data : data.filter(d => d.area === selectedArea);
    const grouped = {};
    
    AREAS.forEach(area => {
      const areaItems = areaData.filter(d => d.area === area);
      if (areaItems.length > 0) {
        grouped[area] = {
          name: area,
          Healthy: areaItems.filter(d => d.status === 'Healthy').length,
          Caution: areaItems.filter(d => d.status === 'Caution').length,
          Warning: areaItems.filter(d => d.status === 'Warning').length,
          total: areaItems.length
        };
      }
    });
    
    return Object.values(grouped);
  }, [data, selectedArea]);

  const equipmentChartData = useMemo(() => {
    if (!filteredData.length) return [];
    const grouped = {};
    
    filteredData.forEach(item => {
      if (!grouped[item.equipmentType]) {
        grouped[item.equipmentType] = { name: item.equipmentType, Healthy: 0, Caution: 0, Warning: 0 };
      }
      grouped[item.equipmentType][item.status]++;
    });
    
    return Object.values(grouped).sort((a, b) => 
      (b.Healthy + b.Caution + b.Warning) - (a.Healthy + a.Caution + a.Warning)
    );
  }, [filteredData]);

  const pieData = useMemo(() => {
    if (!stats.total) return [];
    return [
      { name: 'Healthy', value: stats.healthy, color: STATUS_COLORS.Healthy },
      { name: 'Caution', value: stats.caution, color: STATUS_COLORS.Caution },
      { name: 'Warning', value: stats.warning, color: STATUS_COLORS.Warning }
    ].filter(d => d.value > 0);
  }, [stats]);

  const alertItemsAll = useMemo(() => {
    if (!filteredData.length) return [];
    return filteredData
      .filter(d => d.status !== 'Healthy' && d.alarmDescription && !d.alarmDescription.toLowerCase().includes('obsolete'))
      .sort((a, b) => {
        // Warning comes first, then Caution
        if (a.status === 'Warning' && b.status === 'Caution') return -1;
        if (a.status === 'Caution' && b.status === 'Warning') return 1;
        return 0;
      });
  }, [filteredData]);

  const alertItems = useMemo(() => {
    return alertItemsAll.slice(0, 20);
  }, [alertItemsAll]);

  const agingItems = useMemo(() => {
    if (!filteredData.length) return [];
    return filteredData
      .filter(d => d.status !== 'Healthy' && d.alarmDescription && d.alarmDescription.toLowerCase().includes('obsolete'))
      .sort((a, b) => {
        // Warning comes first, then Caution
        if (a.status === 'Warning' && b.status === 'Caution') return -1;
        if (a.status === 'Caution' && b.status === 'Warning') return 1;
        return 0;
      });
  }, [filteredData]);

  // Group alerts by equipment type
  const groupedAlerts = useMemo(() => {
    const groups = {};
    alertItemsAll.forEach(item => {
      if (!groups[item.equipmentType]) {
        groups[item.equipmentType] = [];
      }
      groups[item.equipmentType].push(item);
    });
    // Sort equipment types alphabetically
    return Object.keys(groups).sort().map(type => ({
      equipmentType: type,
      items: groups[type]
    }));
  }, [alertItemsAll]);

  // Group aging/obsolescence items by equipment type
  const groupedAging = useMemo(() => {
    const groups = {};
    agingItems.forEach(item => {
      if (!groups[item.equipmentType]) {
        groups[item.equipmentType] = [];
      }
      groups[item.equipmentType].push(item);
    });
    // Sort equipment types alphabetically
    return Object.keys(groups).sort().map(type => ({
      equipmentType: type,
      items: groups[type]
    }));
  }, [agingItems]);

  const healthPercent = stats.total > 0 ? ((stats.healthy / stats.total) * 100).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {payload.map((entry, i) => (
          <div key={i} style={{ color: entry.color || '#1f2937', marginBottom: i < payload.length - 1 ? '4px' : 0 }}>
            <span style={{ fontWeight: 500 }}>{entry.name}:</span> {entry.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      color: '#1f2937',
      padding: '24px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
        
        @font-face {
          font-family: 'Museo Sans';
          src: local('Museo Sans 700'), local('MuseoSans-700'), local('MuseoSans700');
          font-weight: 700;
          font-style: normal;
        }
        
        .number-display {
          font-family: 'Museo Sans', 'IBM Plex Sans', system-ui, sans-serif;
          font-weight: 700;
        }
        
        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }
        
        .card:hover {
          border-color: #00B1A9;
          box-shadow: 0 4px 16px rgba(0, 177, 169, 0.1);
        }
        
        .stat-card {
          position: relative;
          overflow: hidden;
        }
        
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 16px 16px 0 0;
        }
        
        .stat-healthy::before { background: #00B1A9; }
        .stat-caution::before { background: #FDB924; }
        .stat-warning::before { background: #E31837; }
        .stat-total::before { background: #20419A; }
        
        .upload-zone {
          border: 2px dashed #00B1A9;
          background: rgba(0, 177, 169, 0.05);
          border-radius: 16px;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .upload-zone:hover {
          border-color: #00B1A9;
          background: rgba(0, 177, 169, 0.1);
        }
        
        select, button {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          color: #1f2937;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        select:hover, button:hover {
          border-color: #00B1A9;
          background: #f9fafb;
        }
        
        select:focus, button:focus {
          outline: none;
          border-color: #00B1A9;
          box-shadow: 0 0 0 3px rgba(0, 177, 169, 0.2);
        }
        
        .tab-btn {
          padding: 10px 20px;
          border: none;
          background: transparent;
          color: #6b7280;
          font-weight: 500;
          position: relative;
        }
        
        .tab-btn.active {
          color: #00B1A9;
        }
        
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #00B1A9;
          border-radius: 2px;
        }
        
        .alert-row {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 8px;
          border-left: 3px solid;
          transition: all 0.2s ease;
        }
        
        .alert-row:hover {
          background: #f3f4f6;
        }
        
        .alert-warning { border-left-color: #E31837; }
        .alert-caution { border-left-color: #FDB924; }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        
        .pulse {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        .health-ring {
          transform: rotate(-90deg);
        }
      `}</style>

      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              margin: 0,
              color: '#00B1A9',
              letterSpacing: '-0.5px'
            }}>
              PCFK Instrument Health Monitor
            </h1>
            <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>
              Equipment Status Dashboard • Maintenance Department
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {lastRefreshedAt && (
              <div style={{
                background: 'rgba(32, 65, 154, 0.1)',
                border: '1px solid rgba(32, 65, 154, 0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#20419A" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span style={{ color: '#20419A' }}>
                  Last refreshed: {formatRefreshTime(lastRefreshedAt)}
                </span>
              </div>
            )}

            {/* Upload Excel Button - Always visible */}
            <label style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#00B1A9',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload Excel
              </span>
            </label>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(227, 24, 55, 0.1)',
          border: '1px solid rgba(227, 24, 55, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#E31837' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#E31837',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Supabase Config Warning */}
      {!isSupabaseConfigured && (
        <div style={{
          background: 'rgba(253, 185, 36, 0.1)',
          border: '1px solid rgba(253, 185, 36, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#b8860b'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Supabase not configured. Data will not persist. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env</span>
        </div>
      )}

      {/* Loading State */}
      {isLoadingData && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <div className="pulse" style={{ fontSize: '18px', color: '#00B1A9' }}>
            Loading equipment data...
          </div>
        </div>
      )}

      {/* Upload Section - Show when no data and not loading */}
      {!data && !isLoadingData && (
        <div className="card" style={{ padding: '48px', textAlign: 'center', marginBottom: '24px' }}>
          <label className="upload-zone" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px',
            gap: '16px'
          }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(0, 177, 169, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00B1A9" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px', color: '#1f2937' }}>
                Upload Excel File
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Drop your Instrument Health Dashboard file here or click to browse
              </p>
            </div>
            <span style={{
              background: '#00B1A9',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '14px'
            }}>
              Select File (.xlsx)
            </span>
          </label>
        </div>
      )}

      {/* Processing File Indicator */}
      {isProcessingFile && (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <div className="pulse" style={{ fontSize: '18px', color: '#00B1A9' }}>
            Processing file...
          </div>
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#00B1A9',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(0, 177, 169, 0.3)',
          zIndex: 1000
        }}>
          <div className="pulse">Saving to database...</div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ padding: '24px', maxWidth: '400px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E31837" strokeWidth="2" style={{ margin: '0 auto 16px' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3 style={{ margin: '0 0 8px', color: '#1f2937' }}>Clear All Data?</h3>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '14px' }}>
              This will permanently delete all equipment records from the database. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '10px 24px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={isSaving}
                style={{
                  padding: '10px 24px',
                  background: '#E31837',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                {isSaving ? 'Clearing...' : 'Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {data && !isProcessingFile && !isLoadingData && (
        <>
          {/* Filters & Actions */}
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                  <option value="All">All Areas</option>
                  {AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                
                <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}>
                  <option value="All">All Equipment Types</option>
                  {equipmentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Healthy">Healthy</option>
                  <option value="Caution">Caution</option>
                  <option value="Warning">Warning</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    color: '#1f2937'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17,8 12,3 7,8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Update Data
                  </span>
                </label>
                {isSupabaseConfigured && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      color: '#E31837',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card stat-card stat-total" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Equipment
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: 700, margin: 0, fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif', color: '#1f2937' }}>
                    {stats.total.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(32, 65, 154, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#20419A" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="card stat-card stat-healthy" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Healthy
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: 700, margin: 0, fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif', color: '#00B1A9' }}>
                    {stats.healthy.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(0, 177, 169, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00B1A9" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="card stat-card stat-caution" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Caution
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: 700, margin: 0, fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif', color: '#FDB924' }}>
                    {stats.caution.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(253, 185, 36, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FDB924" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="card stat-card stat-warning" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Warning
                  </p>
                  <p style={{ fontSize: '36px', fontWeight: 700, margin: 0, fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif', color: '#E31837' }}>
                    {stats.warning.toLocaleString()}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(227, 24, 55, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E31837" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* View Tabs */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ borderBottom: '1px solid #e5e7eb', padding: '0 20px' }}>
              <button 
                className={`tab-btn ${viewMode === 'overview' ? 'active' : ''}`}
                onClick={() => setViewMode('overview')}
              >
                Overview
              </button>
              <button 
                className={`tab-btn ${viewMode === 'areas' ? 'active' : ''}`}
                onClick={() => setViewMode('areas')}
              >
                By Area
              </button>
              <button 
                className={`tab-btn ${viewMode === 'equipment' ? 'active' : ''}`}
                onClick={() => setViewMode('equipment')}
              >
                By Equipment
              </button>
              <button 
                className={`tab-btn ${viewMode === 'alerts' ? 'active' : ''}`}
                onClick={() => setViewMode('alerts')}
              >
                Alerts ({alertItemsAll.length})
              </button>
              <button 
                className={`tab-btn ${viewMode === 'aging' ? 'active' : ''}`}
                onClick={() => setViewMode('aging')}
              >
                Obsolescence ({agingItems.length})
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {viewMode === 'overview' && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {/* Health Ring */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '280px', height: '280px' }}>
                      <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                        <circle
                          cx="100"
                          cy="100"
                          r="85"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="20"
                        />
                        <circle
                          className="health-ring"
                          cx="100"
                          cy="100"
                          r="85"
                          fill="none"
                          stroke="#00B1A9"
                          strokeWidth="20"
                          strokeLinecap="round"
                          strokeDasharray={`${healthPercent * 5.34} 534`}
                          style={{ transformOrigin: 'center' }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center'
                      }}>
                        <p style={{
                          fontSize: '48px',
                          fontWeight: 700,
                          margin: 0,
                          fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif',
                          color: '#00B1A9'
                        }}>
                          {healthPercent}%
                        </p>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Overall Health</p>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '24px', display: 'flex', gap: '32px' }}>
                      {pieData.map((entry) => (
                        <div key={entry.name} style={{ textAlign: 'center' }}>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '4px',
                            background: entry.color,
                            margin: '0 auto 6px'
                          }}/>
                          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{entry.name}</p>
                          <p style={{ fontSize: '20px', fontWeight: 600, margin: 0, fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif', color: '#1f2937' }}>
                            {entry.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'areas' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                  {areaChartData.map((area) => {
                    const areaHealthPercent = ((area.Healthy / area.total) * 100).toFixed(1);
                    return (
                      <div key={area.name} className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>{area.name}</h4>
                          <span style={{
                            background: 'rgba(0, 177, 169, 0.15)',
                            color: '#00B1A9',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 500,
                            fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif'
                          }}>
                            {areaHealthPercent}% Healthy
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                          <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(0, 177, 169, 0.1)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#00B1A9', fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif' }}>
                              {area.Healthy}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Healthy</p>
                          </div>
                          <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(253, 185, 36, 0.1)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#FDB924', fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif' }}>
                              {area.Caution}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Caution</p>
                          </div>
                          <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(227, 24, 55, 0.1)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#E31837', fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif' }}>
                              {area.Warning}
                            </p>
                            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Warning</p>
                          </div>
                        </div>
                        
                        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(area.Healthy / area.total) * 100}%`, background: STATUS_COLORS.Healthy }} />
                          <div style={{ width: `${(area.Caution / area.total) * 100}%`, background: STATUS_COLORS.Caution }} />
                          <div style={{ width: `${(area.Warning / area.total) * 100}%`, background: STATUS_COLORS.Warning }} />
                        </div>
                        
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0', textAlign: 'right' }}>
                          Total: {area.total} items
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === 'equipment' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  {equipmentChartData.map((equip) => {
                    const total = equip.Healthy + equip.Caution + equip.Warning;
                    const equipPieData = [
                      { name: 'Healthy', value: equip.Healthy, color: STATUS_COLORS.Healthy },
                      { name: 'Caution', value: equip.Caution, color: STATUS_COLORS.Caution },
                      { name: 'Warning', value: equip.Warning, color: STATUS_COLORS.Warning }
                    ].filter(d => d.value > 0);
                    const equipHealthPercent = ((equip.Healthy / total) * 100).toFixed(0);
                    
                    return (
                      <div key={equip.name} className="card" style={{ padding: '20px', textAlign: 'center' }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{equip.name}</h4>
                        <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={equipPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {equipPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center'
                          }}>
                            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#00B1A9', fontFamily: '"Museo Sans", "IBM Plex Sans", sans-serif' }}>
                              {equipHealthPercent}%
                            </p>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px' }}>
                          <span style={{ color: '#00B1A9' }}>● {equip.Healthy}</span>
                          <span style={{ color: '#FDB924' }}>● {equip.Caution}</span>
                          <span style={{ color: '#E31837' }}>● {equip.Warning}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }}>Total: {total}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === 'alerts' && (
                <div className="scrollbar-thin" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {alertItemsAll.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00B1A9" strokeWidth="2" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22,4 12,14.01 9,11.01"/>
                      </svg>
                      <p>No alerts matching current filters</p>
                    </div>
                  ) : (
                    groupedAlerts.map((group, groupIndex) => (
                      <div key={group.equipmentType} style={{ marginBottom: groupIndex < groupedAlerts.length - 1 ? '24px' : 0 }}>
                        {/* Equipment Type Header */}
                        <div style={{
                          background: '#00B1A9',
                          color: '#ffffff',
                          padding: '10px 16px',
                          borderRadius: '8px 8px 0 0',
                          fontWeight: 600,
                          fontSize: '14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{group.equipmentType}</span>
                          <span style={{ 
                            background: 'rgba(255,255,255,0.2)', 
                            padding: '2px 10px', 
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {/* Items for this equipment type */}
                        <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                          {group.items.map((item, i) => (
                            <div 
                              key={i} 
                              className={`alert-row ${item.status === 'Warning' ? 'alert-warning' : 'alert-caution'}`}
                              style={{ 
                                borderRadius: i === group.items.length - 1 ? '0 0 8px 8px' : 0,
                                margin: 0,
                                borderBottom: i < group.items.length - 1 ? '1px solid #e5e7eb' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      background: item.status === 'Warning' ? 'rgba(227, 24, 55, 0.15)' : 'rgba(253, 185, 36, 0.15)',
                                      color: item.status === 'Warning' ? '#E31837' : '#FDB924'
                                    }}>
                                      {item.status}
                                    </span>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: item.criticality?.toLowerCase() === 'high' || item.criticality?.toLowerCase() === 'c1' ? 'rgba(227, 24, 55, 0.1)' : item.criticality?.toLowerCase() === 'medium' || item.criticality?.toLowerCase() === 'c2' ? 'rgba(253, 185, 36, 0.1)' : 'rgba(0, 177, 169, 0.1)',
                                      color: item.criticality?.toLowerCase() === 'high' || item.criticality?.toLowerCase() === 'c1' ? '#E31837' : item.criticality?.toLowerCase() === 'medium' || item.criticality?.toLowerCase() === 'c2' ? '#b8860b' : '#00B1A9'
                                    }}>
                                      {formatCriticality(item.criticality)}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.area}</span>
                                  </div>
                                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
                                    {item.functionalLocation}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                    {item.description}
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right', minWidth: '180px' }}>
                                  {item.notificationDate && (
                                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#6b7280' }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                      </svg>
                                      {formatDate(item.notificationDate)}
                                    </p>
                                  )}
                                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#E31837' }}>
                                    {item.alarmDescription}
                                  </p>
                                  {item.rectification && (
                                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                                      Status: {item.rectification}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {viewMode === 'aging' && (
                <div className="scrollbar-thin" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {agingItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00B1A9" strokeWidth="2" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      <p>No obsolescence data available</p>
                    </div>
                  ) : (
                    groupedAging.map((group, groupIndex) => (
                      <div key={group.equipmentType} style={{ marginBottom: groupIndex < groupedAging.length - 1 ? '24px' : 0 }}>
                        {/* Equipment Type Header */}
                        <div style={{
                          background: '#00B1A9',
                          color: '#ffffff',
                          padding: '10px 16px',
                          borderRadius: '8px 8px 0 0',
                          fontWeight: 600,
                          fontSize: '14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{group.equipmentType}</span>
                          <span style={{ 
                            background: 'rgba(255,255,255,0.2)', 
                            padding: '2px 10px', 
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {/* Table for this equipment type */}
                        <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Crit.</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Area</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Notif. Date</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Tag No.</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Description</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Alarm</th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item, i) => (
                                <tr 
                                  key={i} 
                                  style={{ 
                                    borderBottom: i < group.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                    background: i % 2 === 0 ? '#ffffff' : '#f9fafb'
                                  }}
                                >
                                  <td style={{ padding: '10px 16px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      background: item.status === 'Warning' ? 'rgba(227, 24, 55, 0.15)' : 'rgba(253, 185, 36, 0.15)',
                                      color: item.status === 'Warning' ? '#E31837' : '#FDB924'
                                    }}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 16px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: item.criticality?.toLowerCase() === 'high' || item.criticality?.toLowerCase() === 'c1' ? 'rgba(227, 24, 55, 0.1)' : item.criticality?.toLowerCase() === 'medium' || item.criticality?.toLowerCase() === 'c2' ? 'rgba(253, 185, 36, 0.1)' : 'rgba(0, 177, 169, 0.1)',
                                      color: item.criticality?.toLowerCase() === 'high' || item.criticality?.toLowerCase() === 'c1' ? '#E31837' : item.criticality?.toLowerCase() === 'medium' || item.criticality?.toLowerCase() === 'c2' ? '#b8860b' : '#00B1A9'
                                    }}>
                                      {formatCriticality(item.criticality)}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 16px', color: '#1f2937' }}>{item.area}</td>
                                  <td style={{ padding: '10px 16px', color: '#6b7280' }}>{formatDate(item.notificationDate)}</td>
                                  <td style={{ padding: '10px 16px', color: '#1f2937', fontWeight: 500 }}>{item.functionalLocation}</td>
                                  <td style={{ padding: '10px 16px', color: '#6b7280' }}>{item.description}</td>
                                  <td style={{ padding: '10px 16px', color: '#E31837' }}>{item.alarmDescription}</td>
                                  <td style={{ padding: '10px 16px', color: '#6b7280' }}>{item.rectification || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer style={{ textAlign: 'center', color: '#6b7280', fontSize: '12px', marginTop: '32px' }}>
            <p style={{ color: '#00B1A9', fontWeight: 500 }}>PETRONAS Chemicals Fertiliser Kedah • Instrument Health Dashboard</p>
            <p style={{ marginTop: '4px' }}>Last updated: {new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </footer>
        </>
      )}
    </div>
  );
}
