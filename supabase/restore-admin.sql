-- Recreates the admin account lennydany3@gmail.com and gives it the admin role.
-- Run once in the Supabase SQL editor. Change the password after signing in.

do $$
declare
  v_email    text := 'lennydany3@gmail.com';
  v_password text := 'Lenny@123';
  v_id       uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    -- Account already exists: just reset its password and confirm it.
    update auth.users
    set encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_id;
  end if;

  -- The app checks profiles.role = 'admin' (a signup trigger may have already
  -- created the row, so upsert).
  insert into public.profiles (id, role)
  values (v_id, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;

-- Check: should return one row with role = admin
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'lennydany3@gmail.com';
