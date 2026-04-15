-- حل مؤقت: السماح لجميع المستخدمين المصادق عليهم برفع الصور
-- سنقوم بتقييد الوصول لاحقاً عبر الواجهة الأمامية
drop policy if exists "admins_can_upload_universities" on storage.objects;
drop policy if exists "admins_can_update_universities" on storage.objects;
drop policy if exists "admins_can_delete_universities" on storage.objects;

-- السماح للمستخدمين المصادق عليهم بالرفع
create policy "authenticated_upload_universities"
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