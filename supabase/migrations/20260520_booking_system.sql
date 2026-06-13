-- 1. Create table for Booking Configuration per Event
CREATE TABLE IF NOT EXISTS public.booking_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Event Slot Booking',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    allowed_categories TEXT[] DEFAULT '{}',
    slots JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_event_booking_config UNIQUE (event_id)
);

-- 2. Create table for Participant Booking Choices
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    accreditation_id UUID NOT NULL REFERENCES public.accreditations(id) ON DELETE CASCADE,
    slot_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_accreditation_booking UNIQUE (event_id, accreditation_id)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.booking_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Allow anyone to read the booking config (needed for the public scan page)
DROP POLICY IF EXISTS "Public Read Booking Configs" ON public.booking_configs;
CREATE POLICY "Public Read Booking Configs" ON public.booking_configs
    FOR SELECT USING (true);

-- Allow authenticated admins to manage configs
DROP POLICY IF EXISTS "Admins Manage Booking Configs" ON public.booking_configs;
CREATE POLICY "Admins Manage Booking Configs" ON public.booking_configs
    FOR ALL TO authenticated USING (true);

-- Allow public read of bookings to count slot occupancy dynamically on frontend
DROP POLICY IF EXISTS "Public Read Bookings" ON public.bookings;
CREATE POLICY "Public Read Bookings" ON public.bookings
    FOR SELECT USING (true);

-- Allow participants to make, change, or delete their own booking via anon/public
DROP POLICY IF EXISTS "Public Manage Personal Bookings" ON public.bookings;
CREATE POLICY "Public Manage Personal Bookings" ON public.bookings
    FOR ALL USING (true);
