-- =====================================================================
--  EDENEL NETTOYAGE — schéma de la base Supabase
--  Comptes clients, commandes, rendez-vous, agenda, administrateurs.
--  Les écritures sensibles (commandes, rendez-vous) passent par les
--  fonctions serveur (supabase/functions) qui utilisent la clé service.
-- =====================================================================

-- ---------- Administrateurs (accès à /admin/) ----------
create table public.admins (
  email text primary key check (email = lower(email))
);

create or replace function public.est_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Profils clients ----------
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 120),
  tel text check (tel is null or char_length(tel) <= 40),
  numero_client text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- Commandes ----------
create table public.commandes (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  numero_client text,
  client_nom text,
  client_email text,
  client_tel text,
  lignes jsonb not null,
  adresse text,
  date_intervention date,
  heure_souhaitee text,
  ht numeric(10, 2) not null,
  ttc numeric(10, 2) not null,
  deplacement numeric(10, 2) not null default 0,
  trajets text[] not null default '{}',
  fidelite boolean not null default false,
  statut text not null default 'recue'
    check (statut in ('recue', 'planifiee', 'en_cours', 'terminee', 'annulee')),
  heure_planifiee text check (heure_planifiee is null or heure_planifiee ~ '^\d{2}:\d{2}$'),
  statut_facture text not null default 'en_attente'
    check (statut_facture in ('en_attente', 'emise', 'payee')),
  date_br date,
  br_observations text,
  google_event_id text,
  created_at timestamptz not null default now()
);
create index commandes_user_idx on public.commandes (user_id);
create index commandes_date_idx on public.commandes (date_intervention);

-- ---------- Rendez-vous ----------
create table public.rdv (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  heure text not null check (heure ~ '^\d{2}:\d{2}$'),
  duree integer not null default 30 check (duree between 10 and 240),
  nom text not null,
  email text not null,
  tel text not null,
  message text,
  statut text not null default 'demande' check (statut in ('demande', 'confirme', 'annule')),
  user_id uuid references auth.users (id) on delete set null,
  google_event_id text,
  created_at timestamptz not null default now()
);
-- Un créneau ne peut être pris qu'une fois (tant que le RDV n'est pas annulé)
create unique index rdv_creneau_unique on public.rdv (date, heure) where statut <> 'annule';

-- ---------- Agenda : créneaux par jour de semaine (0 = dimanche … 6 = samedi) ----------
create table public.agenda_regles (
  jour smallint primary key check (jour between 0 and 6),
  creneaux text[] not null default '{}'
);
insert into public.agenda_regles (jour, creneaux)
select j, array['08:00', '09:30', '11:00', '14:00', '15:30', '17:00', '18:30']
from generate_series(0, 6) as j;

-- Jours fermés (congés, jours complets…)
create table public.agenda_fermetures (
  date date primary key,
  motif text
);

-- Réglages généraux (une seule ligne)
create table public.reglages (
  id boolean primary key default true check (id),
  rdv_duree integer not null default 30,         -- minutes
  rdv_delai_heures integer not null default 12,  -- délai minimum avant un RDV
  rdv_horizon_jours integer not null default 60, -- jusqu'à quand on peut réserver
  rdv_confirmation_auto boolean not null default true -- true : le créneau est confirmé dès la réservation
);
insert into public.reglages default values;

-- ---------- Journal anti-abus des envois (limite par IP) ----------
create table public.envois (
  id bigint generated always as identity primary key,
  cle text not null,
  created_at timestamptz not null default now()
);
create index envois_cle_idx on public.envois (cle, created_at);

-- =====================================================================
--  Sécurité : Row Level Security
-- =====================================================================
alter table public.admins enable row level security;
alter table public.profils enable row level security;
alter table public.commandes enable row level security;
alter table public.rdv enable row level security;
alter table public.agenda_regles enable row level security;
alter table public.agenda_fermetures enable row level security;
alter table public.reglages enable row level security;
alter table public.envois enable row level security;

create policy "admins : lecture admin" on public.admins
  for select to authenticated using (public.est_admin());

create policy "profils : lecture du sien ou admin" on public.profils
  for select to authenticated using (id = auth.uid() or public.est_admin());
create policy "profils : modification du sien" on public.profils
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "commandes : lecture des siennes ou admin" on public.commandes
  for select to authenticated using (user_id = auth.uid() or public.est_admin());
create policy "commandes : modification admin" on public.commandes
  for update to authenticated using (public.est_admin()) with check (public.est_admin());

create policy "rdv : lecture admin" on public.rdv
  for select to authenticated using (public.est_admin());
create policy "rdv : modification admin" on public.rdv
  for update to authenticated using (public.est_admin()) with check (public.est_admin());

create policy "agenda : lecture publique" on public.agenda_regles
  for select to anon, authenticated using (true);
create policy "agenda : écriture admin" on public.agenda_regles
  for all to authenticated using (public.est_admin()) with check (public.est_admin());

create policy "fermetures : lecture publique" on public.agenda_fermetures
  for select to anon, authenticated using (true);
create policy "fermetures : écriture admin" on public.agenda_fermetures
  for all to authenticated using (public.est_admin()) with check (public.est_admin());

create policy "reglages : lecture publique" on public.reglages
  for select to anon, authenticated using (true);
create policy "reglages : écriture admin" on public.reglages
  for update to authenticated using (public.est_admin()) with check (public.est_admin());

-- Le numéro client, l'email et l'identifiant d'un profil ne se modifient pas côté client
revoke update on public.profils from anon, authenticated;
grant update (nom, tel) on public.profils to authenticated;

-- =====================================================================
--  Fonctions appelables depuis le site (RPC)
-- =====================================================================

-- Crée (ou met à jour) le profil de l'utilisateur connecté.
-- p_numero : numéro client existant (ancien compte), repris s'il est libre.
create or replace function public.creer_profil(p_nom text, p_tel text, p_numero text default null)
returns public.profils
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profil public.profils;
  v_numero text := upper(nullif(trim(coalesce(p_numero, '')), ''));
  v_initiales text;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  if char_length(trim(coalesce(p_nom, ''))) < 2 then
    raise exception 'Nom obligatoire' using errcode = '22023';
  end if;

  select * into v_profil from public.profils where id = v_uid;
  if found then
    update public.profils set nom = trim(p_nom), tel = nullif(trim(p_tel), '')
      where id = v_uid returning * into v_profil;
    return v_profil;
  end if;

  if v_numero is not null then
    if v_numero !~ '^[A-Z]{1,4}-?\d{6,8}(-?\d{1,3})?$' then
      raise exception 'Numéro client non reconnu' using errcode = '22023';
    end if;
    if exists (select 1 from public.profils where numero_client = v_numero) then
      raise exception 'Ce numéro client est déjà associé à un autre compte' using errcode = '23505';
    end if;
  else
    select coalesce(nullif(left(string_agg(upper(left(m, 1)), ''), 4), ''), 'CL')
      into v_initiales
      from regexp_split_to_table(trim(p_nom), '\s+') as m;
    loop
      v_numero := v_initiales || '-' || to_char(now() at time zone 'Europe/Paris', 'YYYYMMDD')
        || '-' || (10 + floor(random() * 90))::int;
      exit when not exists (select 1 from public.profils where numero_client = v_numero);
    end loop;
  end if;

  insert into public.profils (id, nom, tel, numero_client)
    values (v_uid, trim(p_nom), nullif(trim(p_tel), ''), v_numero)
    returning * into v_profil;
  return v_profil;
end;
$$;

-- Résumé fidélité de l'utilisateur connecté (commandes non annulées)
create or replace function public.mon_resume()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'commandes', count(*),
    'cumul_ttc', coalesce(sum(ttc), 0),
    'eligible_fidelite', count(*) >= 4 or coalesce(sum(ttc), 0) >= 400
  )
  from public.commandes
  where user_id = auth.uid() and statut <> 'annulee';
$$;

revoke execute on function public.creer_profil(text, text, text) from public, anon;
grant execute on function public.creer_profil(text, text, text) to authenticated;
revoke execute on function public.mon_resume() from public, anon;
grant execute on function public.mon_resume() to authenticated;
grant execute on function public.est_admin() to anon, authenticated;
