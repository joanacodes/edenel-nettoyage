// Messages du site : formulaire de contact, devis, demande de devis, bon de réception.
// Un email à EDENEL + un accusé de réception au client.
import { adminDb, dateIso, email, erreur, ErreurClient, heure, limiter, lireJson, repondre, servir, texte, utilisateur } from "../_shared/http.ts";
import { dateCourte } from "../_shared/temps.ts";
import { EMAIL_EDENEL, envoyerTous, gabarit, paragraphe, tableau } from "../_shared/email.ts";

servir(async (req) => {
  if (req.method !== "POST") return erreur(req, "Méthode non autorisée", 405);
  const d = await lireJson(req);
  if (texte(d._honey, 200)) return repondre(req, { ok: true }); // robot
  const db = adminDb();
  const type = texte(d.type, 30, true, "type");
  const mail = email(d.email);
  const nom = texte(d.nom, 120) || mail;
  await limiter(req, db, "message", 8, 60);

  let sujetEdenel = "", titreClient = "", texteClient = "", champs: [string, string][] = [];

  if (type === "contact") {
    const brut = Array.isArray(d.champs) ? d.champs.slice(0, 20) : [];
    champs = brut.map((c) => [texte((c as unknown[])[0], 60), texte((c as unknown[])[1], 3000)] as [string, string]).filter((c) => c[0] && c[1]);
    sujetEdenel = `Nouvelle demande (formulaire de contact) — ${nom}`;
    titreClient = "Nous avons bien reçu votre demande";
    texteClient = `Bonjour ${nom},\n\nMerci pour votre message : nous vous répondons sous 24 h.\n\nRécapitulatif :\n` + champs.map((c) => `${c[0]} : ${c[1]}`).join("\n");
  } else if (type === "demande-devis") {
    const num = texte(d.numero, 40, true, "numéro");
    champs = [["Demande", num], ["Nom", nom], ["Téléphone", texte(d.tel, 40) || "—"], ["Prestation", texte(d.prestation, 200) || "—"],
      ["Secteur", texte(d.secteur, 200) || "—"], ["Besoin", texte(d.besoin, 3000) || "—"]];
    sujetEdenel = `Demande de devis ${num} — ${nom}`;
    titreClient = `Demande de devis ${num} reçue`;
    texteClient = `Bonjour ${nom},\n\nNous avons bien reçu votre demande de devis ${num} (prestation : ${champs[3][1]}). Nous vous adressons un devis chiffré et personnalisé sous 24 h.`;
  } else if (type === "devis") {
    const num = texte(d.numero, 40, true, "numéro de devis");
    const resume = texte(d.resume, 8000, true, "détail");
    const totaux = texte(d.totaux, 1000);
    champs = [["Devis", num], ["Client", texte(d.client, 200) || nom], ["Détail", resume], ["Totaux", totaux]];
    sujetEdenel = `DEVIS ${num} généré — ${texte(d.client, 200) || nom}`;
    titreClient = `Votre devis ${num}`;
    texteClient = `Bonjour ${nom},\n\nVoici votre devis ${num} (validité : 30 jours calendaires) — le PDF a été téléchargé sur votre appareil.\n\n${resume}\n\n${totaux}\n\nPour commander : bouton « Passer commande » sur notre site.`;
  } else if (type === "bon-reception") {
    const num = texte(d.numero, 40, true, "n° de commande").toUpperCase();
    const date = dateIso(d.date), h = heure(d.heure);
    const obs = texte(d.observations, 2000);
    champs = [["Commande", num], ["Intervention du", dateCourte(date) + (h ? " à " + h : "")], ["Client", `${nom} (${mail})`], ["Observations", obs || "aucune"]];
    sujetEdenel = `BON DE RÉCEPTION — ${num}`;
    titreClient = `Bon de réception ${num} reçu`;
    texteClient = `Bonjour ${nom},\n\nNous accusons réception de votre bon de réception pour la commande ${num} (intervention du ${dateCourte(date)}). Votre facture vous sera transmise après notre validation interne, au plus tôt 5 h après l'heure d'intervention planifiée.`;
    // Client connecté : on met à jour sa commande
    const user = await utilisateur(req, db);
    if (user) {
      await db.from("commandes").update({ date_br: new Date().toISOString().slice(0, 10), br_observations: obs || null, statut: "terminee" })
        .eq("id", num).eq("user_id", user.id);
    }
  } else {
    throw new ErreurClient("Type de message inconnu.");
  }

  const echecs = await envoyerTous([
    { a: EMAIL_EDENEL, repondreA: mail, sujet: sujetEdenel, html: gabarit(sujetEdenel, tableau([["Email", mail], ...champs])) },
    { a: mail, repondreA: EMAIL_EDENEL, sujet: titreClient + " — EDENEL Nettoyage", html: gabarit(titreClient, paragraphe(texteClient)) },
  ]);
  if (echecs === 2) throw new ErreurClient("L'envoi de l'email n'a pas abouti — réessayez ou écrivez-nous directement.", 502);
  return repondre(req, { ok: true, email_envoye: echecs === 0 });
});
