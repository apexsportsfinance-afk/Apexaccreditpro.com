/**
 * photoApi.js
 * Wrapper for uploading event photos and managing the Supabase event_photos table.
 */
import { supabase } from "./supabase";

export const PhotoAPI = {
  /**
   * Upload multiple photos to the local Express server.
   * Expected format of files: Array of JS File/Blob objects.
   * Returns an array of uploaded file data: { url, filename, originalName }
   */
  uploadPhotosToLocal: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('photos', file);
    });

    // Determine the upload endpoint based on environment (Vite proxy vs direct)
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    
    // Check if we're calling via proxy (i.e. browser current origin)
    const isProxy = window.location.port !== "3002" && window.location.hostname !== "127.0.0.1";
    const uploadUrl = isProxy ? '/api/upload/photos' : `${baseUrl}/api/upload/photos`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files;
  },

  /**
   * Insert a new photo record into Supabase event_photos table.
   */
  savePhotoRecord: async (photoData) => {
    const { data, error } = await supabase
      .from("event_photos")
      .insert([photoData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get all photos for a specific event.
   */
  getPhotosByEvent: async (eventId, publicOnly = false) => {
    let query = supabase
      .from("event_photos")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (publicOnly) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Delete a photo record.
   */
  deletePhotoRecord: async (photoId) => {
    const { error } = await supabase
      .from("event_photos")
      .delete()
      .eq("id", photoId);

    if (error) throw error;
  },

  /**
   * Update photo visibility.
   */
  updatePhotoVisibility: async (photoId, isPublic) => {
    const { data, error } = await supabase
      .from("event_photos")
      .update({ is_public: isPublic })
      .eq("id", photoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  
  /**
   * Update photo details (album, title).
   */
  updatePhotoDetails: async (photoId, updates) => {
    const { data, error } = await supabase
      .from("event_photos")
      .update(updates)
      .eq("id", photoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
