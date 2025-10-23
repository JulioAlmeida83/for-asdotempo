/*
  # Create Photos Storage and Table

  ## Overview
  This migration sets up the infrastructure for storing and managing photos that will be synchronized across all devices.

  ## Changes

  1. Storage Bucket
    - Creates a public storage bucket named `photos` for storing image files
    - Configured with public access for reading images

  2. New Tables
    - `photos`
      - `id` (uuid, primary key) - Unique identifier for each photo
      - `filename` (text) - Original filename of the uploaded photo
      - `storage_path` (text) - Path to the file in Supabase Storage
      - `public_url` (text) - Public URL to access the photo
      - `created_at` (timestamptz) - Timestamp of when the photo was uploaded

  3. Security
    - Enable RLS on `photos` table
    - Add policy to allow anyone to read photos (public access for all devices)
    - Add policy to allow anyone to insert photos (allow uploads from any device)
    - Add policy to allow anyone to delete photos (allow removal from any device)
    - Configure storage bucket policies for public read and authenticated upload

  ## Notes
  - Photos are publicly accessible to enable cross-device synchronization without authentication
  - All devices can upload, view, and delete photos
  - Files are stored in Supabase Storage with unique filenames to prevent conflicts
*/

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view photos"
  ON photos
  FOR SELECT
  TO public
  USING (true);

-- Allow public insert
CREATE POLICY "Anyone can upload photos"
  ON photos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public delete
CREATE POLICY "Anyone can delete photos"
  ON photos
  FOR DELETE
  TO public
  USING (true);

-- Storage policies for the photos bucket
CREATE POLICY "Public read access for photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'photos');

CREATE POLICY "Anyone can upload photos to bucket"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can delete photos from bucket"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'photos');