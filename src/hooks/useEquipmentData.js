import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useEquipmentData() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // Check if Supabase is configured
  const isSupabaseConfigured = supabase !== null;

  // Fetch all equipment data from Supabase
  const fetchEquipment = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      setError('Supabase is not configured. Please set environment variables.');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch metadata
      const metaResult = await supabase
        .from('dashboard_meta')
        .select('last_refreshed_at')
        .eq('id', 1)
        .single();

      // Fetch all equipment data with pagination (Supabase default limit is 1000)
      let allEquipment = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .from('equipment')
          .select('*')
          .order('area', { ascending: true })
          .order('equipment_type', { ascending: true })
          .range(from, from + pageSize - 1);

        if (fetchError) throw fetchError;

        allEquipment = allEquipment.concat(data);
        hasMore = data.length === pageSize;
        from += pageSize;
      }

      const equipmentResult = { data: allEquipment };

      // Set last refreshed timestamp (may not exist yet)
      if (metaResult.data?.last_refreshed_at) {
        setLastRefreshedAt(new Date(metaResult.data.last_refreshed_at));
      }

      // Transform database format to app format
      const transformedData = equipmentResult.data.map(item => ({
        area: item.area,
        equipmentType: item.equipment_type || '',
        description: item.description || '',
        functionalLocation: item.functional_location || '',
        criticality: item.criticality || '',
        status: item.status,
        alarmDescription: item.alarm_description || '',
        rectification: item.rectification || '',
        notificationDate: item.notification_date || ''
      }));

      setData(transformedData.length > 0 ? transformedData : null);
      setIsLoading(false);
      return transformedData;
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError(`Failed to load data: ${err.message}`);
      setIsLoading(false);
      return [];
    }
  }, [isSupabaseConfigured]);

  // Save equipment data to Supabase (UPSERT based on functional_location)
  const saveEquipment = useCallback(async (equipmentData) => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set environment variables.');
      return false;
    }

    if (!equipmentData || equipmentData.length === 0) {
      setError('No data to save.');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Transform app format to database format
      const dbRecords = equipmentData.map(item => ({
        area: item.area,
        status: item.status,
        equipment_type: item.equipmentType || null,
        description: item.description || null,
        functional_location: item.functionalLocation || null,
        criticality: item.criticality || null,
        alarm_description: item.alarmDescription || null,
        rectification: item.rectification || null,
        notification_date: parseDate(item.notificationDate)
      }));

      // Delete existing data first, then insert new data
      // This is simpler and doesn't require unique constraints
      const { error: deleteError } = await supabase
        .from('equipment')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      // Insert all new records
      const { error: insertError } = await supabase
        .from('equipment')
        .insert(dbRecords);

      if (insertError) throw insertError;

      // Update the last refreshed timestamp
      const now = new Date();
      const { error: metaError } = await supabase
        .from('dashboard_meta')
        .upsert({
          id: 1,
          last_refreshed_at: now.toISOString(),
          refreshed_by: 'Admin'
        });

      if (metaError) {
        console.warn('Failed to update refresh timestamp:', metaError);
      } else {
        setLastRefreshedAt(now);
      }

      setData(equipmentData);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error('Error saving equipment:', err);
      setError(`Failed to save data: ${err.message}`);
      setIsSaving(false);
      return false;
    }
  }, [isSupabaseConfigured]);

  // Clear all equipment data from Supabase
  const clearAllData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please set environment variables.');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Delete all records
      const { error: deleteError } = await supabase
        .from('equipment')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq is a workaround for "delete all")

      if (deleteError) throw deleteError;

      setData(null);
      setIsSaving(false);
      return true;
    } catch (err) {
      console.error('Error clearing data:', err);
      setError(`Failed to clear data: ${err.message}`);
      setIsSaving(false);
      return false;
    }
  }, [isSupabaseConfigured]);

  // Clear error message
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load data on initial mount
  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  return {
    data,
    setData,
    isLoading,
    isSaving,
    error,
    lastRefreshedAt,
    isSupabaseConfigured,
    fetchEquipment,
    saveEquipment,
    clearAllData,
    clearError
  };
}

// Helper function to parse various date formats to ISO date string
function parseDate(dateValue) {
  if (!dateValue) return null;

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  let date;

  // Handle Excel serial date number
  if (typeof dateValue === 'number') {
    date = new Date((dateValue - 25569) * 86400 * 1000);
  }
  // Handle string date
  else if (typeof dateValue === 'string') {
    // Try DD-MMM-YYYY format (e.g., "15-Nov-2025")
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

  if (!date || isNaN(date.getTime())) return null;

  // Return ISO date string (YYYY-MM-DD)
  return date.toISOString().split('T')[0];
}
