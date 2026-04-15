-- حذف السياسات الحالية
drop policy if exists "public_select_universities" on storage.objects;
drop policy if exists "authenticated_insert_universities" on storage.objects;
drop policy if exists "authenticated_update_universities" on storage.objects;
drop policy if exists "authenticated_delete_universities" on storage.objects;

-- إنشاء سياسات جديدة للسماح لـ anon و authenticated
-- القراءة للجميع
create policy "allow_select_universities"
on storage.objects for select
using (bucket_id = 'universities');

-- الرفع لـ anon و authenticated
create policy "allow_insert_universities"
on storage.objects for insert
with check (bucket_id = 'universities');

-- التحديث لـ anon و authenticated
create policy "allow_update_universities"
on storage.objects for update
using (bucket_id = 'universities')
with check (bucket_id = 'universities');

-- الحذف لـ anon و authenticated
create policy "allow_delete_universities"
on storage.objects for delete
using (bucket_id = 'universities');