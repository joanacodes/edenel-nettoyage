// Commande : le client connecté valide son panier. Les montants sont recalculés
// (somme des lignes + frais de déplacement) et le Tarif Fidélité est vérifié.
import { adminDb, dateIso, erreur, ErreurClient, heure, limiter, lireJson, repondre, servir, texte, utilisateur } from "../_shared/http.ts";
import { cleTrajet, DEPLACEMENT, DEPLACEMENT_OFFERT_DES, r2, TVA } from "../_shared/tarifs.ts";
import { aujourdhuiParis, dateCourte, dateLongue, eur } from "../_shared/temps.ts";
import { bouton, EMAIL_EDENEL, envoyerTous, esc, gabarit, paragraphe, SITE_URL, tableau } from "../_shared/email.ts";
import { lienGoogleAgenda, pieceIcs } from "../_shared/agenda.ts";
import { enregistrerEvenement } from "../_shared/google.ts";

type Ligne = { titre: string; detail: string; date: string; heure: string; h: number; adresse: string; commentaire: string; ht: number };

function lireLignes(v: unknown): Ligne[] {
  if (!Array.isArray(v) || v.length === 0) throw new ErreurClient("Votre panier est vide.");
  if (v.length > 20) throw new ErreurClient("Trop de prestations dans une seule commande (20 maximum).");
  const auj = aujourdhuiParis();
  return v.map((x) => {
    const l = (x ?? {}) as Record<string, unknown>;
    if (l.mensuel) throw new ErreurClient("Les contrats mensuels se concluent sur devis, pas en commande en ligne.");
    const ht = Number(l.ht);
    if (!Number.isFinite(ht) || ht <= 0 || ht > 20000) throw new ErreurClient("Montant de prestation invalide.");
    const date = dateIso(l.date);
    if (date < auj) throw new ErreurClient("Une des dates d'intervention est passée — merci de la modifier.");
    return {
      titre: texte(l.titre, 200, true, "prestation"),
      detail: texte(l.detail, 1000),
      date, heure: heure(l.heure),
      h: Math.min(24, Math.max(0, Number(l.h) || 0)),
      adresse: texte(l.adresse, 300, true, "adresse"),
      commentaire: texte(l.commentaire, 1000),
      ht: r2(ht),
    };
  });
}

servir(async (req) => {
  if (req.method !== "POST") return erreur(req, "Méthode non autorisée", 405);
  const db = adminDb();
  const user = await utilisateur(req, db);
  if (!user) throw new ErreurClient("Connectez-vous à votre Espace client pour commander.", 401);
  const d = await lireJson(req);
  const lignes = lireLignes(d.lignes);
  const tel = texte(d.tel, 40, true, "téléphone mobile");
  await limiter(req, db, "commande", 10, 60);

  const { data: profil } = await db.from("profils").select("*").eq("id", user.id).maybeSingle();
  if (!profil) throw new ErreurClient("Complétez votre profil dans l'Espace client avant de commander.", 403);

  const { data: passees } = await db.from("commandes").select("ttc, trajets").eq("user_id", user.id).neq("statut", "annulee");
  const nbPassees = passees?.length ?? 0;
  const cumul = (passees ?? []).reduce((s, c) => s + Number(c.ttc), 0);

  // Tarif Fidélité : acquis dès la 5ᵉ commande ou 400 € TTC cumulés
  const fidelite = lignes.some((l) => /fid[ée]lit[ée]/i.test(l.titre));
  if (fidelite && !(nbPassees >= 4 || cumul >= 400)) {
    throw new ErreurClient(`Le Tarif Fidélité n'est pas encore acquis sur votre compte (${nbPassees} commande(s), ${eur(cumul)} TTC cumulés) : il l'est dès la 5ᵉ commande ou 400 € TTC. Repassez les prestations au Tarif Public.`, 409);
  }

  // Frais de déplacement : un par date + adresse, sauf déjà facturé ou offert
  const deja = new Set((passees ?? []).flatMap((c) => c.trajets ?? []));
  const groupes = new Map<string, number>();
  for (const l of lignes) { const k = cleTrajet(l.date, l.adresse); groupes.set(k, r2((groupes.get(k) ?? 0) + l.ht)); }
  const payants = [...groupes].filter(([k, m]) => !deja.has(k) && !(DEPLACEMENT_OFFERT_DES > 0 && m >= DEPLACEMENT_OFFERT_DES));
  const deplacement = r2(payants.length * DEPLACEMENT);
  const ht = r2(lignes.reduce((s, l) => s + l.ht, 0) + deplacement);
  const ttc = r2(ht * (1 + TVA));

  const tries = [...lignes].sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const premiere = tries[0];
  const adresses = [...new Set(lignes.map((l) => l.adresse))].join(" / ");

  let id = "", enregistree = null;
  for (let essai = 0; essai < 5 && !enregistree; essai++) {
    id = "CMD-" + aujourdhuiParis().replace(/-/g, "") + "-" + String(Math.floor(1000 + Math.random() * 9000));
    const { data, error } = await db.from("commandes").insert({
      id, user_id: user.id, numero_client: profil.numero_client,
      client_nom: profil.nom, client_email: user.email, client_tel: tel,
      lignes, adresse: adresses, date_intervention: premiere.date, heure_souhaitee: premiere.heure || null,
      ht, ttc, deplacement, trajets: [...groupes.keys()], fidelite,
    }).select().single();
    if (error && error.code !== "23505") throw error;
    enregistree = data;
  }
  if (!enregistree) throw new Error("Impossible d'attribuer un numéro de commande");

  const heureAff = premiere.heure || "09:00";
  const duree = Math.max(60, Math.round((premiere.h || 2) * 60));
  const detailsTxt = lignes.map((l) => `• ${l.titre} — ${l.detail} — le ${dateCourte(l.date)}${l.heure ? " à " + l.heure : ""} — ${l.adresse} — ${eur(l.ht)} HT${l.commentaire ? `\n  « ${l.commentaire} »` : ""}`).join("\n");
  const googleId = await enregistrerEvenement({
    titre: `[À PLANIFIER] ${profil.nom} — ${id}`, date: premiere.date, heure: heureAff, duree, lieu: premiere.adresse,
    details: `Client : ${profil.nom} · ${user.email} · ${tel}\nN° client : ${profil.numero_client}\n\n${detailsTxt}\n\nTotal : ${eur(ht)} HT / ${eur(ttc)} TTC\nGérer : ${SITE_URL}/admin/`,
  });
  if (googleId) await db.from("commandes").update({ google_event_id: googleId }).eq("id", id);

  const evClient = { titre: "Intervention EDENEL Nettoyage (horaire à confirmer)", date: premiere.date, heure: heureAff, duree, lieu: premiere.adresse, uid: id,
    details: `Commande ${id}\n${detailsTxt}\nL'heure exacte vous est confirmée par EDENEL.` };
  const lignesHtml = `<table style="border-collapse:collapse;width:100%;font-size:14px">` + lignes.map((l) =>
    `<tr><td style="padding:9px 8px;border-bottom:1px solid #e3ebef"><strong style="color:#1e2a6e">${esc(l.titre)}</strong><br><span style="color:#68758a">${esc(l.detail)}<br>${esc(dateLongue(l.date))}${l.heure ? " à " + esc(l.heure) : ""} — ${esc(l.adresse)}</span></td>` +
    `<td style="padding:9px 8px;border-bottom:1px solid #e3ebef;text-align:right;white-space:nowrap;color:#1e2a6e"><strong>${esc(eur(l.ht))}</strong> HT</td></tr>`).join("") +
    `<tr><td style="padding:9px 8px">Frais de déplacement (${payants.length} × ${esc(eur(DEPLACEMENT))} HT)</td><td style="padding:9px 8px;text-align:right">${esc(eur(deplacement))} HT</td></tr>` +
    `<tr><td style="padding:9px 8px"><strong>Total</strong></td><td style="padding:9px 8px;text-align:right;white-space:nowrap"><strong>${esc(eur(ht))} HT<br>${esc(eur(ttc))} TTC</strong></td></tr></table>`;

  const echecs = await envoyerTous([
    {
      a: user.email!, repondreA: EMAIL_EDENEL,
      sujet: `Commande ${id} enregistrée — ${eur(ttc)} TTC`,
      html: gabarit(`Commande ${id} enregistrée`,
        paragraphe(`Bonjour ${profil.nom},\n\nMerci ! Voici le récapitulatif de votre commande. Nous vous confirmons très vite l'heure exacte d'intervention par email.`) +
        lignesHtml +
        paragraphe(`\nRèglement à réception de la facture, émise après votre bon de réception.\nN° client : ${profil.numero_client}`) +
        bouton("Ajouter à Google Agenda", lienGoogleAgenda(evClient)) +
        paragraphe("Suivez vos commandes dans votre Espace client sur le site.")),
      pj: [pieceIcs(evClient, `intervention-edenel-${id}.ics`)],
    },
    {
      a: EMAIL_EDENEL, repondreA: user.email!,
      sujet: `COMMANDE ${id} — ${profil.nom} — ${eur(ttc)} TTC — le ${dateCourte(premiere.date)}`,
      html: gabarit(`Nouvelle commande ${id}`, tableau([
        ["Client", `${profil.nom} — ${user.email} — ${tel}`], ["N° client", profil.numero_client],
        ["Fidélité", fidelite ? `Oui (vérifié : ${nbPassees} commande(s), ${eur(cumul)} TTC)` : "Non"],
      ]) + lignesHtml + bouton("Planifier dans l'admin", `${SITE_URL}/admin/`)),
    },
  ]);

  return repondre(req, { ok: true, commande: enregistree, email_envoye: echecs === 0 });
});
