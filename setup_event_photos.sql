-- ==============================================================================
-- SETUP EVENT PHOTOS TABLE
-- Please run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Create the event_photos table
CREATE TABLE IF NOT EXISTS public.event_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    album_name TEXT DEFAULT 'General Event Photos',
    title TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    size_bytes BIGINT,
    is_public BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add an index for faster lookups by event_id
CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON public.event_photos(event_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Policy: Public viewers can see photos that are marked as public
CREATE POLICY "Public can view public event photos" 
ON public.event_photos 
FOR SELECT 
USING (is_public = true);

-- Policy: Admins can do everything (Insert, Update, Delete, Select all)
-- (Assuming the same logic as other admin policies in the system using users table)
CREATE POLICY "Admins can manage event photos" 
ON public.event_photos 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('super_admin', 'event_admin', 'media_admin', 'admin')
  )
);
