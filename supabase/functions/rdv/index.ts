// Rendez-vous : GET = créneaux libres, POST = réservation d'un créneau.
import { adminDb, dateIso, email, erreur, ErreurClient, heure, limiter, lireJson, repondre, servir, texte, utilisateur } from "../_shared/http.ts";
import { creneauxLibres, lireReglages } from "../_shared/creneaux.ts";
import { ajouterJours, dateLongue } from "../_shared/temps.ts";
import { bouton, EMAIL_EDENEL, envoyerTous, gabarit, paragraphe, SITE_URL, tableau } from "../_shared/email.ts";
import { lienGoogleAgenda, pieceIcs } from "../_shared/agenda.ts";
import { enregistrerEvenement } from "../_shared/google.ts";

servir(async (req) => {
  const db = adminDb();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const debut = dateIso(url.searchParams.get("debut"));
    let fin = dateIso(url.searchParams.get("fin"));
    if (fin > ajouterJours(debut, 62)) fin = ajouterJours(debut, 62);
    const reg = await lireReglages(db);
    return repondre(req, { ok: true, duree: reg.rdv_duree, creneaux: await creneauxLibres(db, debut, fin, reg) });
  }
  if (req.method !== "POST") return erreur(req, "Méthode non autorisée", 405);

  const d = await lireJson(req);
  if (texte(d._honey, 200)) return repondre(req, { ok: true }); // robot
  const date = dateIso(d.date), h = heure(d.heure, true);
  const nom = texte(d.nom, 120, true, "votre nom");
  const mail = email(d.email);
  const tel = texte(d.tel, 40, true, "votre téléphone");
  const message = texte(d.message, 1500);
  await limiter(req, db, "rdv", 5, 60);

  const reg = await lireReglages(db);
  const libres = await creneauxLibres(db, date, date, reg);
  if (!(libres[date] ?? []).includes(h)) throw new ErreurClient("Ce créneau n'est plus disponible — merci d'en choisir un autre.", 409);

  const user = await utilisateur(req, db);
  const statut = reg.rdv_confirmation_auto ? "confirme" : "demande";
  const { data: rdv, error } = await db.from("rdv").insert({
    date, heure: h, duree: reg.rdv_duree, nom, email: mail, tel, message: message || null, statut, user_id: user?.id ?? null,
  }).select().single();
  if (error) {
    if (error.code === "23505") throw new ErreurClient("Ce créneau vient d'être réservé — merci d'en choisir un autre.", 409);
    throw error;
  }

  const dateFr = dateLongue(date);
  const evClient = { titre: "Rendez-vous EDENEL Nettoyage", date, heure: h, duree: reg.rdv_duree, uid: "rdv-" + rdv.id,
    details: `Rendez-vous avec EDENEL NETTOYAGE PRO.\nNous vous appelons au ${tel}.\nContact : ${EMAIL_EDENEL}` };
  const googleId = await enregistrerEvenement({
    titre: `${statut === "confirme" ? "" : "[À CONFIRMER] "}RDV client — ${nom}`, date, heure: h, duree: reg.rdv_duree,
    details: `Client : ${nom}\nTéléphone : ${tel}\nEmail : ${mail}${message ? "\nMessage : " + message : ""}\n\nGérer : ${SITE_URL}/admin/`,
  });
  if (googleId) await db.from("rdv").update({ google_event_id: googleId }).eq("id", rdv.id);

  const confirme = statut === "confirme";
  const echecs = await envoyerTous([
    {
      a: mail, repondreA: EMAIL_EDENEL,
      sujet: confirme ? `Rendez-vous confirmé — ${dateFr} à ${h}` : `Demande de rendez-vous reçue — ${dateFr} à ${h}`,
      html: gabarit(confirme ? "Votre rendez-vous est confirmé" : "Nous avons bien reçu votre demande", paragraphe(
        `Bonjour ${nom},\n\n` + (confirme
          ? `Votre rendez-vous du ${dateFr} à ${h} est confirmé. Nous vous appellerons au ${tel}.`
          : `Votre demande de rendez-vous pour le ${dateFr} à ${h} est enregistrée : nous vous confirmons le créneau très rapidement.`)
        + `\n\nUn empêchement ? Répondez simplement à cet email.`) +
        bouton("Ajouter à Google Agenda", lienGoogleAgenda(evClient)) +
        paragraphe("Pour Apple Calendar ou Outlook, ouvrez le fichier .ics joint.")),
      pj: [pieceIcs(evClient, "rendez-vous-edenel.ics")],
    },
    {
      a: EMAIL_EDENEL, repondreA: mail,
      sujet: `RENDEZ-VOUS ${confirme ? "" : "(à confirmer) "}— ${dateFr} à ${h} — ${nom}`,
      html: gabarit("Nouveau rendez-vous", tableau([
        ["Date", `${dateFr} à ${h}`], ["Statut", confirme ? "Confirmé automatiquement" : "À confirmer"],
        ["Nom", nom], ["Téléphone", tel], ["Email", mail], ["Message", message || "—"],
      ]) + bouton("Gérer les rendez-vous", `${SITE_URL}/admin/`)),
    },
  ]);

  return repondre(req, { ok: true, id: rdv.id, statut, date, heure: h, duree: reg.rdv_duree, email_envoye: echecs === 0 });
});
