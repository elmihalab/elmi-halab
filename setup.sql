-- ============================================================
--  إعداد قاعدة بيانات موقع شعبة الشؤون العلمية — مديرية أوقاف حلب
--  ------------------------------------------------------------
--  طريقة التشغيل:
--   ١. افتح مشروعك في Supabase ← SQL Editor ← New query
--   ٢. غيّر البريد في السطر الأخير من هذا الملف إلى بريدك
--   ٣. الصق الملف كله واضغط Run
--  يمكن تشغيله أكثر من مرة دون ضرر.
-- ============================================================

-- ---------- المشرفون: من يحق له التعديل ----------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- الأقسام ----------
create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kicker      text,
  description text,
  sort        integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- الروابط والملفات داخل الأقسام ----------
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid references public.sections(id) on delete cascade,
  title       text not null,
  description text,
  url         text,
  file_url    text,
  file_name   text,
  icon        text default 'link',
  badge       text,
  sort        integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- اللقاءات الشهرية ----------
create table if not exists public.meetings (
  id              uuid primary key default gen_random_uuid(),
  number          integer,
  title           text not null,
  meeting_date    date,
  meeting_time    text,
  duration        text,
  axes            text,
  guests          text,
  lecturer        text,
  join_url        text,
  form_url        text,
  recording_url   text,
  recommendations text,
  visible         boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------- بيانات الموقع العامة ----------
create table if not exists public.settings (
  key   text primary key,
  value text
);

-- ---------- الصلاحيات: الجميع يقرأ، والمشرف وحده يعدّل ----------
alter table public.sections enable row level security;
alter table public.items    enable row level security;
alter table public.meetings enable row level security;
alter table public.settings enable row level security;

drop policy if exists "sections read"  on public.sections;
drop policy if exists "sections admin" on public.sections;
create policy "sections read"  on public.sections for select using (visible or public.is_admin());
create policy "sections admin" on public.sections for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "items read"  on public.items;
drop policy if exists "items admin" on public.items;
create policy "items read"  on public.items for select using (visible or public.is_admin());
create policy "items admin" on public.items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "meetings read"  on public.meetings;
drop policy if exists "meetings admin" on public.meetings;
create policy "meetings read"  on public.meetings for select using (visible or public.is_admin());
create policy "meetings admin" on public.meetings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings read"  on public.settings;
drop policy if exists "settings admin" on public.settings;
create policy "settings read"  on public.settings for select using (true);
create policy "settings admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());

grant select on public.sections, public.items, public.meetings, public.settings to anon, authenticated;
grant insert, update, delete on public.sections, public.items, public.meetings, public.settings to authenticated;

-- ---------- مخزن الملفات (الكتب والمواد والصور) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "elmi files read"   on storage.objects;
drop policy if exists "elmi files insert" on storage.objects;
drop policy if exists "elmi files update" on storage.objects;
drop policy if exists "elmi files delete" on storage.objects;
create policy "elmi files read"   on storage.objects for select using (bucket_id = 'files');
create policy "elmi files insert" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_admin());
create policy "elmi files update" on storage.objects for update to authenticated using (bucket_id = 'files' and public.is_admin());
create policy "elmi files delete" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_admin());

-- ---------- ضع بريدك هنا بدل المثال (البريد الذي ستدخل به لوحة الإدارة) ----------
insert into public.admins (email) values ('ضع_بريدك_هنا@gmail.com')
on conflict (email) do nothing;
