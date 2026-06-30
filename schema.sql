-- ==========================================
-- 1. PROFILES SCHEMA (User profiles linked to Auth)
-- ==========================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- ==========================================
-- 2. FLIGHTS SCHEMA (Global schedule database)
-- ==========================================
create table public.flights (
  id uuid default gen_random_uuid() primary key,
  flight_number text not null unique,
  airline text not null,
  departure_airport text not null,
  arrival_airport text not null,
  departure_time timestamp with time zone not null,
  arrival_time timestamp with time zone not null,
  price numeric not null,
  status text default 'scheduled' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.flights enable row level security;

create policy "Flights are viewable by everyone" on public.flights
  for select using (true);

-- ==========================================
-- 3. BOOKINGS SCHEMA (User flight reservations)
-- ==========================================
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  flight_id uuid references public.flights(id) on delete cascade not null,
  booking_reference text not null unique,
  seat_number text,
  status text default 'confirmed' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bookings enable row level security;

create policy "Users can view their own bookings" on public.bookings
  for select using (auth.uid() = user_id);

create policy "Users can create their own bookings" on public.bookings
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own bookings" on public.bookings
  for update using (auth.uid() = user_id);

-- ==========================================
-- 4. SUPPORT TICKETS SCHEMA (Support anomalies log)
-- ==========================================
create table public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  description text not null,
  status text default 'open' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.support_tickets enable row level security;

create policy "Users can view their own support tickets" on public.support_tickets
  for select using (auth.uid() = user_id);

create policy "Users can create support tickets" on public.support_tickets
  for insert with check (auth.uid() = user_id);

-- ==========================================
-- 5. PROFILE TRIGGER ON USER SIGN UP
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 6. SEED DUMMY DATA FOR FLIGHTS
-- ==========================================
insert into public.flights (flight_number, airline, departure_airport, arrival_airport, departure_time, arrival_time, price, status)
values
  ('AR-101', 'Aether Airways', 'LAX', 'HND', now() + interval '2 days', now() + interval '2 days 11 hours', 850.00, 'scheduled'),
  ('AR-204', 'Neo-Tokyo Shuttles', 'SFO', 'HND', now() + interval '3 days 4 hours', now() + interval '3 days 15 hours', 920.00, 'scheduled'),
  ('AR-502', 'Nebula Jetstreams', 'JFK', 'LHR', now() + interval '1 day 8 hours', now() + interval '1 day 15 hours', 540.00, 'scheduled'),
  ('AR-909', 'Cybernetic Air', 'DXB', 'CDG', now() + interval '4 days', now() + interval '4 days 7 hours', 710.00, 'scheduled')
on conflict (flight_number) do update set
  departure_time = excluded.departure_time,
  price = excluded.price;

-- ==========================================
-- 7. E-TICKETS SCHEMA (Boarding passes generated post-booking)
-- ==========================================
create table public.e_tickets (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null unique,
  user_id uuid references public.profiles(id) on delete cascade not null,
  qr_data text not null,
  status text default 'valid' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.e_tickets enable row level security;

create policy "Users can view their own e_tickets" on public.e_tickets
  for select using (auth.uid() = user_id);

create policy "Users can insert their own e_tickets" on public.e_tickets
  for insert with check (auth.uid() = user_id);
