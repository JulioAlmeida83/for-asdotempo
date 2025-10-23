import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Photo } from '../lib/supabase';
import { getAllPhotos } from '../services/photoService';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();

    const channel = supabase
      .channel('photos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPhotos((current) => [...current, payload.new as Photo]);
          } else if (payload.eventType === 'DELETE') {
            setPhotos((current) => current.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadPhotos() {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllPhotos();
      setPhotos(data);
    } catch (err) {
      setError('Failed to load photos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return { photos, loading, error, refetch: loadPhotos };
}
