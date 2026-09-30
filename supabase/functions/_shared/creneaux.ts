// Calcul des créneaux de rendez-vous disponibles.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ajouterJours, aujourdhuiParis, jourSemaine, parisVersDate } from "./temps.ts";
import { occupations } from "./google.ts";

export type Reglages = { rdv_duree: number; rdv_delai_heures: number; rdv_horizon_jours: number; rdv_confirmation_auto: boolean };

export async function lireReglages(db: SupabaseClient): Promise<Reglages> {
  const { data } = await db.from("reglages").select("*").maybeSingle();
  return { rdv_duree: 30, rdv_delai_heures: 12, rdv_horizon_jours: 60, rdv_confirmation_auto: true, ...(data ?? {}) };
}

/** Créneaux libres, par date, entre `debut` et `fin` (AAAA-MM-JJ, inclus). */
export async function creneauxLibres(db: SupabaseClient, debut: string, fin: string, reg?: Reglages): Promise<Record<string, string[]>> {
  const r = reg ?? await lireReglages(db);
  const auj = aujourdhuiParis();
  const limite = ajouterJours(auj, r.rdv_horizon_jours);
  if (debut < auj) debut = auj;
  if (fin > limite) fin = limite;
  const res: Record<string, string[]> = {};
  if (debut > fin) return res;

  const [regles, fermetures, pris, occupe] = await Promise.all([
    db.from("agenda_regles").select("jour, creneaux"),
    db.from("agenda_fermetures").select("date").gte("date", debut).lte("date", fin),
    db.from("rdv").select("date, heure").neq("statut", "annule").gte("date", debut).lte("date", fin),
    occupations(debut, fin).catch((e) => { console.error("Google freeBusy :", e); return []; }),
  ]);
  const parJour = new Map<number, string[]>((regles.data ?? []).map((x) => [x.jour, x.creneaux ?? []]));
  const fermes = new Set((fermetures.data ?? []).map((x) => x.date));
  const occupes = new Set((pris.data ?? []).map((x) => `${x.date}|${x.heure}`));
  const minimum = Date.now() + r.rdv_delai_heures * 3_600_000;

  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) {
    if (fermes.has(d)) continue;
    const libres = (parJour.get(jourSemaine(d)) ?? []).filter((h) => {
      if (occupes.has(`${d}|${h}`)) return false;
      const t0 = parisVersDate(d, h).getTime(), t1 = t0 + r.rdv_duree * 60_000;
      if (t0 < minimum) return false;
      return !occupe.some((o) => o.debut < t1 && o.fin > t0);
    }).sort();
    if (libres.length) res[d] = libres;
  }
  return res;
}
