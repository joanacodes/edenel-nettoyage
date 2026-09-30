// Constantes tarifaires utilisées côté serveur. Elles sont recopiées depuis
// data/tarifs.yaml par le script de déploiement (scripts/deployer-supabase.sh).
export const DEPLACEMENT = Number(Deno.env.get("TARIF_DEPLACEMENT") ?? "15");
export const DEPLACEMENT_OFFERT_DES = Number(Deno.env.get("TARIF_DEPLACEMENT_OFFERT_DES") ?? "0");
export const TVA = Number(Deno.env.get("TARIF_TVA") ?? "0.2");

export const r2 = (x: number) => Math.round(x * 100) / 100;

/** Même clé que le site : un déplacement = une date + une adresse. */
export function cleTrajet(date: string, adresse: string): string {
  return date + "|" + String(adresse ?? "").toLowerCase().replace(/[\s,]+/g, " ").trim();
}
