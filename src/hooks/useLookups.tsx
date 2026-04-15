import { useState, useEffect } from 'react';

type Country = { id: string; name: string; name_ar?: string; slug: string; country_code?: string };
type Degree = { id: string; name: string; slug?: string };
type Certificate = { id: string; name: string };
type Subject = { id: string; name: string; slug: string };
type Discipline = { id: string; slug: string; name: string; name_ar?: string; name_en?: string };

export function useLookups() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-lookups`, {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          }
        });
        
        if (!res.ok) throw new Error('Failed to fetch lookups');
        
        const data = await res.json();
        
        if (data.ok) {
          setCountries(data.countries || []);
          setDegrees(data.degrees || []);
          setCerts(data.certificates || []);
          setSubjects(data.subjects || []);
          setDisciplines(data.disciplines || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (e: any) {
        console.error('Lookups fetch error:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLookups();
  }, []);

  return { countries, degrees, certs, subjects, disciplines, loading, error };
}
