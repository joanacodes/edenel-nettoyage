-- Numérotation des factures : continue et chronologique par année (obligation légale).
alter table public.commandes
  add column facture_numero text unique,
  add column facture_date date;

create table public.compteurs_factures (
  annee integer primary key,
  dernier integer not null default 0
);
alter table public.compteurs_factures enable row level security;

-- Attribue (une seule fois) un numéro de facture à une commande. Réservé aux administrateurs.
create or replace function public.attribuer_facture(p_commande text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_cmd public.commandes;
  v_annee integer := extract(year from (now() at time zone 'Europe/Paris'))::int;
  v_n integer;
begin
  if not public.est_admin() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  select * into v_cmd from public.commandes where id = p_commande for update;
  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;
  if v_cmd.facture_numero is null then
    insert into public.compteurs_factures (annee, dernier) values (v_annee, 1)
      on conflict (annee) do update set dernier = public.compteurs_factures.dernier + 1
      returning dernier into v_n;
    update public.commandes
      set facture_numero = 'FAC-' || v_annee || '-' || lpad(v_n::text, 5, '0'),
          facture_date = (now() at time zone 'Europe/Paris')::date
      where id = p_commande
      returning * into v_cmd;
  end if;
  return json_build_object('numero', v_cmd.facture_numero, 'date', v_cmd.facture_date);
end;
$$;
revoke execute on function public.attribuer_facture(text) from public, anon;
grant execute on function public.attribuer_facture(text) to authenticated;
