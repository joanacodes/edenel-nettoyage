// Réponses HTTP, CORS et lecture des requêtes — partagé par toutes les fonctions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

const ORIGINES = (Deno.env.get("SITE_ORIGINS") ?? "*").split(",").map((o) => o.trim()).filter(Boolean);

function enTetesCors(req: Request): Record<string, string> {
  const origine = req.headers.get("origin") ?? "";
  const autorise = ORIGINES.includes("*") ? "*" : (ORIGINES.includes(origine) ? origine : ORIGINES[0]);
  return {
    "Access-Control-Allow-Origin": autorise,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function repondre(req: Request, donnees: unknown, statut = 200): Response {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { ...enTetesCors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function erreur(req: Request, message: string, statut = 400): Response {
  return repondre(req, { ok: false, erreur: message }, statut);
}

/** Enveloppe commune : CORS, préflight, erreurs inattendues. */
export function servir(gestion: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: enTetesCors(req) });
    try {
      return await gestion(req);
    } catch (e) {
      if (e instanceof ErreurClient) return erreur(req, e.message, e.statut);
      console.error(e);
      return erreur(req, "Erreur interne — réessayez dans un instant.", 500);
    }
  });
}

export class ErreurClient extends Error {
  constructor(message: string, public statut = 400) { super(message); }
}

/** Client Supabase avec la clé service (contourne la RLS : à n'utiliser que côté serveur). */
export function adminDb(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Utilisateur connecté (jeton de session envoyé par le site), ou null. */
export async function utilisateur(req: Request, db: SupabaseClient): Promise<User | null> {
  const jeton = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jeton || jeton.split(".").length !== 3) return null;
  const { data, error } = await db.auth.getUser(jeton);
  if (error || !data?.user) return null;
  return data.user;
}

export async function estAdmin(db: SupabaseClient, email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const { data } = await db.from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

export async function lireJson(req: Request, maxOctets = 200_000): Promise<Record<string, unknown>> {
  const texte = await req.text();
  if (texte.length > maxOctets) throw new ErreurClient("Requête trop volumineuse.", 413);
  try {
    const d = JSON.parse(texte);
    if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error();
    return d as Record<string, unknown>;
  } catch {
    throw new ErreurClient("Requête invalide.");
  }
}

/* ---------- Validation ---------- */
export function texte(v: unknown, max = 500, requis = false, nom = "champ"): string {
  const s = typeof v === "string" ? v.trim() : (v == null ? "" : String(v).trim());
  if (requis && !s) throw new ErreurClient(`Merci d'indiquer : ${nom}.`);
  if (s.length > max) throw new ErreurClient(`${nom} : texte trop long.`);
  return s;
}
export function email(v: unknown, requis = true): string {
  const s = texte(v, 254, requis, "email").toLowerCase();
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new ErreurClient("Adresse email invalide.");
  return s;
}
export function dateIso(v: unknown, requis = true): string {
  const s = texte(v, 10, requis, "date");
  if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + "T12:00:00Z")))) throw new ErreurClient("Date invalide.");
  return s;
}
export function heure(v: unknown, requis = false): string {
  const s = texte(v, 5, requis, "heure");
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new ErreurClient("Heure invalide.");
  return s;
}

/* ---------- Anti-abus : nombre d'envois par adresse IP ---------- */
export async function limiter(req: Request, db: SupabaseClient, action: string, max: number, fenetreMinutes: number) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  const empreinte = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|edenel"))))
    .slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  const cle = `${action}:${empreinte}`;
  const depuis = new Date(Date.now() - fenetreMinutes * 60_000).toISOString();
  const { count } = await db.from("envois").select("id", { count: "exact", head: true }).eq("cle", cle).gte("created_at", depuis);
  if ((count ?? 0) >= max) throw new ErreurClient("Trop de demandes envoyées depuis cette connexion — réessayez dans un moment ou écrivez-nous par email.", 429);
  await db.from("envois").insert({ cle });
  // Ménage : on ne garde que 2 jours d'historique
  if (Math.random() < 0.05) await db.from("envois").delete().lt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
}
