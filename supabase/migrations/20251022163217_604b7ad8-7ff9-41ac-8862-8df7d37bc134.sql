-- Fix storage RLS policies for universities bucket to allow only admins
drop policy if exists "authenticated_can_insert_universities_files" on storage.objects;
drop policy if exists "authenticated_can_update_universities_files" on storage.objects;
drop policy if exists "authenticated_can_delete_universities_files" on storage.objects;

-- Allow admins to insert files in universities bucket
create policy "admins_can_upload_universities"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'universities' 
  AND is_admin(auth.uid())
);

-- Allow admins to update files
create policy "admins_can_update_universities"
on storage.objects for update
to authenticated
using (
  bucket_id = 'universities' 
  AND is_admin(auth.uid())
)
with check (
  bucket_id = 'universities' 
  AND is_admin(auth.uid())
);

-- Allow admins to delete files
create policy "admins_can_delete_universities"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'universities' 
  AND is_admin(auth.uid())
);