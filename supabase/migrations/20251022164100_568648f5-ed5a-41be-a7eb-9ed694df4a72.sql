-- حذف جميع السياسات القديمة على universities bucket
drop policy if exists "Admins can upload university images" on storage.objects;
drop policy if exists "Admins can update university images" on storage.objects;
drop policy if exists "Admins can delete university images" on storage.objects;
drop policy if exists "admins_can_upload_universities" on storage.objects;
drop policy if exists "admins_can_update_universities" on storage.objects;
drop policy if exists "admins_can_delete_universities" on storage.objects;
drop policy if exists "authenticated_upload_universities" on storage.objects;
drop policy if exists "authenticated_update_universities" on storage.objects;
drop policy if exists "authenticated_delete_universities" on storage.objects;

-- إنشاء سياسات جديدة للمستخدمين المصادق عليهم
-- السماح بالقراءة لجميع المستخدمين (الـ bucket عام بالفعل)
create policy "public_select_universities"
on storage.objects for select
to public
using (bucket_id = 'universities');

-- السماح للمستخدمين المصادق عليهم بالرفع
create policy "authenticated_insert_universities"
on storage.objects for insert
to authenticated
with check (bucket_id = 'universities');

-- السماح بالتحديث
create policy "authenticated_update_universities"
on storage.objects for update
to authenticated
using (bucket_id = 'universities')
with check (bucket_id = 'universities');

-- السماح بالحذف
create policy "authenticated_delete_universities"
on storage.objects for delete
to authenticated
using (bucket_id = 'universities');