// Google Agenda (facultatif) — via un « compte de service » Google Cloud gratuit,
// auquel l'agenda EDENEL est partagé avec le droit « Modifier les événements ».
// Variables : GOOGLE_SA_EMAIL, GOOGLE_SA_KEY (clé privée PEM), GOOGLE_CALENDAR_ID.
import { ajouterMinutes, parisVersDate } from "./temps.ts";

const SA_EMAIL = Deno.env.get("GOOGLE_SA_EMAIL") ?? "";
const SA_CLE = (Deno.env.get("GOOGLE_SA_KEY") ?? "").replace(/\\n/g, "\n");
const AGENDA = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "";
const API = "https://www.googleapis.com/calendar/v3";

export const googleActif = () => !!(SA_EMAIL && SA_CLE && AGENDA);

let jetonCache: { valeur: string; expire: number } | null = null;

function b64url(octets: Uint8Array | string): string {
  const o = typeof octets === "string" ? new TextEncoder().encode(octets) : octets;
  let bin = "";
  for (const x of o) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function jeton(): Promise<string> {
  if (jetonCache && jetonCache.expire > Date.now() + 60_000) return jetonCache.valeur;
  const pem = SA_CLE.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cle = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corps = b64url(JSON.stringify({
    iss: SA_EMAIL, scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token", iat: maintenant, exp: maintenant + 3600,
  }));
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle, new TextEncoder().encode(`${entete}.${corps}`)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${entete}.${corps}.${b64url(signature)}` }),
  });
  if (!r.ok) throw new Error(`Google OAuth ${r.status} : ${await r.text()}`);
  const d = await r.json();
  jetonCache = { valeur: d.access_token, expire: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function appel(chemin: string, init: RequestInit = {}) {
  const r = await fetch(API + chemin, {
    ...init,
    headers: { Authorization: `Bearer ${await jeton()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!r.ok && r.status !== 410 && r.status !== 404) throw new Error(`Google Agenda ${r.status} : ${await r.text()}`);
  return r.status === 204 || r.status === 404 || r.status === 410 ? null : r.json();
}

/** Plages occupées dans l'agenda EDENEL entre deux dates (incluses). */
export async function occupations(debut: string, fin: string): Promise<{ debut: number; fin: number }[]> {
  if (!googleActif()) return [];
  const d = await appel("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: parisVersDate(debut, "00:00").toISOString(),
      timeMax: parisVersDate(fin, "23:59").toISOString(),
      timeZone: "Europe/Paris",
      items: [{ id: AGENDA }],
    }),
  });
  const occ = d?.calendars?.[AGENDA]?.busy ?? [];
  return occ.map((b: { start: string; end: string }) => ({ debut: Date.parse(b.start), fin: Date.parse(b.end) }));
}

type Ev = { titre: string; date: string; heure: string; duree: number; lieu?: string; details?: string };

function corpsEvenement(ev: Ev) {
  const fin = ajouterMinutes(ev.date, ev.heure, ev.duree);
  return {
    summary: ev.titre,
    description: ev.details ?? "",
    location: ev.lieu,
    start: { dateTime: `${ev.date}T${ev.heure}:00`, timeZone: "Europe/Paris" },
    end: { dateTime: `${fin.date}T${fin.heure}:00`, timeZone: "Europe/Paris" },
  };
}

/** Crée ou met à jour un événement ; renvoie son identifiant (ou null si Google n'est pas configuré / en échec). */
export async function enregistrerEvenement(ev: Ev, idExistant?: string | null): Promise<string | null> {
  if (!googleActif()) return null;
  try {
    const cal = encodeURIComponent(AGENDA);
    const d = idExistant
      ? await appel(`/calendars/${cal}/events/${encodeURIComponent(idExistant)}`, { method: "PATCH", body: JSON.stringify(corpsEvenement(ev)) })
      : null;
    if (d?.id) return d.id;
    const n = await appel(`/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(corpsEvenement(ev)) });
    return n?.id ?? null;
  } catch (e) {
    console.error("Google Agenda :", e);
    return idExistant ?? null;
  }
}

export async function supprimerEvenement(id: string | null | undefined): Promise<void> {
  if (!googleActif() || !id) return;
  try {
    await appel(`/calendars/${encodeURIComponent(AGENDA)}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {
    console.error("Google Agenda (suppression) :", e);
  }
}
