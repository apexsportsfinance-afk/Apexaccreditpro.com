/**
 * photoApi.js
 * Wrapper for uploading event photos and managing the Supabase event_photos table.
 */
import { supabase } from "./supabase";

export const PhotoAPI = {
  uploadPhotosToLocal: async (files) => {
    const uploadedFiles = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `events/${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('accreditation-files')
        .upload(fileName, file, { upsert: false });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('accreditation-files')
        .getPublicUrl(fileName);

      uploadedFiles.push({
        url: urlData.publicUrl,
        filename: fileName,
        originalName: file.name
      });
    }

    return uploadedFiles;
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
