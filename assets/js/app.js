/* =====================================================================
   EDENEL NETTOYAGE PROFESSIONNEL — script principal
   Ce fichier est un template Hugo : les constantes ci-dessous sont
   injectées depuis data/tarifs.yaml et hugo.toml au moment du build.
   ===================================================================== */
{{- $t := hugo.Data.tarifs -}}
{{- $s := site.Params.societe -}}
{{- $coefs := slice -}}
{{- range $t.delais }}{{ $coefs = $coefs | append (dict "jours" .jours "c" .coef "label" .court) }}{{ end -}}
{{- $prestas := slice -}}
{{- range $t.prestations }}{{ $prestas = $prestas | append (dict "n" .simulateur "menage" .menage "linge" .linge "chantier" .chantier) }}{{ end -}}
{{- $laverie := slice -}}
{{- range $t.logements }}{{ $laverie = $laverie | append $t.laverieParLit }}{{ end -}}
{{- $bPonctuel := slice -}}
{{- range $t.bureaux.ponctuel }}{{ $bPonctuel = $bPonctuel | append (dict "n" .nom "taux" .taux) }}{{ end -}}
{{- $bTranches := slice -}}
{{- range $t.bureaux.contrat }}{{ $bTranches = $bTranches | append (dict "max" .max "prix" .prix "freq" .frequence) }}{{ end -}}
{{- $cTailles := slice -}}
{{- range $t.copro.tailles }}{{ $cTailles = $cTailles | append (dict "n" .nom "prix" .prix) }}{{ end }}

/* ====== GRILLE TARIFAIRE (HT — source : data/tarifs.yaml, mise à jour {{ $t.miseAJour }}) ====== */
var TARIF_BASE = {{ $t.base }};
var TVA = {{ $t.tva }};
var MAJO_DIM_FERIE = {{ $t.majorationDimanche }};
var REMISE_FIDELITE = {{ $t.remiseFidelite }};
var SUP_CHANTIER = {{ $t.supplementChantier }};
var DEPL_HT = {{ $t.deplacement }};
var PROD_ENTRETIEN = {{ $t.produitsEntretien }};
var PROD_TOILETTE = {{ $t.produitsToilette }};
var COEFS = {{ $coefs | jsonify | safeJS }};
var PRESTAS = {{ $prestas | jsonify | safeJS }};
var LOGEMENTS = {{ $t.logements | jsonify | safeJS }};
var HEURES_MIN = {{ $t.heuresMin | jsonify | safeJS }};
var LAVERIE_LIT = {{ $laverie | jsonify | safeJS }};
var JOURS_FERIES = {{ $t.joursFeries | jsonify | safeJS }};
var BUREAUX = {
  ponctuel: {{ $bPonctuel | jsonify | safeJS }},
  minH: {{ $t.bureaux.minHeures }},
  tranches: {{ $bTranches | jsonify | safeJS }},
  baseGrand: {{ $t.bureaux.baseGrand }},
  remiseAnnuelle: {{ $t.bureaux.remiseAnnuelle }}
};
var COPRO = {
  tailles: {{ $cTailles | jsonify | safeJS }},
  containers: {{ $t.copro.containers }},
  vitrerie: {{ $t.copro.vitrerie }},
  remiseAnnuelle: {{ $t.copro.remiseAnnuelle }}
};

/* ====== IDENTITÉ & RÉGLAGES (source : hugo.toml) ====== */
var LEGAL = {
  marque: {{ site.Params.marqueCourte | jsonify | safeJS }},
  filiation: {{ site.Params.filiation | jsonify | safeJS }},
  raison: {{ $s.raison | jsonify | safeJS }},
  forme: {{ $s.forme | jsonify | safeJS }},
  siret: {{ $s.siret | jsonify | safeJS }},
  ape: {{ printf "Code APE : %s" $s.ape | jsonify | safeJS }},
  rcs: {{ $s.rcs | jsonify | safeJS }},
  tvaIntra: {{ $s.tva | jsonify | safeJS }},
  adresse: {{ printf "%s, %s %s" $s.rue $s.cp $s.ville | jsonify | safeJS }},
  email: {{ site.Params.email | jsonify | safeJS }}
};
var FORMSUBMIT = "https://formsubmit.co/ajax/" + {{ site.Params.formsubmit | jsonify | safeJS }};
var CALENDRIER_EXTERNE = {{ site.Params.calendrierExterne | default "" | jsonify | safeJS }};
var CODE_INTERNE = {{ site.Params.codeInterne | jsonify | safeJS }};
var RDV_CRENEAUX = ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30"];
var ANNULATION = "Conditions d'annulation de commande : annulation gratuite jusqu'à 10 jours avant la date d'intervention ; de 9 à 5 jours avant : pénalité d'annulation de 15 % du montant total TTC de la commande ; à moins de 5 jours : pénalité de 30 % du montant total TTC ; à 1 jour de la date d'intervention : commande non remboursable.";

var formule = "public";
var panier = [];
var univers = "menage", modeBureaux = "ponctuel";

/* ====== UTILITAIRES ====== */
function eur(x){ return x.toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €"; }
function el(id){ return document.getElementById(id); }
function r2(x){ return Math.round(x * 100) / 100; }
function estLocal(){ return location.protocol === "file:"; }
function frDate(iso){ return iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR") : "—"; }
function dateLongue(iso){ return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "long", year: "numeric"}); }
function note(id, texte, couleur){ var n = el(id); if(!n) return; n.textContent = texte; n.style.color = couleur || ""; }
var ROUGE = "#B4632A", VERT = "#3EBD8E", GRIS = "#68758a";
function remplirSelect(id, options){ el(id).innerHTML = options.map(function(o){ return "<option>" + o + "</option>"; }).join(""); }
function echapper(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }

/* ====== MENU MOBILE ====== */
function basculerMenu(btn){
  var ouvert = document.body.classList.toggle("menu-ouvert");
  btn.setAttribute("aria-expanded", ouvert ? "true" : "false");
  btn.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
}
function fermerMenu(){
  document.body.classList.remove("menu-ouvert");
  var b = document.querySelector(".burger");
  if(b){ b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "Ouvrir le menu"); }
}

/* ====== SIMULATEUR MÉNAGE ====== */
function initCommande(){
  if(!el("bc-service").options.length){
    remplirSelect("bc-service", PRESTAS.map(function(p){ return p.n; }));
    remplirSelect("bc-logement", LOGEMENTS);
  }
  var auj = new Date().toISOString().slice(0, 10);
  el("bc-date").min = auj;
  el("bp-date").min = auj;
  majMinimum(); choisirUnivers(univers);
}
function choisirFormule(f){
  formule = f;
  el("ong-public").classList.toggle("actif", f === "public");
  el("ong-fidelite").classList.toggle("actif", f === "fidelite");
  el("info-fidelite").hidden = f !== "fidelite";
  calculer();
}
function majMinimum(){
  var s = el("bc-service").selectedIndex, l = el("bc-logement").selectedIndex;
  if(s < 0 || l < 0) return;
  var m = Math.max(HEURES_MIN[l][s], 0.25);
  var inp = el("bc-heures");
  inp.min = m; inp.value = m;
  el("bc-heures-min").textContent = "(minimum : " + m + " h)";
  el("bloc-lits").hidden = !PRESTAS[s].linge;
  el("bloc-prodok").hidden = !PRESTAS[s].menage;
  el("bc-alerte").hidden = !PRESTAS[s].menage;
}
function joursAvant(dateStr){
  var d = new Date(dateStr + "T12:00:00"), t = new Date(); t.setHours(12, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function estDimancheOuFerie(dateStr){
  if(!dateStr) return false;
  var d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || JOURS_FERIES.indexOf(dateStr) >= 0;
}
function tierDelai(n){
  if(n >= 4) return COEFS[0];
  if(n === 3) return COEFS[1];
  if(n === 2) return COEFS[2];
  if(n === 1) return COEFS[3];
  return COEFS[4];
}
function fideliteValide(){
  return /^[A-Za-z]{1,4}-?\d{6,8}(-?\d{1,3})?$/.test(el("fid-num").value.trim());
}

function detailsCalcul(){
  var s = el("bc-service").selectedIndex, l = el("bc-logement").selectedIndex;
  var dateStr = el("bc-date").value;
  var h = parseFloat(el("bc-heures").value) || 0;
  if(!dateStr || s < 0 || l < 0) return null;
  var n = joursAvant(dateStr);
  if(n < 0 || h <= 0) return {erreur: n < 0 ? "⚠ La date choisie est passée — merci de sélectionner une date à venir." : "⚠ Merci d'indiquer un nombre d'heures valide."};
  if(formule === "fidelite" && !fideliteValide()) return {erreur: "⚠ Tarif Fidélité (dès la 5ᵉ commande ou 400 € TTC cumulés) : indiquez votre numéro client (ex. SH-20260724-41), consultable dans votre Espace client. Sinon, choisissez le Tarif Public."};
  var t = tierDelai(n);
  var taux = r2(TARIF_BASE * t.c + (PRESTAS[s].chantier ? SUP_CHANTIER : 0));
  if(formule === "fidelite") taux = r2(taux * (1 - REMISE_FIDELITE));
  var prest = r2(taux * h);
  var majo = estDimancheOuFerie(dateStr) ? r2(prest * MAJO_DIM_FERIE) : 0;
  var supp = 0, suppTxt = [];
  if(PRESTAS[s].linge){
    var lits = Math.max(1, parseInt(el("bc-lits").value, 10) || 1);
    var laverie = r2(LAVERIE_LIT[l] * lits);
    supp += laverie; suppTxt.push("laverie " + eur(LAVERIE_LIT[l]) + " × " + lits + " lit(s)");
  }
  var prodOk = PRESTAS[s].menage && el("bc-prodok").checked;
  if(PRESTAS[s].menage && !prodOk){ supp += PROD_ENTRETIEN; suppTxt.push("produits d'entretien " + eur(PROD_ENTRETIEN)); }
  var opt = el("bc-toilette").checked ? PROD_TOILETTE : 0;
  var ht = r2(prest + majo + supp + opt + DEPL_HT);
  return {taux: taux, h: h, tier: t, prest: prest, majo: majo, supp: r2(supp), suppTxt: suppTxt, opt: opt, ht: ht, prodOk: prodOk, s: s, l: l, dateStr: dateStr};
}

function calculer(){
  var d = detailsCalcul(), det = el("bc-detail");
  if(!d){ det.textContent = "Sélectionnez une date pour connaître le tarif applicable."; afficherTotaux(null); return; }
  if(d.erreur){ det.textContent = d.erreur; afficherTotaux(null); return; }
  det.textContent = "Tarif appliqué (" + (formule === "fidelite" ? "Fidélité −8 %" : "Public") + ") : " + d.tier.label + " — " +
    eur(d.taux) + " HT/h × " + d.h + " h" + (d.majo > 0 ? " · dimanche/jour férié : +10 %" : "");
  afficherTotaux(d);
}
function afficherTotaux(d){
  if(!d){
    ["t-prest", "t-supp", "t-opt", "t-ht", "t-tva", "t-ttc"].forEach(function(i){ el(i).textContent = "—"; });
    el("lig-majo").hidden = el("lig-supp").hidden = el("lig-opt").hidden = true; return;
  }
  el("t-prest").textContent = eur(d.prest);
  el("lig-majo").hidden = d.majo === 0; el("t-majo").textContent = eur(d.majo);
  el("lig-supp").hidden = d.supp === 0; el("t-supp").textContent = eur(d.supp);
  el("lbl-supp").textContent = "Suppléments obligatoires (" + d.suppTxt.join(" + ") + ")";
  el("lig-opt").hidden = d.opt === 0; el("t-opt").textContent = eur(d.opt);
  var tva = r2(d.ht * TVA);
  el("t-ht").textContent = eur(d.ht);
  el("t-tva").textContent = eur(tva);
  el("t-ttc").textContent = eur(r2(d.ht + tva));
}

function itemCourant(){
  var adresse = el("bc-adresse").value.trim();
  var d = detailsCalcul();
  if(!d || d.erreur || !adresse) return null;
  return {
    titre: PRESTAS[d.s].n + (formule === "fidelite" ? " — Tarif Fidélité (−8 %)" : " — Tarif Public"),
    detail: LOGEMENTS[d.l] + " · " + eur(d.taux) + " HT/h × " + d.h + " h · " + d.tier.label
      + (el("bc-heure").value ? " · heure souhaitée : " + el("bc-heure").value : "")
      + (d.majo > 0 ? " · +10 % dim./férié" : "")
      + (d.suppTxt.length ? " · " + d.suppTxt.join(" + ") : "")
      + (d.prodOk ? " · produits d'entretien fournis sur place" : "")
      + (d.opt > 0 ? " · option produits de toilette" : ""),
    date: d.dateStr, heure: el("bc-heure").value, h: d.h, adresse: adresse,
    commentaire: el("bc-comment").value.trim(),
    ht: r2(d.ht - DEPL_HT)   /* le déplacement est compté par commande (date + adresse) dans le panier */
  };
}

/* ====== PANIER ====== */
function ajouterAuPanier(){
  var det = el("bc-detail");
  var d = detailsCalcul();
  if(!d){ det.textContent = "⚠ Merci d'indiquer la date d'intervention souhaitée."; return; }
  if(d.erreur){ det.textContent = d.erreur; return; }
  if(!el("bc-adresse").value.trim()){ det.textContent = "⚠ Merci d'indiquer l'adresse de l'intervention."; return; }
  if(!adresseValide("bc-adresse")){ det.textContent = "⚠ Adresse non reconnue : sélectionnez une adresse dans la liste proposée pendant la saisie."; return; }
  if(!el("bc-cgv").checked){ det.textContent = "⚠ Merci d'accepter les Conditions Générales de Vente pour ajouter au panier."; return; }
  panier.push(itemCourant());
  majPanier(); fermerCommande(); ouvrirPanier();
}
function nbDeplacements(lignes){
  var cles = {};
  lignes.forEach(function(it){ if(it.date) cles[it.date + "|" + it.adresse.toLowerCase()] = 1; });
  return Object.keys(cles).length;
}
function majPanier(){
  var n = panier.length;
  el("cpt-panier").textContent = n;
  if(el("cpt-panier2")) el("cpt-panier2").textContent = n;
  var b = el("badge-panier"); b.hidden = n === 0; b.textContent = n;
  var liste = el("liste-panier");
  if(n === 0){ liste.innerHTML = '<p class="panier-vide">Votre panier est vide.</p>'; }
  else{
    liste.innerHTML = panier.map(function(it, i){
      return '<div class="panier-item"><div class="pi-txt"><strong>' + echapper(it.titre) + '</strong>' + echapper(it.detail) + '<br>' + dateLongue(it.date) + ' — ' + echapper(it.adresse) +
        (it.commentaire ? '<br><em>« ' + echapper(it.commentaire) + ' »</em>' : '') +
        '</div><div class="pi-prix">' + eur(it.ht) + ' HT</div><button class="pi-suppr" type="button" aria-label="Retirer" onclick="retirer(' + i + ')">✕</button></div>';
    }).join("");
  }
  var nbDepl = nbDeplacements(panier);
  var depl = r2(nbDepl * DEPL_HT);
  var ht = r2(panier.reduce(function(s, it){ return s + it.ht; }, 0) + depl);
  var tva = r2(ht * TVA), ttc = r2(ht + tva);
  el("p-nbdepl").textContent = nbDepl;
  el("p-depl").textContent = eur(depl);
  el("p-ht").textContent = eur(ht);
  el("p-tva").textContent = eur(tva);
  el("p-ttc").textContent = eur(ttc);
}
function retirer(i){ panier.splice(i, 1); majPanier(); }

/* ====== OUVERTURE / FERMETURE DES FENÊTRES ====== */
function ouvrir(id){ el(id).classList.add("ouvert"); fermerMenu(); }
function fermer(id){ el(id).classList.remove("ouvert"); }
function ouvrirCommande(simu){
  el("titre-commande").textContent = simu === true ? "Combien ça coûte ?" : "Passer commande";
  el("sous-commande").textContent = simu === true
    ? "Simulez votre devis en quelques clics : les montants HT se calculent instantanément (TVA de 20 % ajoutée au total). Si le prix vous convient, ajoutez la prestation au panier."
    : "Composez votre prestation : les montants HT se calculent automatiquement, la TVA de 20 % est ajoutée au total.";
  initCommande();
  /* Déverrouillage automatique du Tarif Fidélité : 4 commandes ou 400 € TTC cumulés */
  var cpt = lireJSON(COMPTE_KEY), cmds = lireCmds();
  var cumul = cmds.reduce(function(s, x){ return s + x.ttc; }, 0);
  if(cpt && cpt.numero && (cmds.length >= 4 || cumul >= 400) && !el("fid-num").value){
    el("fid-num").value = cpt.numero;
    choisirFormule("fidelite");
  }
  ouvrir("modal-commande");
}
function fermerCommande(){ fermer("modal-commande"); }
function ouvrirPanier(){ majPanier(); ouvrir("modal-panier"); }
function fermerPanier(){ fermer("modal-panier"); }
var derniereCommande = null;
function ouvrirPaiement(){
  if(panier.length === 0){ el("liste-panier").innerHTML = '<p class="panier-vide">⚠ Ajoutez au moins une prestation avant de commander.</p>'; return; }
  if(!lireJSON(COMPTE_KEY)){
    el("liste-panier").innerHTML = '<p class="panier-vide">⚠ Pour passer commande (et cumuler vos commandes vers le Tarif Fidélité −8 %), créez d\'abord votre compte dans l\'Espace client — il s\'ouvre à l\'instant.</p>';
    ouvrirCompte(); return;
  }
  if(!telNational(el("pan-tel").value)){
    note("pan-note", "⚠ Téléphone mobile obligatoire pour commander : choisissez l'indicatif pays puis saisissez votre numéro commençant par 0 (ex. : 0612345678).", ROUGE); return;
  }
  derniereCommande = enregistrerCommande();
  el("paiement-montant").textContent = "Commande " + derniereCommande.id + " — total " + eur(derniereCommande.ttc) + " TTC";
  el("paiement-choix").hidden = false; el("paiement-succes").hidden = true;
  note("note-paiement", "", "");
  fermerPanier(); ouvrir("modal-paiement");
}
function confirmerCommande(){
  var rec = derniereCommande;
  if(!rec || panier.length === 0){ note("note-paiement", "⚠ Aucune commande en cours.", ROUGE); return; }
  var compte = lireJSON(COMPTE_KEY) || {};
  var tries = panier.slice().sort(function(a, b){ return (a.date || "") < (b.date || "") ? -1 : 1; });
  var premier = tries[0];
  var heure = premier.heure || "09:00";
  var duree = Math.max(60, Math.round((premier.h || 2) * 60));
  var detailsTxt = panier.map(function(it){ return "• " + it.titre + " — " + it.detail + " — le " + frDate(it.date) + (it.heure ? " à " + it.heure : "") + " — " + it.adresse; }).join("\n");
  var evClient = {titre: "Intervention " + LEGAL.marque, date: premier.date, heure: heure, duree: duree, lieu: premier.adresse, uid: rec.id,
    details: "Commande " + rec.id + "\n" + detailsTxt + "\nTotal : " + eur(rec.ttc) + " TTC\nL'heure exacte vous est confirmée par EDENEL."};
  var evSociete = {titre: "Intervention — " + (compte.nom || "client") + " — " + rec.id, date: premier.date, heure: heure, duree: duree, lieu: premier.adresse, uid: rec.id + "-edenel",
    details: "Client : " + (compte.nom || "") + " · " + (compte.email || "") + " · " + rec.tel + "\nN° client : " + (rec.numClient || "—") + "\n" + detailsTxt + "\nTotal : " + eur(rec.ht) + " HT / " + eur(rec.ttc) + " TTC"};
  var lienClient = lienGoogleAgenda(evClient), lienSociete = lienGoogleAgenda(evSociete);
  function succes(msg, couleur){
    el("paiement-choix").hidden = true; el("paiement-succes").hidden = false;
    el("paiement-recap").textContent = "Commande " + rec.id + " — " + eur(rec.ttc) + " TTC — intervention le " + frDate(premier.date) + " à " + heure + (tries.length > 1 ? " (+" + (tries.length - 1) + " autre(s))" : "");
    boutonsAgenda("paiement-agenda", evClient, "intervention-edenel-" + rec.id + ".ics");
    note("paiement-succes-note", msg, couleur || VERT);
    panier = []; majPanier();
  }
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("COMMANDE " + rec.id) + "&body=" + encodeURIComponent(detailsTxt + "\nTotal : " + eur(rec.ttc) + " TTC\nAjouter à l'agenda : " + lienSociete);
    succes("Mode test local : votre messagerie s'est ouverte avec la commande pré-remplie. En ligne, l'envoi est automatique."); return;
  }
  note("note-paiement", "Transmission de votre commande…", GRIS);
  envoyerFormulaire({
    _subject: "COMMANDE " + rec.id + " — " + (compte.nom || "") + " — " + eur(rec.ttc) + " TTC — le " + frDate(premier.date),
    email: compte.email,
    _autoresponse: "Bonjour " + (compte.nom || "") + ",\n\nVotre commande " + rec.id + " est bien enregistrée :\n\n" + detailsTxt + "\n\nTotal : " + eur(rec.ht) + " HT — " + eur(rec.ttc) + " TTC.\nNous vous confirmons l'heure exacte d'intervention. Règlement à réception de la facture, émise après votre bon de réception.\n\nAjoutez l'intervention à votre Google Agenda en un clic :\n" + lienClient + "\n\n" + LEGAL.marque + " — " + LEGAL.filiation + "\n" + LEGAL.email,
    "Commande": rec.id,
    "Client": (compte.nom || "") + " — " + (compte.email || "") + " — " + rec.tel,
    "Numéro client": rec.numClient || "—",
    "Prestations": detailsTxt,
    "Total": eur(rec.ht) + " HT / " + eur(rec.ttc) + " TTC",
    "AJOUTER À L'AGENDA EDENEL (1 clic)": lienSociete
  }).then(function(){
    succes("✓ Commande transmise. Un récapitulatif vient de vous être envoyé par email ; nous vous confirmons l'heure exacte d'intervention. Enregistrez-la dès maintenant :");
  }).catch(function(){
    succes("⚠ L'envoi automatique n'a pas abouti — contactez-nous à " + LEGAL.email + " avec la référence " + rec.id + ". Vous pouvez déjà enregistrer l'intervention :", ROUGE);
  });
}
function fermerPaiement(){ fermer("modal-paiement"); }
function ouvrirValidation(){ ouvrir("modal-validation"); }
function fermerValidation(){ fermer("modal-validation"); }
function fermerRdv(){ fermer("modal-rdv"); }
function fermerCompte(){ fermer("modal-compte"); }
document.addEventListener("keydown", function(e){
  if(e.key !== "Escape") return;
  ["modal-commande", "modal-panier", "modal-paiement", "modal-validation", "modal-rdv", "modal-compte"].forEach(fermer);
  fermerMenu();
});
function verifLien(a){
  if(a.getAttribute("href").indexOf("http") !== 0){
    note("note-paiement", "⚠ Ce bouton doit être relié à votre lien de paiement Stripe ou PayPal : renseignez lienStripe / lienPaypal dans hugo.toml.", ROUGE);
    return false;
  }
  return true;
}

/* ====== PRENEZ RENDEZ-VOUS ====== */
var calAnnee, calMois, rdvDate = null, rdvHeure = null;
function ouvrirRdv(){
  if(CALENDRIER_EXTERNE.indexOf("http") === 0){
    el("rdv-interne").hidden = true; el("rdv-externe").hidden = false;
    if(!el("rdv-frame").src) el("rdv-frame").src = CALENDRIER_EXTERNE;
  } else {
    var t = new Date(); calAnnee = t.getFullYear(); calMois = t.getMonth();
    rdvDate = null; rdvHeure = null; dessinerCal();
    el("rdv-interne").hidden = false; el("rdv-succes").hidden = true; el("creneaux").hidden = true;
    note("rdv-note", "Rendez-vous téléphonique ou sur site, 7j/7 — sans engagement.", "");
  }
  ouvrir("modal-rdv");
}
function changerMois(d){ calMois += d; if(calMois < 0){ calMois = 11; calAnnee--; } if(calMois > 11){ calMois = 0; calAnnee++; } dessinerCal(); }
function isoLocal(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dessinerCal(){
  var mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  el("cal-titre").textContent = mois[calMois] + " " + calAnnee;
  var g = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map(function(j){ return '<span class="cal-jour">' + j + '</span>'; }).join("");
  var premier = new Date(calAnnee, calMois, 1);
  var decal = (premier.getDay() + 6) % 7;
  for(var v = 0; v < decal; v++) g += "<span></span>";
  var nb = new Date(calAnnee, calMois + 1, 0).getDate();
  var auj = new Date(); auj.setHours(0, 0, 0, 0);
  for(var j = 1; j <= nb; j++){
    var d = new Date(calAnnee, calMois, j);
    var iso = isoLocal(d);
    var passe = d < auj;
    g += '<button type="button" class="cal-case' + (rdvDate === iso ? " choisi" : "") + '"' + (passe ? ' disabled' : '') + ' onclick="choisirJour(\'' + iso + '\')">' + j + '</button>';
  }
  el("cal-grille").innerHTML = g;
}
function choisirJour(iso){
  rdvDate = iso; rdvHeure = null; dessinerCal();
  el("creneaux").hidden = false;
  el("creneaux").innerHTML = RDV_CRENEAUX.map(function(h){
    return '<button type="button" class="creneau" onclick="choisirHeure(this,\'' + h + '\')">' + h + '</button>';
  }).join("");
}
function choisirHeure(btn, h){
  rdvHeure = h;
  document.querySelectorAll(".creneau").forEach(function(b){ b.classList.remove("choisi"); });
  btn.classList.add("choisi");
}
function envoyerRdv(){
  var nom = el("rdv-nom").value.trim(), rdvEmail = el("rdv-email").value.trim();
  var tel = el("rdv-indicatif").value + " " + el("rdv-tel").value.trim();
  var contact = tel + (rdvEmail ? " · " + rdvEmail : "");
  if(!rdvDate){ note("rdv-note", "⚠ Merci de choisir une date dans le calendrier.", ROUGE); return; }
  if(!rdvHeure){ note("rdv-note", "⚠ Merci de choisir un créneau horaire.", ROUGE); return; }
  if(!nom){ note("rdv-note", "⚠ Merci d'indiquer votre nom.", ROUGE); return; }
  if(!telNational(el("rdv-tel").value)){ note("rdv-note", "⚠ Téléphone mobile obligatoire pour un rendez-vous : indicatif pays puis numéro commençant par 0 (ex. : 0612345678).", ROUGE); return; }
  if(rdvEmail.indexOf("@") < 1){ note("rdv-note", "⚠ Email obligatoire pour recevoir la confirmation du rendez-vous.", ROUGE); return; }
  var dateFr = dateLongue(rdvDate);
  var uid = "rdv-" + rdvDate + "-" + rdvHeure.replace(":", "") + "-" + Math.floor(100 + Math.random() * 900);
  var evClient = {titre: "Rendez-vous " + LEGAL.marque, date: rdvDate, heure: rdvHeure, duree: RDV_DUREE_MIN, uid: uid,
    details: "Rendez-vous téléphonique ou sur site avec " + LEGAL.marque + ".\nNous vous rappelons pour confirmer.\nContact : " + LEGAL.email};
  var evSociete = {titre: "RDV client — " + nom + " (" + tel + ")", date: rdvDate, heure: rdvHeure, duree: RDV_DUREE_MIN, uid: uid + "-edenel",
    details: "Demande de rendez-vous reçue depuis le site.\nClient : " + nom + "\nContact : " + contact + "\nÀ rappeler pour confirmer."};
  var lienClient = lienGoogleAgenda(evClient), lienSociete = lienGoogleAgenda(evSociete);
  function succes(msg, couleur){
    el("rdv-recap").textContent = dateFr + " à " + rdvHeure + " — " + nom;
    boutonsAgenda("rdv-agenda", evClient, "rendez-vous-edenel-" + rdvDate + ".ics");
    el("rdv-interne").hidden = true; el("rdv-succes").hidden = false;
    note("rdv-succes-note", msg, couleur || VERT);
  }
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("Demande de RENDEZ-VOUS — " + LEGAL.marque)
      + "&body=" + encodeURIComponent("Rendez-vous souhaité : " + dateFr + " à " + rdvHeure + "\nNom : " + nom + "\nContact : " + contact + "\nAjouter à l'agenda : " + lienSociete);
    succes("Mode test local : votre logiciel de messagerie s'est ouvert avec la demande pré-remplie. En ligne, l'envoi est automatique."); return;
  }
  note("rdv-note", "Envoi en cours…", GRIS);
  envoyerFormulaire({
    _subject: "RENDEZ-VOUS — " + dateFr + " à " + rdvHeure + " — " + nom,
    email: rdvEmail,
    _autoresponse: "Bonjour " + nom + ",\n\nNous avons bien reçu votre demande de rendez-vous pour le " + dateFr + " à " + rdvHeure + ". Nous vous rappelons très vite au " + tel + " pour confirmer le créneau.\n\nAjoutez ce rendez-vous à votre Google Agenda en un clic :\n" + lienClient + "\n\nÀ très bientôt,\n" + LEGAL.marque + " — " + LEGAL.filiation + "\n" + LEGAL.email,
    "Rendez-vous demandé": dateFr + " à " + rdvHeure,
    "Nom": nom,
    "Contact": contact,
    "AJOUTER À L'AGENDA EDENEL (1 clic)": lienSociete
  }).then(function(){
    succes("✓ Demande envoyée. Un email de confirmation vient de vous être adressé ; nous vous rappelons pour valider le créneau. Enregistrez-le dès maintenant dans votre agenda :");
  }).catch(function(){
    succes("⚠ L'envoi automatique n'a pas abouti — écrivez-nous à " + LEGAL.email + " en indiquant « RDV " + dateFr + " à " + rdvHeure + " ». Vous pouvez déjà enregistrer le créneau :", ROUGE);
  });
}
/* ====== ENVOI DES FORMULAIRES (FormSubmit, mode AJAX) ====== */
function envoyerFormulaire(charge){
  return fetch(FORMSUBMIT, {
    method: "POST",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify(Object.assign({_captcha: "false"}, charge))
  }).then(function(r){ if(!r.ok) throw new Error("FormSubmit " + r.status); return r; });
}

/* ====== AGENDA : « Ajouter à Google Agenda » (1 clic) et fichier .ics (Apple / Outlook) ====== */
var RDV_DUREE_MIN = 30;
function pad2(n){ return String(n).padStart(2, "0"); }
function horodatage(dateStr, heureStr){ /* "2026-09-25" + "09:30" -> "20260925T093000" (heure de Paris) */
  var h = (heureStr || "09:00").split(":");
  return dateStr.replace(/-/g, "") + "T" + pad2(h[0]) + pad2(h[1] || 0) + "00";
}
function ajouterMinutes(dateStr, heureStr, minutes){
  var h = (heureStr || "09:00").split(":");
  var d = new Date(dateStr + "T" + pad2(h[0]) + ":" + pad2(h[1] || 0) + ":00");
  d.setMinutes(d.getMinutes() + minutes);
  return {date: isoLocal(d), heure: pad2(d.getHours()) + ":" + pad2(d.getMinutes())};
}
function lienGoogleAgenda(ev){
  var fin = ajouterMinutes(ev.date, ev.heure, ev.duree);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(ev.titre)
    + "&dates=" + horodatage(ev.date, ev.heure) + "/" + horodatage(fin.date, fin.heure)
    + "&ctz=Europe/Paris"
    + "&details=" + encodeURIComponent(ev.details || "")
    + (ev.lieu ? "&location=" + encodeURIComponent(ev.lieu) : "");
}
function contenuICS(ev){
  var fin = ajouterMinutes(ev.date, ev.heure, ev.duree);
  var uid = (ev.uid || ("edenel-" + Date.now())) + "@edenelnettoyage.fr";
  var maintenant = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  var esc = function(t){ return String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); };
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EDENEL NETTOYAGE PRO//Site web//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + maintenant,
    "DTSTART;TZID=Europe/Paris:" + horodatage(ev.date, ev.heure),
    "DTEND;TZID=Europe/Paris:" + horodatage(fin.date, fin.heure),
    "SUMMARY:" + esc(ev.titre), "DESCRIPTION:" + esc(ev.details),
    ev.lieu ? "LOCATION:" + esc(ev.lieu) : "",
    "ORGANIZER;CN=" + esc(LEGAL.marque) + ":mailto:" + LEGAL.email,
    "BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:" + esc(ev.titre), "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
}
function telechargerICS(ev, nomFichier){
  var blob = new Blob([contenuICS(ev)], {type: "text/calendar;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href = url; a.download = nomFichier || "rendez-vous-edenel.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
}
/* Remplit un conteneur avec les deux boutons agenda */
function boutonsAgenda(conteneurId, ev, nomFichier){
  var c = el(conteneurId); if(!c) return;
  c.innerHTML = '<a class="btn btn-plein" target="_blank" rel="noopener" href="' + echapper(lienGoogleAgenda(ev)) + '">Ajouter à Google Agenda</a>'
    + '<button class="btn btn-ligne" type="button" id="' + conteneurId + '-ics">Fichier .ics (Apple / Outlook)</button>';
  el(conteneurId + "-ics").onclick = function(){ telechargerICS(ev, nomFichier); };
  c.hidden = false;
}

/* ====== DOCUMENTS PDF (devis, facture, historique) — jsPDF chargé à la demande, aucune fenêtre pop-up ====== */
var JSPDF_URL = {{ "js/jspdf.umd.min.js" | relURL | jsonify | safeJS }};
var jsPDFEnCours = null;
var PDF = {encre: [30, 42, 110], petrole: [30, 140, 168], chevron: [62, 189, 142], gris: [90, 103, 124], ligne: [220, 231, 236], clair: [247, 250, 252], orange: [180, 99, 42]};
function pdfL(doc){ return doc.internal.pageSize.getWidth(); }
function pdfH(doc){ return doc.internal.pageSize.getHeight(); }
function pdfM(doc){ return doc.__marge || 18; }
function pdfEntete(doc){
  var M = pdfM(doc), W = pdfL(doc);
  doc.setFillColor.apply(doc, PDF.encre); doc.rect(0, 0, W, 34, "F");
  doc.setFillColor.apply(doc, PDF.petrole); doc.triangle(M, 22, M + 9, 13, M + 18, 22, "F");
  doc.setFillColor.apply(doc, PDF.chevron); doc.triangle(M + 3, 27, M + 9, 19, M + 15, 27, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("EDENEL", M + 24, 17);
  doc.setFontSize(8.5); doc.setTextColor(150, 210, 225); doc.text("N E T T O Y A G E   P R O F E S S I O N N E L", M + 24, 23);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(210, 220, 235); doc.text(LEGAL.filiation, M + 24, 28);
}
function pdfPied(doc){
  var M = pdfM(doc), W = pdfL(doc), yb = pdfH(doc) - 27;
  doc.setDrawColor.apply(doc, PDF.ligne); doc.setLineWidth(0.2); doc.line(M, yb, W - M, yb);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.3); doc.setTextColor(138, 150, 172);
  doc.text(LEGAL.marque + " — " + LEGAL.filiation, M, yb + 5);
  doc.text(LEGAL.raison + " · " + LEGAL.forme, M, yb + 9);
  doc.text("Siège social : " + LEGAL.adresse, M, yb + 13);
  doc.text("SIRET " + LEGAL.siret + " · " + LEGAL.rcs + " · TVA " + LEGAL.tvaIntra + " · " + LEGAL.email, M, yb + 17);
}
function pdfSaut(doc, y, besoin){
  if(y + (besoin || 20) > pdfH(doc) - 32){ doc.addPage(); pdfEntete(doc); pdfPied(doc); return 44; }
  return y;
}
function pdfTitre(doc, titre, sousTitres){
  var M = pdfM(doc), y = 48;
  doc.setTextColor.apply(doc, PDF.encre); doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(titre, M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor.apply(doc, PDF.gris);
  (sousTitres || []).forEach(function(l){ y += 5.5; doc.text(l, M, y); });
  return y + 7;
}
function pdfBloc(doc, y, titre, lignes){
  var M = pdfM(doc), W = pdfL(doc), h = 13 + lignes.length * 6;
  y = pdfSaut(doc, y, h);
  doc.setDrawColor.apply(doc, PDF.ligne); doc.setFillColor.apply(doc, PDF.clair); doc.roundedRect(M, y, W - 2 * M, h, 3, 3, "FD");
  doc.setTextColor.apply(doc, PDF.encre); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(titre, M + 5, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor.apply(doc, PDF.gris);
  lignes.forEach(function(l, i){ doc.text(String(l), M + 5, y + 15 + i * 6); });
  return y + h + 6;
}
/* Tableau : colonnes [{titre, largeur, align, gras}], lignes [[cellule, …]] — gère les sauts de page */
function pdfTableau(doc, y, colonnes, lignes){
  var M = pdfM(doc), W = pdfL(doc), largeurTotale = W - 2 * M, pad = 2.5;
  function entete(){
    doc.setFillColor.apply(doc, PDF.encre); doc.rect(M, y, largeurTotale, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    var x = M;
    colonnes.forEach(function(c){ doc.text(c.titre, c.align === "right" ? x + c.largeur - pad : x + pad, y + 5.5, {align: c.align === "right" ? "right" : "left"}); x += c.largeur; });
    y += 8;
  }
  y = pdfSaut(doc, y, 20); entete();
  lignes.forEach(function(row, ri){
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
    var cellules = colonnes.map(function(c, ci){ return doc.splitTextToSize(String(row[ci] == null ? "" : row[ci]), c.largeur - 2 * pad); });
    var nb = Math.max.apply(null, cellules.map(function(c){ return c.length; }));
    var h = nb * 4.4 + 3.6;
    if(y + h > pdfH(doc) - 32){ doc.addPage(); pdfEntete(doc); pdfPied(doc); y = 44; entete(); }
    if(ri % 2 === 0){ doc.setFillColor.apply(doc, PDF.clair); doc.rect(M, y, largeurTotale, h, "F"); }
    var x = M;
    colonnes.forEach(function(c, ci){
      if(c.gras){ doc.setFont("helvetica", "bold"); doc.setTextColor.apply(doc, PDF.encre); } else { doc.setFont("helvetica", "normal"); doc.setTextColor.apply(doc, PDF.gris); }
      doc.setFontSize(8.8);
      doc.text(cellules[ci], c.align === "right" ? x + c.largeur - pad : x + pad, y + 4.4, {align: c.align === "right" ? "right" : "left"});
      x += c.largeur;
    });
    doc.setDrawColor.apply(doc, PDF.ligne); doc.setLineWidth(0.2); doc.line(M, y + h, W - M, y + h);
    y += h;
  });
  return y + 5;
}
function pdfTotaux(doc, y, lignes){
  var M = pdfM(doc), W = pdfL(doc);
  y = pdfSaut(doc, y, lignes.length * 8 + 6);
  lignes.forEach(function(l){
    if(l[2]){ doc.setDrawColor.apply(doc, PDF.chevron); doc.setLineWidth(0.7); doc.line(W - M - 85, y, W - M, y); doc.setLineWidth(0.2); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor.apply(doc, PDF.encre); y += 2.5; }
    else { doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor.apply(doc, PDF.gris); }
    doc.text(l[0], W - M - 42, y + 4.5, {align: "right"});
    doc.text(l[1], W - M, y + 4.5, {align: "right"});
    y += l[2] ? 9 : 6.5;
  });
  return y + 5;
}
function pdfEncadre(doc, y, titre, texte, teinte){
  var M = pdfM(doc), W = pdfL(doc);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.3);
  var lignes = doc.splitTextToSize(texte, W - 2 * M - 10);
  var h = 12 + lignes.length * 4.2;
  y = pdfSaut(doc, y, h);
  var orange = teinte === "orange";
  doc.setDrawColor.apply(doc, orange ? [244, 216, 196] : PDF.ligne); doc.setFillColor.apply(doc, orange ? [252, 246, 240] : PDF.clair);
  doc.roundedRect(M, y, W - 2 * M, h, 3, 3, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor.apply(doc, orange ? PDF.orange : PDF.encre); doc.text(titre, M + 5, y + 6.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor.apply(doc, PDF.gris); doc.text(lignes, M + 5, y + 12);
  return y + h + 6;
}
function pdfSection(doc, y, titre){
  var M = pdfM(doc);
  y = pdfSaut(doc, y, 16);
  doc.setTextColor.apply(doc, PDF.encre); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(titre, M, y);
  doc.setFillColor.apply(doc, PDF.chevron); doc.rect(M, y + 2.5, Math.min(doc.getTextWidth(titre), 40), 0.8, "F");
  return y + 9;
}
function pdfBadge(doc, y, texte){
  var M = pdfM(doc);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  var w = doc.getTextWidth(texte) + 10;
  doc.setFillColor(231, 247, 240); doc.roundedRect(M, y, w, 8, 4, 4, "F");
  doc.setTextColor(31, 122, 85); doc.text(texte, M + 5, y + 5.5);
  return y + 14;
}
/* Crée un document, place en-tête et pied, exécute le rappel puis gère l'erreur */
function nouveauPDF(cb, surErreur, options){
  return chargerJsPDF().then(function(jsPDF){
    var doc = new jsPDF(Object.assign({unit: "mm", format: "a4"}, options || {}));
    doc.__marge = (options && options.marge) || 18;
    pdfEntete(doc); pdfPied(doc);
    return cb(doc);
  }).catch(function(e){ if(surErreur) surErreur(e); else console.error(e); });
}
/* ====== GÉNÉRATEUR DE DEVIS ====== */
function basculerDevis(){
  var pnl = el("panneau-devis");
  pnl.hidden = !pnl.hidden;
  if(!pnl.hidden) pnl.scrollIntoView({behavior: "smooth", block: "nearest"});
}
function genererDevis(){
  var prenom = el("dv-prenom").value.trim(), nom = el("dv-nom").value.trim();
  var societe = el("dv-societe").value.trim(), email = el("dv-email").value.trim();
  if(!prenom || !nom || email.indexOf("@") < 1){
    note("dv-note", "⚠ Merci d'indiquer votre prénom, votre nom et un email valide (le devis vous est envoyé par email).", ROUGE); return;
  }
  var lignes = panier.slice().concat(lignesCourantes());
  if(lignes.length === 0){
    note("dv-note", "⚠ Configurez une prestation ci-dessus (champs requis selon l'univers choisi) ou ajoutez-en au panier.", ROUGE); return;
  }
  var nbDepl = nbDeplacements(lignes);
  var depl = r2(nbDepl * DEPL_HT);
  var htMensuel = r2(lignes.filter(function(it){ return it.mensuel; }).reduce(function(s, it){ return s + it.ht; }, 0));
  var ht = r2(lignes.filter(function(it){ return !it.mensuel; }).reduce(function(s, it){ return s + it.ht; }, 0) + depl);
  var tva = r2(ht * TVA), ttc = r2(ht + tva);
  var num = "DEV-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900);
  var dateFr = new Date().toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"});
  var client = prenom + " " + nom + (societe ? " — " + societe : "");
  var resume = lignes.map(function(it){
    var quand = it.date ? " — le " + frDate(it.date) : "";
    return "• " + it.titre + " — " + it.detail + quand + " à " + it.adresse + " : " + eur(it.ht) + (it.mensuel ? " HT/mois" : " HT");
  }).join("\n");
  var texte = "Bonjour " + prenom + ",\n\nVoici votre devis " + num + " établi le " + dateFr + " (validité : 30 jours calendaires) :\n\n" + resume
    + "\nFrais de déplacement : " + eur(depl) + " HT (" + nbDepl + " intervention(s))"
    + "\n\nTotal HT : " + eur(ht) + "\nTVA (20 %) : " + eur(tva) + "\nTOTAL TTC : " + eur(ttc)
    + (htMensuel > 0 ? "\nContrats mensuels : " + eur(htMensuel) + " HT/mois, soit " + eur(r2(htMensuel * (1 + TVA))) + " TTC/mois (estimation à confirmer après visite)" : "")
    + "\n\nPour commander : rendez-vous sur notre site, bouton « Passer commande ».\n\n" + LEGAL.marque + " — " + LEGAL.filiation + "\n" + LEGAL.email;

  note("dv-note", "Génération de votre devis…", GRIS);
  nouveauPDF(function(doc){
    var y = pdfTitre(doc, "Devis n° " + num, ["Établi le " + dateFr + " — Validité : 30 jours calendaires à compter de cette date", "Gratuit et sans engagement"]);
    y = pdfBloc(doc, y, "Client", [client, "Email : " + email]);
    var rows = lignes.map(function(it){
      var quand = it.date ? "Le " + frDate(it.date) + (it.heure ? " à " + it.heure : "") + " — " : "";
      return [it.titre + "\n" + it.detail + "\n" + quand + it.adresse, eur(it.ht) + (it.mensuel ? " /mois" : "")];
    });
    rows.push(["Frais de déplacement — " + nbDepl + " intervention(s) × " + eur(DEPL_HT) + " HT", eur(depl)]);
    y = pdfTableau(doc, y, [{titre: "Prestation", largeur: 134}, {titre: "Montant HT", largeur: 40, align: "right", gras: true}], rows);
    y = pdfTotaux(doc, y, [["Total HT", eur(ht)], ["TVA (20 %)", eur(tva)], ["Total TTC", eur(ttc), true]]);
    if(htMensuel > 0) y = pdfEncadre(doc, y, "Contrats mensuels", eur(htMensuel) + " HT/mois, soit " + eur(r2(htMensuel * (1 + TVA))) + " TTC/mois — estimation à confirmer après visite gratuite.");
    y = pdfEncadre(doc, y, "Conditions", "Tarifs conformes à notre grille en vigueur. Les produits d'entretien obligatoires sont avancés par nos soins (" + PROD_ENTRETIEN + " € HT) sauf s'ils sont déjà fournis dans le logement par le donneur d'ordre ; en leur absence, la prestation de ménage est reportée et de nouveaux frais de déplacement sont facturés. Majoration de 10 % les dimanches et jours fériés. Commande le jour même : avant 11 h 30, selon disponibilité.", "orange");
    doc.save("devis-edenel-" + num + ".pdf");

    if(estLocal()){
      location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("DEVIS " + num + " — " + client) + "&body=" + encodeURIComponent(texte);
      note("dv-note", "✓ Devis " + num + " téléchargé en PDF. Mode test local : votre messagerie s'est ouverte — en ligne, l'envoi par email est automatique.", VERT); return;
    }
    envoyerFormulaire({_subject: "DEVIS " + num + " généré — " + client, email: email, _autoresponse: texte, "Client": client, "Devis": num, "Détail": resume, "Total": eur(ht) + " HT / " + eur(ttc) + " TTC"})
      .then(function(){ note("dv-note", "✓ Devis " + num + " téléchargé en PDF, et une copie vous a été envoyée à " + email + ".", VERT); })
      .catch(function(){ note("dv-note", "✓ Devis " + num + " téléchargé en PDF. ⚠ L'envoi par email n'a pas abouti — conservez le PDF ou contactez-nous : " + LEGAL.email, ROUGE); });
  }, function(){
    note("dv-note", "⚠ Le générateur PDF n'a pas pu se charger. Réessayez, ou contactez-nous : " + LEGAL.email, ROUGE);
  });
}
/* ====== FORMULAIRE DE CONTACT (FormSubmit classique ; repli mailto en local) ====== */
function champsFormulaire(form){
  /* Récupère tous les champs nommés du formulaire, sauf les champs techniques FormSubmit */
  var données = [];
  form.querySelectorAll("input[name], select[name], textarea[name]").forEach(function(ch){
    var nom = ch.getAttribute("name");
    if(!nom || nom.charAt(0) === "_" || nom === "email") return;
    if(ch.value.trim()) données.push([nom, ch.value.trim()]);
  });
  var mail = form.querySelector('input[name="email"]');
  return {email: mail ? mail.value.trim() : "", champs: données};
}
function noteContact(id, texte, couleur){ note(id, texte, couleur) || note("note-maquette", texte, couleur); }
(function(){
  var fc = el("form-contact");
  if(!fc) return;
  fc.addEventListener("submit", function(ev){
    if(!estLocal()) return;
    ev.preventDefault();
    var d = champsFormulaire(fc);
    var corps = "Email : " + d.email + "\n" + d.champs.map(function(c){ return c[0] + " : " + c[1]; }).join("\n");
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("Demande de devis — " + LEGAL.marque) + "&body=" + encodeURIComponent(corps);
    var msg = "✓ Mode test local : votre logiciel de messagerie s'est ouvert avec la demande pré-remplie — cliquez sur Envoyer. Une fois le site en ligne, l'envoi est automatique.";
    if(el("ct-note")) note("ct-note", msg, VERT); else note("note-maquette", msg, VERT);
  });
})();

/* ====== TÉLÉCHARGEMENT DU DEVIS EN PDF (page Contact) ====== */
function chargerJsPDF(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if(jsPDFEnCours) return jsPDFEnCours;
  jsPDFEnCours = new Promise(function(resolve, reject){
    var sc = document.createElement("script");
    sc.src = JSPDF_URL;
    sc.onload = function(){ (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF indisponible")); };
    sc.onerror = function(){ reject(new Error("Chargement de jsPDF impossible")); };
    document.head.appendChild(sc);
  });
  return jsPDFEnCours;
}
function majDispoDevis(){
  var btn = el("btn-devis-pdf");
  if(!btn) return;
  var email = (el("ct-email") || {}).value || "";
  var ok = email.indexOf("@") > 0 && email.indexOf(".") > 0;
  btn.classList.toggle("pret", ok);
}
function telechargerDevisContact(){
  var email = ((el("ct-email") || {}).value || "").trim();
  if(email.indexOf("@") < 1 || email.lastIndexOf(".") < email.indexOf("@")){
    note("ct-note", "⚠ Merci d'indiquer un email valide : votre demande de devis vous sera aussi envoyée à cette adresse, puis le téléchargement démarre.", ROUGE);
    var champEmail = el("ct-email"); if(champEmail){ champEmail.focus(); }
    return;
  }
  note("ct-note", "Préparation de votre demande de devis…", GRIS);
  var nom = ((el("ct-nom") || {}).value || "").trim();
  var tel = ((el("ct-tel") || {}).value || "").trim();
  var presta = (el("ct-presta") || {}).value || "";
  var lieu = ((el("ct-lieu") || {}).value || "").trim();
  var besoin = ((el("ct-msg") || {}).value || "").trim();
  var num = "DEV-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900);
  var dateFr = new Date().toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"});
  nouveauPDF(function(doc){
    var y = pdfTitre(doc, "Demande de devis", ["N° " + num + " — établie le " + dateFr, "Devis chiffré et personnalisé retourné sous 24 h, gratuit et sans engagement."]);
    y = pdfBloc(doc, y, "Vos coordonnées", ["Nom : " + (nom || "—"), "Email : " + email, "Téléphone : " + (tel || "—") + "      Secteur du bien : " + (lieu || "—")]);
    y = pdfSection(doc, y, "Prestation souhaitée");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor.apply(doc, PDF.petrole); doc.text("• " + presta, pdfM(doc), y); y += 9;
    if(besoin){
      y = pdfSection(doc, y, "Votre besoin");
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor.apply(doc, PDF.gris);
      var lignes = doc.splitTextToSize(besoin, pdfL(doc) - 2 * pdfM(doc)); doc.text(lignes, pdfM(doc), y); y += lignes.length * 5.5 + 4;
    }
    y = pdfEncadre(doc, y, "Repères tarifaires (HT, hors devis personnalisé)", "Ménage : à partir de " + TARIF_BASE + " € HT/h  •  Bureaux : dès 3,50 € HT/m²/mois  •  Copropriétés : dès 250 € HT/mois\nFrais de déplacement : " + DEPL_HT + " € HT/commande  •  TVA 20 %  •  Tarif Fidélité −8 % dès la 5ᵉ commande.", "orange");
    doc.save("demande-devis-edenel-" + num + ".pdf");
    var msg = "✓ Votre demande de devis " + num + " a été téléchargée en PDF.";
    if(estLocal()){ note("ct-note", msg + " (Mode test local : pensez à nous l'envoyer par email.)", VERT); return; }
    envoyerFormulaire({
      _subject: "Demande de devis " + num + " — " + (nom || email),
      email: email,
      _autoresponse: "Bonjour" + (nom ? " " + nom : "") + ",\n\nNous avons bien reçu votre demande de devis " + num + " (prestation : " + presta + "). Nous vous adressons un devis chiffré et personnalisé sous 24 h.\n\n" + LEGAL.marque + " — " + LEGAL.filiation + "\n" + LEGAL.email,
      "Demande": num, "Nom": nom || "—", "Téléphone": tel || "—", "Prestation": presta, "Secteur": lieu || "—", "Besoin": besoin || "—"
    }).then(function(){ note("ct-note", msg + " Une copie vous a été envoyée à " + email + " — réponse chiffrée sous 24 h.", VERT); })
      .catch(function(){ note("ct-note", msg + " Envoyez-le nous par email à " + LEGAL.email + " pour recevoir votre devis chiffré.", VERT); });
  }, function(){ note("ct-note", "⚠ Le générateur PDF n'a pas pu se charger. Utilisez « Contacter par email » ou écrivez-nous à " + LEGAL.email + ".", ROUGE); });
}
function fermerFormContact(){
  var f = el("form-contact");
  f.style.display = "none";
  var r = document.createElement("button");
  r.type = "button"; r.className = "btn btn-ligne";
  r.textContent = "Rouvrir le formulaire de contact";
  r.onclick = function(){ f.style.display = ""; r.remove(); };
  f.parentNode.insertBefore(r, f.nextSibling);
}

/* ====== BON DE RÉCEPTION & FACTURATION ====== */
function choisirVolet(v){
  el("ong-br").classList.toggle("actif", v === "br");
  el("ong-fact").classList.toggle("actif", v === "fact");
  el("volet-br").hidden = v !== "br";
  el("volet-fact").hidden = v !== "fact";
}
function envoyerBR(){
  var num = el("br-num").value.trim(), dateStr = el("br-date").value;
  var nom = el("br-nom").value.trim(), email = el("br-email").value.trim();
  if(!num || !dateStr || !nom || email.indexOf("@") < 1){ note("br-note", "⚠ Merci de renseigner le n° de commande, la date, votre nom et votre email.", ROUGE); return; }
  if(!el("br-ok").checked){ note("br-note", "⚠ Merci de cocher la case « Bon de réception » pour valider.", ROUGE); return; }
  majRecordBR(num, el("br-heure").value);
  var dateFr = frDate(dateStr);
  var corps = "BON DE RÉCEPTION validé par le client\nCommande : " + num + "\nIntervention du : " + dateFr + (el("br-heure").value ? " à " + el("br-heure").value : "") + "\nClient : " + nom + " (" + email + ")\nObservations : " + (el("br-comm").value.trim() || "aucune");
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("BON DE RÉCEPTION — " + num) + "&body=" + encodeURIComponent(corps);
    note("br-note", "✓ Mode test local : votre messagerie s'est ouverte avec le bon de réception pré-rempli — cliquez sur Envoyer.", VERT); return;
  }
  note("br-note", "Envoi en cours…", GRIS);
  envoyerFormulaire({
    _subject: "BON DE RÉCEPTION — " + num, email: email,
    _autoresponse: "Bonjour " + nom + ",\n\nNous accusons réception de votre bon de réception pour la commande " + num + " (intervention du " + dateFr + "). Votre facture vous sera transmise après notre validation interne, au plus tôt 5 h après l'heure d'intervention planifiée.\n\n" + LEGAL.marque + " — " + LEGAL.filiation,
    "Bon de réception": corps
  }).then(function(){
    note("br-note", "✓ Bon de réception transmis. Un accusé vous a été envoyé par email ; votre facture suivra après notre validation interne (au plus tôt 5 h après l'heure planifiée).", VERT);
  }).catch(function(){
    note("br-note", "⚠ L'envoi n'a pas abouti — écrivez-nous à " + LEGAL.email + " en indiquant votre n° de commande.", ROUGE);
  });
}
function genererFacture(){
  if(el("ft-code").value !== CODE_INTERNE){ note("ft-note", "⚠ Code interne incorrect — étape réservée à l'équipe EDENEL.", ROUGE); return; }
  var num = el("ft-num").value.trim(), client = el("ft-client").value.trim(), email = el("ft-email").value.trim();
  var dateStr = el("ft-date").value, ht = parseFloat(el("ft-ht").value);
  var detail = el("ft-detail").value.trim();
  if(!num || !client || !dateStr || !detail || isNaN(ht) || ht <= 0){ note("ft-note", "⚠ Merci de renseigner tous les champs (n°, client, date, détail, montant HT).", ROUGE); return; }
  if(!el("ft-v1").checked || !el("ft-v2").checked){ note("ft-note", "⚠ Les deux validations (① client et ② interne) sont obligatoires avant facturation.", ROUGE); return; }
  var heurePlan = el("ft-heure").value;
  if(!heurePlan){ note("ft-note", "⚠ Merci d'indiquer l'heure d'intervention planifiée.", ROUGE); return; }
  var dispo = new Date(dateStr + "T" + heurePlan + ":00").getTime() + 5 * 3600 * 1000;
  if(Date.now() < dispo){ note("ft-note", "⚠ Facture disponible au plus tôt 5 h après l'heure d'intervention planifiée (à partir du " + new Date(dispo).toLocaleString("fr-FR", {day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"}) + ").", ROUGE); return; }
  var tva = r2(ht * TVA), ttc = r2(ht + tva);
  var numF = "FAC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900);
  var dateFr = new Date().toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"});
  var statut = el("ft-statut").value;
  note("ft-note", "Génération de la facture…", GRIS);
  nouveauPDF(function(doc){
    var y = pdfTitre(doc, "Facture n° " + numF, ["Émise le " + dateFr + " — Référence commande / devis : " + num, "Intervention effectuée le " + frDate(dateStr) + " (planifiée à " + heurePlan + ")"]);
    y = pdfBadge(doc, y, statut);
    y = pdfBloc(doc, y, "Client", [client, email ? "Email : " + email : ""].filter(Boolean));
    var rows = detail.split("\n").filter(function(l){ return l.trim(); }).map(function(l){ return [l.trim()]; });
    y = pdfTableau(doc, y, [{titre: "Prestations réalisées", largeur: 174}], rows);
    y = pdfTotaux(doc, y, [["Total HT", eur(ht)], ["TVA (20 %)", eur(tva)], ["Total TTC", eur(ttc), true]]);
    y = pdfEncadre(doc, y, "Double validation", "Facture émise après ① bon de réception validé par le client et ② validation interne EDENEL, au plus tôt 5 h après l'heure d'intervention planifiée.");
    y = pdfEncadre(doc, y, "Conditions d'annulation", ANNULATION, "orange");
    doc.save("facture-edenel-" + numF + ".pdf");
    note("ft-note", "✓ Facture " + numF + " téléchargée en PDF — transmettez-la au client par email.", VERT);
  }, function(){ note("ft-note", "⚠ Le générateur PDF n'a pas pu se charger. Réessayez dans un instant.", ROUGE); });
}
/* ====== ESPACE CLIENT (données locales au navigateur — aucun stockage sur le site) ====== */
var COMPTE_KEY = "edenel_compte", CMD_KEY = "edenel_commandes";
var compteConnecte = false;
function lireJSON(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function ecrireJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function lireCmds(){ return lireJSON(CMD_KEY) || []; }

function ouvrirCompte(){
  var c = lireJSON(COMPTE_KEY);
  if(c && compteConnecte){ afficherTableau(); el("zone-auth").hidden = true; el("zone-tableau").hidden = false; }
  else{
    el("zone-auth").hidden = false; el("zone-tableau").hidden = true;
    if(c){ el("auth-sous").textContent = "Bon retour ! Connectez-vous avec votre email et votre code secret."; el("cp-email").value = c.email; }
  }
  ouvrir("modal-compte");
}
function creerCompte(){
  var nom = el("cp-nom").value.trim(), email = el("cp-email").value.trim(), pin = el("cp-pin").value, tel = el("cp-tel").value.trim();
  if(!nom || email.indexOf("@") < 1 || pin.length < 4){ note("auth-note", "⚠ Merci d'indiquer votre nom, un email valide et un code d'au moins 4 chiffres.", ROUGE); return; }
  if(!valideTel(tel)){ note("auth-note", "⚠ Téléphone mobile obligatoire, au format indicatif pays + 0 (ex. : +33 0612345678) — il servira à la vérification en cas de code oublié.", ROUGE); return; }
  var initiales = nom.split(/\s+/).map(function(m){ return m.charAt(0).toUpperCase(); }).join("").slice(0, 4) || "CL";
  var numero = initiales + "-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(10 + Math.random() * 90);
  var compte = {nom: nom, email: email, pin: pin, tel: tel, numero: numero, cree: new Date().toISOString().slice(0, 10)};
  if(!ecrireJSON(COMPTE_KEY, compte)){ note("auth-note", "⚠ Impossible d'enregistrer sur cet appareil (navigation privée ?).", ROUGE); return; }
  compteConnecte = true; el("zone-auth").hidden = true; el("zone-tableau").hidden = false; afficherTableau();
  var fiche = "NOUVEAU NUMÉRO CLIENT : " + numero + "\nNom : " + nom + "\nEmail : " + email + "\nTéléphone : " + tel + "\nCréé le : " + new Date().toLocaleDateString("fr-FR");
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("RÉFÉRENTIEL CLIENT — " + numero) + "&body=" + encodeURIComponent(fiche);
  } else {
    envoyerFormulaire({_subject: "RÉFÉRENTIEL CLIENT — " + numero, "Fiche client": fiche}).catch(function(){});
  }
}
function codeOublie(){
  var c = lireJSON(COMPTE_KEY);
  var email = el("cp-email").value.trim();
  if(!c){ note("auth-note", "⚠ Aucun compte n'existe sur cet appareil.", ROUGE); return; }
  if(email.toLowerCase() !== c.email.toLowerCase()){ note("auth-note", "⚠ Indiquez d'abord l'email du compte (votre identifiant) dans le champ Email.", ROUGE); return; }
  var nouveau = String(Math.floor(100000 + Math.random() * 900000));
  if(estLocal()){
    c.pin = nouveau; ecrireJSON(COMPTE_KEY, c);
    note("auth-note", "Mode test local : votre nouveau code secret est " + nouveau + " (en ligne, il vous serait envoyé par email).", VERT); return;
  }
  envoyerFormulaire({
    _subject: "Réinitialisation code Espace client — " + (c.numero || ""), email: email,
    _autoresponse: "Bonjour " + c.nom + ",\n\nVotre nouveau code secret pour l'Espace client EDENEL est : " + nouveau + "\n\nIl remplace l'ancien immédiatement. Si vous n'êtes pas à l'origine de cette demande, contactez-nous : " + LEGAL.email + "\n\n" + LEGAL.marque,
    "Info": "Réinitialisation demandée pour " + email
  }).then(function(){
    c.pin = nouveau; ecrireJSON(COMPTE_KEY, c);
    note("auth-note", "✓ Un nouveau code secret vient de vous être envoyé par email à " + email + ".", VERT);
  }).catch(function(){
    note("auth-note", "⚠ L'envoi n'a pas abouti — contactez-nous à " + LEGAL.email + ".", ROUGE);
  });
}
function seConnecter(){
  var c = lireJSON(COMPTE_KEY);
  if(!c){ note("auth-note", "⚠ Aucun compte sur cet appareil — créez-le d'abord (bouton vert).", ROUGE); return; }
  if(el("cp-email").value.trim().toLowerCase() !== c.email.toLowerCase() || el("cp-pin").value !== c.pin){
    note("auth-note", "⚠ Email ou code secret incorrect.", ROUGE); return; }
  compteConnecte = true; el("zone-auth").hidden = true; el("zone-tableau").hidden = false; afficherTableau();
}
function seDeconnecter(){ compteConnecte = false; el("zone-tableau").hidden = true; el("zone-auth").hidden = false; }

function enregistrerCommande(){
  if(panier.length === 0) return null;
  var depl = r2(nbDeplacements(panier) * DEPL_HT);
  var ht = r2(panier.reduce(function(s, it){ return s + it.ht; }, 0) + depl);
  var rec = {
    id: "CMD-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900),
    dateCmd: new Date().toISOString().slice(0, 10),
    prestations: panier.map(function(it){ return it.titre; }).join(" + "),
    adresse: Object.keys(panier.reduce(function(a, it){ a[it.adresse] = 1; return a; }, {})).join(" / "),
    dateInt: panier.map(function(it){ return it.date; }).sort()[0],
    ht: ht, ttc: r2(ht * (1 + TVA)),
    heurePlan: "", tel: telComplet(),
    dateBR: null, statutP: "", statutF: "En attente",
    numClient: (lireJSON(COMPTE_KEY) || {}).numero || ""
  };
  var l = lireCmds(); l.push(rec); ecrireJSON(CMD_KEY, l);
  return rec;
}
function statutAuto(r){
  if(r.statutP) return r.statutP;
  var auj = new Date().toISOString().slice(0, 10);
  if(r.dateBR) return "Terminée";
  if(r.dateInt > auj) return "Planifiée";
  if(r.dateInt === auj) return "En cours";
  return "En attente de validation";
}
function majStatut(id, champ, val){
  var l = lireCmds();
  l.forEach(function(r){ if(r.id === id) r[champ] = val; });
  ecrireJSON(CMD_KEY, l);
}
function majRecordBR(num, heure){
  var l = lireCmds(), t = false;
  l.forEach(function(r){ if(r.id.toLowerCase() === num.toLowerCase()){ r.dateBR = new Date().toISOString().slice(0, 10); r.statutP = "Terminée"; if(heure) r.heurePlan = heure; t = true; } });
  if(t) ecrireJSON(CMD_KEY, l);
}
function afficherTableau(){
  var c = lireJSON(COMPTE_KEY) || {nom: ""};
  el("tb-bonjour").textContent = "Bonjour " + c.nom + " — voici le récapitulatif de vos commandes :";
  var lc = lireCmds();
  var cumul = r2(lc.reduce(function(s, x){ return s + x.ttc; }, 0));
  var eligible = lc.length >= 4 || cumul >= 400;
  el("tb-infos").innerHTML = "<strong>Votre numéro client : " + echapper(c.numero || "—") + "</strong>"
    + " · Commandes : <strong>" + lc.length + "</strong>"
    + " · Montant cumulé TTC : <strong>" + eur(cumul) + "</strong>"
    + " — Tarif Fidélité (−8 % à vie) : " + (eligible
      ? "<strong class=\"vert\">acquis ✓</strong> — appliqué automatiquement à votre prochaine commande."
      : "acquis dès la 5ᵉ commande ou 400 € TTC de commandes cumulées.");
  var t = el("tb-table");
  if(lc.length === 0){ t.innerHTML = '<tr><td class="cmd-vide">Aucune commande enregistrée sur cet appareil pour le moment.</td></tr>'; return; }
  var optP = ["", "Planifiée", "En cours", "À corriger", "Terminée"];
  var optF = ["En attente", "Émise", "Payée"];
  t.innerHTML = "<tr><th>Réf.</th><th>Commandée le</th><th>Prestation(s)</th><th>Adresse du bien</th><th>Intervention</th><th>Heure planifiée</th><th>Total HT</th><th>Total TTC</th><th>Bon de réception</th><th>Statut prestation</th><th>Statut facture</th></tr>"
    + lc.map(function(r){
      var selP = '<select onchange="majStatut(\'' + r.id + '\',\'statutP\',this.value)">' + optP.map(function(o){
        var lab = o === "" ? "Auto : " + statutAuto({dateInt: r.dateInt, dateBR: r.dateBR, statutP: ""}) : o;
        return '<option value="' + o + '"' + (r.statutP === o ? " selected" : "") + '>' + lab + '</option>'; }).join("") + '</select>';
      var selF = '<select onchange="majStatut(\'' + r.id + '\',\'statutF\',this.value)">' + optF.map(function(o){
        return '<option' + (r.statutF === o ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>';
      return "<tr><td><strong>" + r.id + "</strong></td><td>" + frDate(r.dateCmd) + "</td><td>" + echapper(r.prestations) + "</td><td>" + echapper(r.adresse) + "</td><td>" + frDate(r.dateInt) + "</td><td>" + (r.heurePlan || "à confirmer") + "</td><td>" + eur(r.ht) + "</td><td>" + eur(r.ttc) + "</td><td>" + (r.dateBR ? "validé le " + frDate(r.dateBR) : "à valider") + "</td><td>" + selP + "</td><td>" + selF + "</td></tr>";
    }).join("");
}
function pdfHistorique(){
  var c = lireJSON(COMPTE_KEY) || {nom: "", email: ""};
  var l = lireCmds();
  var totHT = r2(l.reduce(function(s, r){ return s + r.ht; }, 0));
  var totTTC = r2(l.reduce(function(s, r){ return s + r.ttc; }, 0));
  var btn = document.querySelector('[onclick="pdfHistorique()"]');
  if(btn){ btn.disabled = true; btn.textContent = "Génération…"; }
  nouveauPDF(function(doc){
    var y = pdfTitre(doc, "Historique des commandes et de la facturation", ["Client : " + (c.nom || "") + (c.email ? " — " + c.email : "") + (c.numero ? " — N° client " + c.numero : ""), "Document généré le " + new Date().toLocaleDateString("fr-FR")]);
    var rows = l.map(function(r){ return [r.id, frDate(r.dateCmd), r.prestations, r.adresse, frDate(r.dateInt), r.heurePlan || "—", eur(r.ht), eur(r.ttc), r.dateBR ? frDate(r.dateBR) : "—", statutAuto(r), r.statutF]; });
    if(!rows.length) rows.push(["—", "", "Aucune commande enregistrée sur cet appareil.", "", "", "", "", "", "", "", ""]);
    y = pdfTableau(doc, y, [
      {titre: "Réf.", largeur: 28, gras: true}, {titre: "Commandée", largeur: 21}, {titre: "Prestation(s)", largeur: 52}, {titre: "Adresse", largeur: 44},
      {titre: "Intervention", largeur: 21}, {titre: "Heure", largeur: 13}, {titre: "HT", largeur: 19, align: "right"}, {titre: "TTC", largeur: 19, align: "right"},
      {titre: "BR validé", largeur: 21}, {titre: "Statut", largeur: 20}, {titre: "Facture", largeur: 15}
    ], rows);
    y = pdfTotaux(doc, y, [["Cumul HT", eur(totHT)], ["Cumul TTC", eur(totTTC), true]]);
    pdfEncadre(doc, y, "Information", "Récapitulatif généré localement depuis le navigateur du client — aucune donnée ni facture n'est stockée sur le site.");
    doc.save("historique-edenel-" + new Date().toISOString().slice(0, 10) + ".pdf");
  }, function(){ alert("Le générateur PDF n'a pas pu se charger. Réessayez dans un instant."); }, {orientation: "landscape", marge: 12})
  .then(function(){ if(btn){ btn.disabled = false; btn.textContent = "Télécharger l'historique (PDF)"; } });
}
/* ====== UNIVERS BUREAUX & COPROPRIÉTÉS ====== */
function choisirUnivers(u){
  univers = u;
  ["menage", "bureaux", "copro"].forEach(function(x){
    el("zone-" + x).hidden = x !== u;
    el("ong-u-" + x).classList.toggle("actif", x === u);
  });
  if(u === "menage") calculer();
  if(u === "bureaux") calcBureaux();
  if(u === "copro") calcCopro();
}
function choisirModeBureaux(m){
  modeBureaux = m;
  el("ong-b-ponctuel").classList.toggle("actif", m === "ponctuel");
  el("ong-b-contrat").classList.toggle("actif", m === "contrat");
  el("b-ponctuel").hidden = m !== "ponctuel";
  el("b-contrat").hidden = m !== "contrat";
  el("b-btn-panier").hidden = m !== "ponctuel";
  el("b-btn-voir").hidden = m !== "ponctuel";
  calcBureaux();
}
function calcBureaux(){
  var det = el("b-detail");
  if(modeBureaux === "ponctuel"){
    el("b-lbl-ht").textContent = "Total HT"; el("b-lbl-ttc").textContent = "Total TTC";
    var s = el("bp-service").selectedIndex, h = Math.max(BUREAUX.minH, parseFloat(el("bp-heures").value) || 0);
    var taux = BUREAUX.ponctuel[s].taux;
    det.textContent = BUREAUX.ponctuel[s].n + " : " + taux + " € HT/h × " + h + " h + frais de déplacement " + eur(DEPL_HT) + " HT.";
    afficherBureaux(r2(taux * h + DEPL_HT), "");
  } else {
    el("b-lbl-ht").textContent = "Forfait mensuel HT"; el("b-lbl-ttc").textContent = "Total TTC / mois";
    var m2 = parseFloat(el("bc-surface").value) || 0;
    if(m2 <= 0){ det.textContent = "Indiquez la surface de vos bureaux : l'estimation mensuelle s'affiche instantanément."; afficherBureaux(null, ""); return; }
    if(m2 > 300){
      det.textContent = "Plus de 300 m² : tarification sur devis après visite gratuite sur site — base indicative " + BUREAUX.baseGrand.toLocaleString("fr-FR") + " €/m²/mois, soit environ " + eur(r2(m2 * BUREAUX.baseGrand)) + " HT/mois.";
      afficherBureaux(null, ""); return;
    }
    var t = m2 < 100 ? BUREAUX.tranches[0] : BUREAUX.tranches[1];
    var mens = r2(m2 * t.prix * (el("bc-annuel-bur").checked ? 1 - BUREAUX.remiseAnnuelle : 1));
    det.textContent = m2 + " m² × " + t.prix.toLocaleString("fr-FR") + " €/m²/mois (" + t.freq + ")"
      + (el("bc-annuel-bur").checked ? " · remise annuelle −5 %" : "") + " — estimation à confirmer après visite gratuite sur site.";
    afficherBureaux(mens, "/mois");
  }
}
function afficherBureaux(ht, suffixe){
  if(ht === null){ el("b-ht").textContent = el("b-tva").textContent = el("b-ttc").textContent = "—"; return; }
  var tva = r2(ht * TVA);
  el("b-ht").textContent = eur(ht) + suffixe;
  el("b-tva").textContent = eur(tva) + suffixe;
  el("b-ttc").textContent = eur(r2(ht + tva)) + suffixe;
}
function calcCopro(){
  var i = el("co-taille").selectedIndex, t = COPRO.tailles[i], det = el("co-detail");
  el("co-lig-vitr").hidden = !el("co-vitrerie").checked;
  if(t.prix === 0){
    det.textContent = "Plus de 50 lots : tarification sur devis après visite gratuite de l'immeuble — générez votre demande de devis ou prenez rendez-vous.";
    el("co-ht").textContent = el("co-tva").textContent = el("co-ttc").textContent = "sur devis"; return;
  }
  var mens = t.prix + (el("co-containers").checked ? COPRO.containers : 0);
  if(el("co-annuel").checked) mens = mens * (1 - COPRO.remiseAnnuelle);
  mens = r2(mens);
  var tva = r2(mens * TVA);
  det.textContent = t.n + " : " + eur(t.prix) + " HT/mois"
    + (el("co-containers").checked ? " + containers " + eur(COPRO.containers) + " HT/mois" : "")
    + (el("co-annuel").checked ? " · remise contrat annuel −5 %" : "")
    + (el("co-vitrerie").checked ? " · vitrerie " + eur(COPRO.vitrerie) + " HT/intervention" : "")
    + " — estimation à confirmer après visite gratuite.";
  el("co-ht").textContent = eur(mens);
  el("co-tva").textContent = eur(tva);
  el("co-ttc").textContent = eur(r2(mens + tva));
}
function ajouterAuPanierBureaux(){
  var det = el("b-detail");
  var dateStr = el("bp-date").value, adresse = el("bp-adresse").value.trim();
  var s = el("bp-service").selectedIndex, h = parseFloat(el("bp-heures").value) || 0;
  if(h < BUREAUX.minH){ det.textContent = "⚠ Minimum " + BUREAUX.minH + " heures pour une intervention ponctuelle."; return; }
  if(!dateStr){ det.textContent = "⚠ Merci d'indiquer la date d'intervention souhaitée."; return; }
  if(joursAvant(dateStr) < 0){ det.textContent = "⚠ La date choisie est passée — merci de sélectionner une date à venir."; return; }
  if(!adresse){ det.textContent = "⚠ Merci d'indiquer l'adresse des locaux."; return; }
  if(!adresseValide("bp-adresse")){ det.textContent = "⚠ Adresse non reconnue : sélectionnez une adresse dans la liste proposée pendant la saisie."; return; }
  if(!el("bc-cgv").checked){ det.textContent = "⚠ Merci d'accepter les Conditions Générales de Vente pour ajouter au panier."; return; }
  var taux = BUREAUX.ponctuel[s].taux;
  panier.push({
    titre: BUREAUX.ponctuel[s].n + " — intervention ponctuelle",
    detail: taux + " € HT/h × " + h + " h" + (el("bp-heure").value ? " · heure souhaitée : " + el("bp-heure").value : ""),
    date: dateStr, heure: el("bp-heure").value, h: h, adresse: adresse, commentaire: "",
    ht: r2(taux * h)
  });
  majPanier(); fermerCommande(); ouvrirPanier();
}
/* Lignes du devis selon l'univers actif */
function lignesCourantes(){
  if(univers === "menage"){
    var it = itemCourant();
    return it ? [it] : [];
  }
  if(univers === "bureaux"){
    if(modeBureaux === "ponctuel"){
      var dateStr = el("bp-date").value, adr = el("bp-adresse").value.trim();
      var s = el("bp-service").selectedIndex, h = parseFloat(el("bp-heures").value) || 0;
      if(h < BUREAUX.minH || !dateStr || !adr || joursAvant(dateStr) < 0) return [];
      return [{titre: BUREAUX.ponctuel[s].n + " — intervention ponctuelle",
        detail: BUREAUX.ponctuel[s].taux + " € HT/h × " + h + " h" + (el("bp-heure").value ? " · heure souhaitée : " + el("bp-heure").value : ""),
        date: dateStr, adresse: adr, ht: r2(BUREAUX.ponctuel[s].taux * h)}];
    }
    var m2 = parseFloat(el("bc-surface").value) || 0, adr2 = el("bc-adr-bur").value.trim();
    if(m2 <= 0 || m2 > 300) return [];
    var t = m2 < 100 ? BUREAUX.tranches[0] : BUREAUX.tranches[1];
    return [{titre: "Contrat d'entretien régulier de bureaux — estimation",
      detail: m2 + " m² × " + t.prix.toLocaleString("fr-FR") + " €/m²/mois (" + t.freq + ")" + (el("bc-annuel-bur").checked ? " · remise annuelle −5 %" : "") + " · à confirmer après visite gratuite sur site",
      date: "", adresse: adr2 || "adresse à préciser", mensuel: true,
      ht: r2(m2 * t.prix * (el("bc-annuel-bur").checked ? 1 - BUREAUX.remiseAnnuelle : 1))}];
  }
  /* copropriétés */
  var i = el("co-taille").selectedIndex, tc = COPRO.tailles[i], adr3 = el("co-adresse").value.trim() || "adresse à préciser";
  if(tc.prix === 0) return [];
  var lignes = [];
  var mens = tc.prix + (el("co-containers").checked ? COPRO.containers : 0);
  if(el("co-annuel").checked) mens = mens * (1 - COPRO.remiseAnnuelle);
  lignes.push({titre: "Contrat d'entretien de copropriété — estimation",
    detail: tc.n + (el("co-containers").checked ? " + sortie/rentrée et désinfection des containers" : "") + (el("co-annuel").checked ? " · remise contrat annuel −5 %" : "") + " · à confirmer après visite gratuite de l'immeuble",
    date: "", adresse: adr3, mensuel: true, ht: r2(mens)});
  if(el("co-vitrerie").checked){
    lignes.push({titre: "Vitrerie des parties communes", detail: "Par intervention — recommandé au trimestre", date: "", adresse: adr3, ht: COPRO.vitrerie});
  }
  return lignes;
}

/* ====== TÉLÉPHONE ====== */
function valideTel(t){ t = (t || "").replace(/[\s.\-()]/g, ""); return /^\+\d{1,3}0\d{8,9}$/.test(t); }
function telNational(t){ t = (t || "").replace(/[\s.\-()]/g, ""); return /^0\d{8,9}$/.test(t); }
function telComplet(){ return el("pan-indicatif").value + " " + el("pan-tel").value.trim(); }

/* ====== ADRESSES VÉRIFIÉES (Base Adresse Nationale — data.gouv.fr) ====== */
var adresseOK = {};
function attacherAutocomplete(id){
  var inp = el(id);
  if(!inp) return;
  var liste = document.createElement("div");
  liste.className = "ac-liste"; liste.hidden = true;
  inp.parentNode.appendChild(liste);
  var minuterie = null;
  inp.addEventListener("input", function(){
    adresseOK[id] = false; inp.classList.remove("ac-ok");
    clearTimeout(minuterie);
    var q = inp.value.trim();
    if(q.length < 4){ liste.hidden = true; return; }
    minuterie = setTimeout(function(){
      fetch("https://api-adresse.data.gouv.fr/search/?limit=5&q=" + encodeURIComponent(q))
        .then(function(r){ return r.json(); })
        .then(function(d){
          var f = (d.features || []);
          if(!f.length){ liste.hidden = true; return; }
          liste.innerHTML = "";
          f.forEach(function(x){
            var o = document.createElement("div");
            o.textContent = x.properties.label;
            o.onclick = function(){
              inp.value = x.properties.label;
              adresseOK[id] = true; inp.classList.add("ac-ok");
              liste.hidden = true;
              if(id === "bc-adresse") calculer();
            };
            liste.appendChild(o);
          });
          liste.hidden = false;
        })
        .catch(function(){ adresseOK[id] = true; liste.hidden = true; }); /* API injoignable : on n'empêche pas la vente */
    }, 300);
  });
  document.addEventListener("click", function(e){ if(e.target !== inp) liste.hidden = true; });
}
["bc-adresse", "bp-adresse", "bc-adr-bur", "co-adresse"].forEach(attacherAutocomplete);
function adresseValide(id){
  return el(id).value.trim() !== "" && adresseOK[id] === true;
}

/* Ferme le menu mobile quand on suit un lien de navigation */
document.querySelectorAll("nav.liens a").forEach(function(a){ a.addEventListener("click", fermerMenu); });
