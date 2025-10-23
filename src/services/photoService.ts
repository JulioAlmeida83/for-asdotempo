import { supabase } from '../lib/supabase';
import type { Photo } from '../lib/supabase';

export async function uploadPhoto(file: File): Promise<Photo | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    const { data, error: dbError } = await supabase
      .from('photos')
      .insert({
        filename: file.name,
        storage_path: filePath,
        public_url: publicUrl,
      })
      .select()
      .maybeSingle();

    if (dbError) {
      console.error('Database error:', dbError);
      await supabase.storage.from('photos').remove([filePath]);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function deletePhoto(photo: Photo): Promise<boolean> {
  try {
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photo.id);

    if (dbError) {
      console.error('Database delete error:', dbError);
      return false;
    }

    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([photo.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

export async function deleteAllPhotos(photos: Photo[]): Promise<boolean> {
  try {
    const photoIds = photos.map(p => p.id);
    const storagePaths = photos.map(p => p.storage_path);

    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .in('id', photoIds);

    if (dbError) {
      console.error('Database delete all error:', dbError);
      return false;
    }

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove(storagePaths);

      if (storageError) {
        console.error('Storage delete all error:', storageError);
      }
    }

    return true;
  } catch (error) {
    console.error('Delete all error:', error);
    return false;
  }
}

export async function getAllPhotos(): Promise<Photo[]> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch photos error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get all photos error:', error);
    return [];
  }
}
