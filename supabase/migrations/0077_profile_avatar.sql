-- Add avatar_url column to profiles for organizer profile pictures
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
