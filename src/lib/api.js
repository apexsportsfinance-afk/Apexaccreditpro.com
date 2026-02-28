import { supabase } from './supabase';

export const AccreditationsAPI = {
  getByEventId: async (eventId) => {
    const { data, error } = await supabase
      .from('accreditations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },
  
  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('accreditations')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data;
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('accreditations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};

export const EventsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
};

export const ZonesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  getByEventId: async (eventId) => {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .eq('event_id', eventId);
    
    if (error) throw error;
    return data || [];
  }
};
