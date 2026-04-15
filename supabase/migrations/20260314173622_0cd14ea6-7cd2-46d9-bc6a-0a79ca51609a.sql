UPDATE universities 
SET logo_url = 'https://alkhaznaqdlxygeznapt.supabase.co/storage/v1/object/public/university-logos/default/app-logo.png',
    logo_source = 'default'
WHERE logo_source = 'uniranks' AND is_active = true;