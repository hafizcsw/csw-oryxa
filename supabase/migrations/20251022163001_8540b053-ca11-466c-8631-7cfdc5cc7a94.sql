-- Fix RLS policies for universities storage bucket
-- Drop existing policies
drop policy if exists "admins_can_insert_universities_files" on storage.objects;
drop policy if exists "admins_can_update_universities_files" on storage.objects;
drop policy if exists "admins_can_delete_universities_files" on storage.objects;

-- Allow authenticated users to insert files in universities bucket
create policy "authenticated_can_insert_universities_files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'universities');

-- Allow authenticated users to update their files
create policy "authenticated_can_update_universities_files"
on storage.objects for update
to authenticated
using (bucket_id = 'universities')
with check (bucket_id = 'universities');

-- Allow authenticated users to delete files
create policy "authenticated_can_delete_universities_files"
on storage.objects for delete
to authenticated
using (bucket_id = 'universities');