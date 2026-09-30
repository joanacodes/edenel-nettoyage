// Actions réservées aux administrateurs (page /admin/) qui envoient un email
// au client et/ou mettent à jour Google Agenda.
import { adminDb, dateIso, erreur, ErreurClient, estAdmin, heure, lireJson, repondre, servir, texte, utilisateur } from "../_shared/http.ts";
import { dateCourte, dateLongue, eur } from "../_shared/temps.ts";
import { bouton, EMAIL_EDENEL, envoyerEmail, gabarit, paragraphe } from "../_shared/email.ts";
import { lienGoogleAgenda, pieceIcs } from "../_shared/agenda.ts";
import { enregistrerEvenement, googleActif, occupations, supprimerEvenement } from "../_shared/google.ts";
import { aujourdhuiParis } from "../_shared/temps.ts";

servir(async (req) => {
  if (req.method !== "POST") return erreur(req, "Méthode non autorisée", 405);
  const db = adminDb();
  const user = await utilisateur(req, db);
  if (!user || !(await estAdmin(db, user.email))) throw new ErreurClient("Accès réservé à l'équipe EDENEL.", 403);
  const d = await lireJson(req, 3_000_000);
  const action = texte(d.action, 40, true, "action");
  const mot = texte(d.message, 2000);
  const motHtml = mot ? paragraphe("Message de l'équipe : " + mot) : "";

  // ---------- État des services ----------
  if (action === "etat") {
    let google = googleActif() ? "configuré" : "non configuré";
    if (googleActif()) {
      try { await occupations(aujourdhuiParis(), aujourdhuiParis()); google = "connecté ✓"; }
      catch (e) { google = "erreur : " + (e as Error).message.slice(0, 200); }
    }
    return repondre(req, { ok: true, emails: Deno.env.get("RESEND_API_KEY") ? "configurés" : "NON configurés (RESEND_API_KEY)", google, email_edenel: EMAIL_EDENEL });
  }
  if (action === "test_email") {
    await envoyerEmail({ a: user.email!, sujet: "Test d'envoi — site EDENEL", html: gabarit("Test réussi", paragraphe("Les emails du site partent correctement.")) });
    return repondre(req, { ok: true });
  }

  const id = texte(d.id, 60, true, "identifiant");

  // ---------- Rendez-vous : confirmer / annuler ----------
  if (action === "rdv_statut") {
    const statut = texte(d.statut, 20, true, "statut");
    if (!["confirme", "annule"].includes(statut)) throw new ErreurClient("Statut invalide.");
    const { data: r } = await db.from("rdv").select("*").eq("id", id).maybeSingle();
    if (!r) throw new ErreurClient("Rendez-vous introuvable.", 404);
    const ev = { titre: "Rendez-vous EDENEL Nettoyage", date: r.date, heure: r.heure, duree: r.duree, uid: "rdv-" + r.id,
      details: `Rendez-vous avec EDENEL NETTOYAGE PRO.\nContact : ${EMAIL_EDENEL}` };
    let googleId = r.google_event_id;
    if (statut === "annule") { await supprimerEvenement(googleId); googleId = null; }
    else googleId = await enregistrerEvenement({ titre: `RDV client — ${r.nom}`, date: r.date, heure: r.heure, duree: r.duree,
      details: `Client : ${r.nom}\nTéléphone : ${r.tel}\nEmail : ${r.email}${r.message ? "\nMessage : " + r.message : ""}` }, googleId);
    await db.from("rdv").update({ statut, google_event_id: googleId }).eq("id", id);
    const quand = `${dateLongue(r.date)} à ${r.heure}`;
    await envoyerEmail(statut === "confirme"
      ? { a: r.email, repondreA: EMAIL_EDENEL, sujet: `Rendez-vous confirmé — ${quand}`,
        html: gabarit("Votre rendez-vous est confirmé", paragraphe(`Bonjour ${r.nom},\n\nNous confirmons votre rendez-vous du ${quand}. Nous vous appellerons au ${r.tel}.`) + motHtml + bouton("Ajouter à Google Agenda", lienGoogleAgenda(ev))),
        pj: [pieceIcs(ev, "rendez-vous-edenel.ics")] }
      : { a: r.email, repondreA: EMAIL_EDENEL, sujet: `Rendez-vous annulé — ${quand}`,
        html: gabarit("Votre rendez-vous est annulé", paragraphe(`Bonjour ${r.nom},\n\nNous sommes contraints d'annuler le rendez-vous du ${quand}. Vous pouvez en réserver un autre sur notre site ou répondre à cet email.`) + motHtml),
        pj: [pieceIcs(ev, "rendez-vous-edenel.ics", "CANCEL")] });
    return repondre(req, { ok: true });
  }

  const { data: c } = await db.from("commandes").select("*").eq("id", id).maybeSingle();
  if (!c) throw new ErreurClient("Commande introuvable.", 404);
  const lignes = (c.lignes ?? []) as { titre: string; detail: string; date: string; heure: string; adresse: string; h: number }[];
  const recap = lignes.map((l) => `• ${l.titre} — ${l.detail} — le ${dateCourte(l.date)} — ${l.adresse}`).join("\n");

  // ---------- Commande : planifier (date + heure confirmées) ----------
  if (action === "commande_planifier") {
    const date = dateIso(d.date || c.date_intervention), h = heure(d.heure, true);
    const duree = Math.max(60, Math.round((Number(lignes[0]?.h) || 2) * 60));
    const googleId = await enregistrerEvenement({ titre: `Intervention — ${c.client_nom} — ${c.id}`, date, heure: h, duree, lieu: lignes[0]?.adresse,
      details: `Client : ${c.client_nom} · ${c.client_email} · ${c.client_tel}\nN° client : ${c.numero_client}\n\n${recap}\n\nTotal : ${eur(Number(c.ht))} HT / ${eur(Number(c.ttc))} TTC` }, c.google_event_id);
    await db.from("commandes").update({ statut: "planifiee", date_intervention: date, heure_planifiee: h, google_event_id: googleId }).eq("id", id);
    const ev = { titre: "Intervention EDENEL Nettoyage", date, heure: h, duree, lieu: lignes[0]?.adresse, uid: c.id, details: `Commande ${c.id}\n${recap}` };
    await envoyerEmail({ a: c.client_email, repondreA: EMAIL_EDENEL, sujet: `Intervention confirmée — ${dateLongue(date)} à ${h} (${c.id})`,
      html: gabarit("Votre intervention est planifiée", paragraphe(`Bonjour ${c.client_nom},\n\nNous confirmons l'intervention de votre commande ${c.id} le ${dateLongue(date)} à ${h}.\n\n${recap}`) + motHtml +
        bouton("Ajouter à Google Agenda", lienGoogleAgenda(ev)) + paragraphe("Après l'intervention, validez votre bon de réception depuis le site (pied de page → Bon de réception).")),
      pj: [pieceIcs(ev, `intervention-edenel-${c.id}.ics`)] });
    return repondre(req, { ok: true });
  }

  // ---------- Commande : annuler ----------
  if (action === "commande_annuler") {
    await supprimerEvenement(c.google_event_id);
    await db.from("commandes").update({ statut: "annulee", google_event_id: null }).eq("id", id);
    await envoyerEmail({ a: c.client_email, repondreA: EMAIL_EDENEL, sujet: `Commande ${c.id} annulée`,
      html: gabarit(`Commande ${c.id} annulée`, paragraphe(`Bonjour ${c.client_nom},\n\nVotre commande ${c.id} est annulée.\n\n${recap}`) + motHtml) });
    return repondre(req, { ok: true });
  }

  // ---------- Commande : envoyer la facture PDF ----------
  if (action === "facture_envoyer") {
    const numero = texte(d.numero, 40, true, "numéro de facture");
    const pdf = texte(d.pdf, 2_900_000, true, "PDF");
    if (!/^[A-Za-z0-9+/=]+$/.test(pdf)) throw new ErreurClient("PDF invalide.");
    await envoyerEmail({ a: c.client_email, repondreA: EMAIL_EDENEL, sujet: `Facture ${numero} — commande ${c.id}`,
      html: gabarit(`Facture ${numero}`, paragraphe(`Bonjour ${c.client_nom},\n\nVeuillez trouver ci-joint la facture ${numero} relative à votre commande ${c.id}, d'un montant de ${eur(Number(c.ttc))} TTC.`) + motHtml),
      pj: [{ filename: `facture-edenel-${numero}.pdf`, content: pdf, content_type: "application/pdf" }] });
    await db.from("commandes").update({ statut_facture: c.statut_facture === "payee" ? "payee" : "emise" }).eq("id", id);
    return repondre(req, { ok: true });
  }

  throw new ErreurClient("Action inconnue.");
});
