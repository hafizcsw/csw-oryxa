-- Extensions
create extension if not exists pgcrypto;

-- SETTINGS
create table if not exists settings (
  id boolean primary key default true,
  site_name text default 'CSW Student Portal',
  currency text default 'USD',
  default_sort text default 'popularity',
  sliders jsonb default jsonb_build_object('fees_max', 10000, 'living_max', 10000),
  theme   jsonb default '{}'::jsonb,
  flags   jsonb default jsonb_build_object(
    'VOICE_ENABLED', false,
    'BOT_ENABLED', false,
    'CRM_INTEGRATION_ENABLED', false,
    'PAYMENTS_ENABLED', false,
    'ANALYTICS_ENABLED', true
  )
);

-- HOME ICONS (خدمات الواجهة)
create table if not exists home_icons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon_key text not null,
  route_path text not null,
  action_type text default 'route',
  service_id uuid,
  is_active boolean default true,
  "order" int default 0,
  analytics_tag text
);

-- COUNTRIES
create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  image_url text,
  page_content text
);

-- TESTIMONIALS (فيديو)
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  student_name text,
  video_url text,
  thumbnail_url text,
  quote text,
  "order" int default 0,
  featured boolean default false
);

-- POSTS (News/Blog/Static)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('news','blog','static')) default 'news',
  title text not null,
  slug text unique not null,
  excerpt text,
  body text,
  image_url text,
  featured boolean default false,
  published_at timestamptz default now()
);

-- FOOTER LINKS
create table if not exists footer_links (
  id uuid primary key default gen_random_uuid(),
  "group" text not null,
  text text not null,
  url text not null,
  "order" int default 0,
  is_active boolean default true
);

-- SERVICES & PACKAGES & PRICING
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  price numeric,
  currency text default 'USD',
  icon_key text,
  is_active boolean default true
);

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric,
  currency text default 'USD',
  included_services uuid[]
);

create table if not exists pricing_settings (
  id boolean primary key default true,
  dynamic_discount_enabled boolean default true,
  discount_pct int default 10,
  hint_threshold int default 3
);

-- درجات/شهادات (للفلاتر)
create table if not exists degrees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table if not exists certificate_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

-- فهارس أساسية
create index if not exists idx_posts_published_at on posts(published_at desc);
create index if not exists idx_home_icons_order on home_icons("order");

-- Enable RLS on public tables
alter table settings enable row level security;
alter table home_icons enable row level security;
alter table countries enable row level security;
alter table testimonials enable row level security;
alter table posts enable row level security;
alter table footer_links enable row level security;
alter table services enable row level security;
alter table packages enable row level security;
alter table pricing_settings enable row level security;
alter table degrees enable row level security;
alter table certificate_types enable row level security;

-- Public read access policies
create policy "Settings are publicly readable" on settings for select using (true);
create policy "Home icons are publicly readable" on home_icons for select using (true);
create policy "Countries are publicly readable" on countries for select using (true);
create policy "Testimonials are publicly readable" on testimonials for select using (true);
create policy "Posts are publicly readable" on posts for select using (true);
create policy "Footer links are publicly readable" on footer_links for select using (true);
create policy "Services are publicly readable" on services for select using (true);
create policy "Packages are publicly readable" on packages for select using (true);
create policy "Pricing settings are publicly readable" on pricing_settings for select using (true);
create policy "Degrees are publicly readable" on degrees for select using (true);
create policy "Certificate types are publicly readable" on certificate_types for select using (true);