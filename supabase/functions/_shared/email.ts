// Envoi des emails via Resend (https://resend.com), au nom de contact@edenelnettoyage.fr.

const CLE = Deno.env.get("RESEND_API_KEY") ?? "";
const API_RESEND = Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com";
export const EXPEDITEUR = Deno.env.get("EMAIL_FROM") ?? "EDENEL Nettoyage <contact@edenelnettoyage.fr>";
export const EMAIL_EDENEL = Deno.env.get("EMAIL_EDENEL") ?? "contact@edenelnettoyage.fr";
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://edenelnettoyage.fr").replace(/\/$/, "");
const MARQUE = "EDENEL NETTOYAGE PRO";
const FILIATION = "Une marque de EDENEL PATRIMOINE GESTION";

export type PieceJointe = { filename: string; content: string /* base64 */; content_type?: string };

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Tableau « libellé : valeur » pour les emails internes. */
export function tableau(lignes: [string, string][]): string {
  return `<table style="border-collapse:collapse;width:100%;font-size:14px">` + lignes.map(([k, v]) =>
    `<tr><td style="padding:8px 10px;border-bottom:1px solid #e3ebef;color:#68758a;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
    `<td style="padding:8px 10px;border-bottom:1px solid #e3ebef;color:#1e2a6e;white-space:pre-line">${esc(v)}</td></tr>`).join("") + `</table>`;
}

export function bouton(libelle: string, url: string): string {
  return `<p style="margin:22px 0"><a href="${esc(url)}" style="background:#1e2a6e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${esc(libelle)}</a></p>`;
}

/** Gabarit HTML commun à tous les emails. `corps` est du HTML déjà échappé. */
export function gabarit(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f7f9;font-family:Arial,Helvetica,sans-serif;color:#3b4a61">
<div style="max-width:620px;margin:0 auto;padding:24px 14px">
  <div style="background:#1e2a6e;border-radius:14px 14px 0 0;padding:22px 26px;color:#fff">
    <div style="font-size:22px;font-weight:700;letter-spacing:.5px">EDENEL</div>
    <div style="font-size:11px;letter-spacing:4px;color:#96d2e1;margin-top:2px">NETTOYAGE PROFESSIONNEL</div>
  </div>
  <div style="background:#fff;border-radius:0 0 14px 14px;padding:26px;line-height:1.55;font-size:15px">
    <h1 style="font-size:20px;color:#1e2a6e;margin:0 0 14px">${esc(titre)}</h1>
    ${corps}
  </div>
  <p style="font-size:12px;color:#8a96ac;text-align:center;margin:16px 0">${MARQUE} — ${FILIATION}<br>
  <a href="${esc(SITE_URL)}" style="color:#8a96ac">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a> · ${esc(EMAIL_EDENEL)}</p>
</div></body></html>`;
}

export function paragraphe(texte: string): string {
  return `<p style="margin:0 0 12px;white-space:pre-line">${esc(texte)}</p>`;
}

export async function envoyerEmail(opts: {
  a: string | string[];
  sujet: string;
  html: string;
  texte?: string;
  repondreA?: string;
  pj?: PieceJointe[];
}): Promise<void> {
  if (!CLE) throw new Error("RESEND_API_KEY manquante");
  const r = await fetch(API_RESEND + "/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EXPEDITEUR,
      to: Array.isArray(opts.a) ? opts.a : [opts.a],
      subject: opts.sujet,
      html: opts.html,
      text: opts.texte,
      reply_to: opts.repondreA,
      attachments: opts.pj,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} : ${await r.text()}`);
}

/** Envoie plusieurs emails ; renvoie le nombre d'échecs (sans interrompre les autres). */
export async function envoyerTous(emails: Parameters<typeof envoyerEmail>[0][]): Promise<number> {
  const res = await Promise.allSettled(emails.map(envoyerEmail));
  res.forEach((r) => { if (r.status === "rejected") console.error("Email non envoyé :", r.reason); });
  return res.filter((r) => r.status === "rejected").length;
}
