-- First create these three users in Authentication > Users with Auto Confirm enabled.
-- Edit the addresses below if you used different emails. This file contains no passwords.
update auth.users as account
set raw_app_meta_data = coalesce(account.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('staff_role', staff.role_name)
from (values
  ('admin@raft.example', 'admin'),
  ('scheduler@raft.example', 'scheduler'),
  ('counselor@raft.example', 'counselor')
) as staff(email, role_name)
where lower(account.email) = staff.email
returning account.email, account.raw_app_meta_data->>'staff_role' as staff_role;
