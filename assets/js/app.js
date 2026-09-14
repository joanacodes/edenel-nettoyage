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
    date: d.dateStr, adresse: adresse,
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
  el("paiement-montant").textContent = n > 0 ? "Total à régler : " + eur(ttc) + " TTC — choisissez votre mode de paiement sécurisé :" : "Choisissez votre mode de paiement sécurisé :";
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
function ouvrirPaiement(){
  if(panier.length === 0){ el("liste-panier").innerHTML = '<p class="panier-vide">⚠ Ajoutez au moins une prestation avant de payer.</p>'; return; }
  if(!lireJSON(COMPTE_KEY)){
    el("liste-panier").innerHTML = '<p class="panier-vide">⚠ Pour passer commande (et cumuler vos commandes vers le Tarif Fidélité −8 %), créez d\'abord votre compte dans l\'Espace client — il s\'ouvre à l\'instant.</p>';
    ouvrirCompte(); return;
  }
  if(!telNational(el("pan-tel").value)){
    note("pan-note", "⚠ Téléphone mobile obligatoire pour commander : choisissez l'indicatif pays puis saisissez votre numéro commençant par 0 (ex. : 0612345678).", ROUGE); return;
  }
  var ref = enregistrerCommande();
  if(ref){ el("paiement-montant").textContent = "Référence de commande : " + ref + " — " + el("paiement-montant").textContent; }
  fermerPanier(); ouvrir("modal-paiement");
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
  var contact = el("rdv-indicatif").value + " " + el("rdv-tel").value.trim() + (rdvEmail ? " · " + rdvEmail : "");
  if(!rdvDate){ note("rdv-note", "⚠ Merci de choisir une date dans le calendrier.", ROUGE); return; }
  if(!rdvHeure){ note("rdv-note", "⚠ Merci de choisir un créneau horaire.", ROUGE); return; }
  if(!nom){ note("rdv-note", "⚠ Merci d'indiquer votre nom.", ROUGE); return; }
  if(!telNational(el("rdv-tel").value)){ note("rdv-note", "⚠ Téléphone mobile obligatoire pour un rendez-vous : indicatif pays puis numéro commençant par 0 (ex. : 0612345678).", ROUGE); return; }
  if(rdvEmail.indexOf("@") < 1){ note("rdv-note", "⚠ Email obligatoire pour recevoir la confirmation du rendez-vous.", ROUGE); return; }
  var dateFr = dateLongue(rdvDate);
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("Demande de RENDEZ-VOUS — " + LEGAL.marque)
      + "&body=" + encodeURIComponent("Rendez-vous souhaité : " + dateFr + " à " + rdvHeure + "\nNom : " + nom + "\nContact : " + contact);
    note("rdv-note", "✓ Mode test local : votre logiciel de messagerie s'est ouvert avec la demande pré-remplie — cliquez sur Envoyer. Une fois le site en ligne, l'envoi est automatique.", VERT); return;
  }
  note("rdv-note", "Envoi en cours…", GRIS);
  envoyerFormulaire({
    _subject: "Demande de RENDEZ-VOUS — " + LEGAL.marque,
    email: rdvEmail,
    "Rendez-vous demandé": dateFr + " à " + rdvHeure,
    "Nom": nom,
    "Contact": contact
  }).then(function(){
    note("rdv-note", "✓ Demande envoyée pour le " + dateFr + " à " + rdvHeure + " — nous vous recontactons très vite pour confirmer.", VERT);
  }).catch(function(){
    note("rdv-note", "⚠ L'envoi automatique n'a pas abouti. Écrivez-nous directement : " + LEGAL.email + " en indiquant « RDV " + dateFr + " à " + rdvHeure + " ».", ROUGE);
  });
}

/* ====== ENVOI DES FORMULAIRES (FormSubmit, mode AJAX) ====== */
function envoyerFormulaire(charge){
  return fetch(FORMSUBMIT, {
    method: "POST",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify(charge)
  }).then(function(r){ if(!r.ok) throw new Error("FormSubmit " + r.status); return r; });
}

/* ====== DOCUMENTS IMPRIMABLES (devis, facture, historique) ====== */
function styleDocument(){
  return 'body{font-family:Segoe UI,Arial,sans-serif;color:#3A4358;max-width:800px;margin:30px auto;padding:0 24px;font-size:14px;line-height:1.55}'
    + '.tete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #3EBD8E;padding-bottom:18px}'
    + '.m-nom{font-size:26px;font-weight:800;color:#1F2A70;letter-spacing:.02em}.m-sub{font-size:12px;font-weight:700;letter-spacing:.28em;color:#1E8CA8;text-transform:uppercase}'
    + '.m-fil{font-size:11.5px;font-style:italic;color:#5A677C;margin-top:3px}'
    + 'h1{font-size:20px;color:#1F2A70;margin:26px 0 4px}.meta{font-size:12.5px;color:#5A677C}'
    + '.bloc{border:1px solid #DCE7EC;border-radius:10px;padding:12px 16px;margin-top:16px}'
    + '.statut{display:inline-block;background:#E7F7F0;color:#1F7A55;font-weight:700;border-radius:999px;padding:5px 16px;font-size:12.5px;margin-top:12px}'
    + 'table{width:100%;border-collapse:collapse;margin-top:18px}td,th{padding:10px 12px;border-bottom:1px solid #DCE7EC;text-align:left;vertical-align:top}'
    + 'th{background:#1F2A70;color:#fff;font-size:12.5px}.mt{text-align:right;white-space:nowrap;font-weight:700;color:#1F2A70}.pt{font-size:12px;color:#5A677C}'
    + '.tot td{border-bottom:0;padding:5px 12px}.ttc{font-size:16px;font-weight:800;color:#1F2A70;border-top:2px solid #3EBD8E}'
    + '.legal{font-size:10.5px;color:#8A96AC;border-top:1px solid #DCE7EC;margin-top:26px;padding-top:12px}'
    + '.cond{font-size:11.5px;color:#5A677C;margin-top:14px}.cond.encadre{border:1px solid #F4D8C4;background:#FCF6F0;border-radius:10px;padding:10px 14px}'
    + '.imp{background:#1F2A70;color:#fff;border:0;border-radius:8px;padding:10px 22px;font-weight:700;cursor:pointer;margin:18px 0}'
    + 'tr:nth-child(even) td.hist{background:#F5F7FA}'
    + '@media print{.imp{display:none}}';
}
function enteteDocument(){
  return '<div class="tete"><div><svg width="54" height="54" viewBox="0 0 100 100"><path d="M12 46 L50 16 L88 46 L88 60 L50 30 L12 60 Z" fill="#1E8CA8"/><path d="M20 74 L44 55 L58 66 L58 78 L44 67 L20 86 Z" fill="#3EBD8E"/></svg></div>'
    + '<div style="text-align:right"><div class="m-nom">EDENEL</div><div class="m-sub">Nettoyage Pro</div><div class="m-fil">' + LEGAL.filiation + '</div></div></div>';
}
function piedDocument(){
  return '<div class="legal">' + LEGAL.marque + ' — ' + LEGAL.filiation + '<br>' + LEGAL.raison + ' · ' + LEGAL.forme + '<br>Siège social : ' + LEGAL.adresse + '<br>SIRET : ' + LEGAL.siret + ' · ' + LEGAL.rcs + ' · ' + LEGAL.ape + ' · TVA intracommunautaire : ' + LEGAL.tvaIntra + '<br>Contact : ' + LEGAL.email + '</div>';
}
function ouvrirDocument(titre, corps){
  var w = window.open("", "_blank");
  if(!w) return null;
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>' + echapper(titre) + '</title><style>' + styleDocument() + '</style></head><body>'
    + enteteDocument() + corps + '<button class="imp" onclick="window.print()">Imprimer / Enregistrer en PDF</button>' + piedDocument() + '</body></html>');
  w.document.close();
  return w;
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

  var lignesHtml = lignes.map(function(it){
    var quand = it.date ? "Intervention le " + frDate(it.date) + " — " : "";
    return '<tr><td><strong>' + echapper(it.titre) + '</strong><br><span class="pt">' + echapper(it.detail) + '<br>' + quand + echapper(it.adresse) + '</span></td><td class="mt">' + eur(it.ht) + (it.mensuel ? ' HT/mois' : '') + '</td></tr>';
  }).join("");
  var corps = '<h1>Devis n° ' + num + '</h1><div class="meta">Établi le ' + dateFr + ' — Validité : 30 jours calendaires à compter de la date de génération du devis — gratuit et sans engagement</div>'
    + '<div class="bloc"><strong>Client :</strong> ' + echapper(client) + (email ? '<br><strong>Email :</strong> ' + echapper(email) : '') + '</div>'
    + '<table><tr><th>Prestation</th><th style="text-align:right">Montant HT</th></tr>' + lignesHtml
    + '<tr><td><strong>Frais de déplacement</strong><br><span class="pt">' + nbDepl + ' intervention(s) × ' + eur(DEPL_HT) + ' HT</span></td><td class="mt">' + eur(depl) + '</td></tr>'
    + '<tr class="tot"><td style="text-align:right">Total HT</td><td class="mt">' + eur(ht) + '</td></tr>'
    + '<tr class="tot"><td style="text-align:right">TVA (20 %)</td><td class="mt">' + eur(tva) + '</td></tr>'
    + '<tr class="tot"><td style="text-align:right" class="ttc">Total TTC</td><td class="mt ttc">' + eur(ttc) + '</td></tr></table>'
    + (htMensuel > 0 ? '<div class="bloc">Contrats mensuels : <strong>' + eur(htMensuel) + ' HT/mois</strong>, soit ' + eur(r2(htMensuel * (1 + TVA))) + ' TTC/mois — estimation à confirmer après visite gratuite.</div>' : '')
    + '<div class="cond"><strong>Conditions :</strong> tarifs conformes à notre grille en vigueur. Les produits d\'entretien obligatoires sont avancés par nos soins (' + PROD_ENTRETIEN + ' € HT) sauf s\'ils sont déjà fournis dans le logement par le donneur d\'ordre ; en leur absence, la prestation de ménage est reportée et de nouveaux frais de déplacement sont facturés. Majoration de 10 % les dimanches et jours fériés. Commande le jour même : avant 11 h 30, selon disponibilité.</div>';
  var w = ouvrirDocument("Devis " + num + " — " + LEGAL.marque, corps);
  if(!w){ note("dv-note", "⚠ Fenêtre bloquée par le navigateur — autorisez les pop-ups pour ce site.", ROUGE); return; }

  var resume = lignes.map(function(it){
    var quand = it.date ? " — le " + frDate(it.date) : "";
    return "• " + it.titre + " — " + it.detail + quand + " à " + it.adresse + " : " + eur(it.ht) + (it.mensuel ? " HT/mois" : " HT");
  }).join("\n");
  var texte = "Bonjour " + prenom + ",\n\nVoici votre devis " + num + " établi le " + dateFr + " (validité : 30 jours calendaires à compter de la date de génération du devis) :\n\n" + resume
    + "\nFrais de déplacement : " + eur(depl) + " HT (" + nbDepl + " intervention(s))"
    + "\n\nTotal HT : " + eur(ht) + "\nTVA (20 %) : " + eur(tva) + "\nTOTAL TTC : " + eur(ttc)
    + (htMensuel > 0 ? "\nContrats mensuels : " + eur(htMensuel) + " HT/mois, soit " + eur(r2(htMensuel * (1 + TVA))) + " TTC/mois (estimation à confirmer après visite)" : "")
    + "\n\nPour commander : rendez-vous sur notre site, bouton « Passer commande ».\n\n" + LEGAL.marque + " — " + LEGAL.filiation + "\n" + LEGAL.email;
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("DEVIS " + num + " — " + client) + "&body=" + encodeURIComponent(texte);
    note("dv-note", "✓ Devis " + num + " ouvert dans un nouvel onglet (imprimable en PDF). Mode test local : votre messagerie s'est ouverte pour nous transmettre la demande — en ligne, l'envoi par email est automatique.", VERT); return;
  }
  note("dv-note", "Génération du devis…", GRIS);
  var charge = {_subject: "DEVIS " + num + " généré — " + client, "Client": client, "Devis": num, "Détail": resume, "Total": eur(ht) + " HT / " + eur(ttc) + " TTC"};
  if(email){ charge.email = email; charge._autoresponse = texte; }
  envoyerFormulaire(charge).then(function(){
    note("dv-note", "✓ Devis " + num + " généré : il s'est ouvert dans un nouvel onglet (imprimable en PDF) et une copie vous a été envoyée à " + email + ".", VERT);
  }).catch(function(){
    note("dv-note", "✓ Devis " + num + " ouvert dans un nouvel onglet (imprimable en PDF). ⚠ L'envoi par email n'a pas abouti — enregistrez le PDF ou contactez-nous : " + LEGAL.email, ROUGE);
  });
}

/* ====== FORMULAIRE DE CONTACT (FormSubmit classique ; repli mailto en local) ====== */
(function(){
  var fc = el("form-contact");
  if(!fc) return;
  fc.addEventListener("submit", function(ev){
    if(!estLocal()) return;
    ev.preventDefault();
    var v = function(id){ var x = el(id); return x ? x.value : ""; };
    var corps = "Nom : " + v("nom") + "\nEmail : " + v("email") + "\nType de logement : " + v("logement") + "\nBesoin : " + v("msg");
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("Demande de devis — " + LEGAL.marque) + "&body=" + encodeURIComponent(corps);
    note("note-maquette", "✓ Mode test local : votre logiciel de messagerie s'est ouvert avec la demande pré-remplie — cliquez sur Envoyer. Une fois le site en ligne, l'envoi est automatique.", VERT);
  });
})();
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
  var lignes = detail.split("\n").filter(function(l){ return l.trim(); }).map(function(l){ return "<tr><td>" + echapper(l) + "</td></tr>"; }).join("");
  var corps = '<h1>Facture n° ' + numF + '</h1><div class="meta">Émise le ' + dateFr + ' — Référence commande/devis : ' + echapper(num) + ' — Intervention effectuée le ' + frDate(dateStr) + '</div>'
    + '<div class="statut">' + echapper(el("ft-statut").value) + '</div>'
    + '<div class="bloc"><strong>Client :</strong> ' + echapper(client) + (email ? '<br><strong>Email :</strong> ' + echapper(email) : '') + '</div>'
    + '<div class="bloc" style="font-size:12px;color:#5A677C">Facture émise après double validation conforme à nos conditions : ① bon de réception validé par le client, ② validation interne EDENEL, au plus tôt 5 h après l\'heure d\'intervention planifiée.</div>'
    + '<table><tr><th>Prestations réalisées</th></tr>' + lignes + '</table>'
    + '<table><tr class="tot"><td style="text-align:right">Total HT</td><td class="mt">' + eur(ht) + '</td></tr>'
    + '<tr class="tot"><td style="text-align:right">TVA (20 %)</td><td class="mt">' + eur(tva) + '</td></tr>'
    + '<tr class="tot"><td style="text-align:right" class="ttc">Total TTC</td><td class="mt ttc">' + eur(ttc) + '</td></tr></table>'
    + '<div class="cond encadre"><strong>' + ANNULATION + '</strong></div>';
  var w = ouvrirDocument("Facture " + numF + " — " + LEGAL.marque, corps);
  if(!w){ note("ft-note", "⚠ Fenêtre bloquée par le navigateur — autorisez les pop-ups pour ce site.", ROUGE); return; }
  note("ft-note", "✓ Facture " + numF + " générée — imprimez-la en PDF et transmettez-la au client par email.", VERT);
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
  return rec.id;
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
  var lignes = l.map(function(r){
    return "<tr><td class='hist'>" + r.id + "</td><td class='hist'>" + frDate(r.dateCmd) + "</td><td class='hist'>" + echapper(r.prestations) + "</td><td class='hist'>" + echapper(r.adresse) + "</td><td class='hist'>" + frDate(r.dateInt) + "</td><td class='hist'>" + (r.heurePlan || "—") + "</td><td class='mt hist'>" + eur(r.ht) + "</td><td class='mt hist'>" + eur(r.ttc) + "</td><td class='hist'>" + (r.dateBR ? frDate(r.dateBR) : "—") + "</td><td class='hist'>" + statutAuto(r) + "</td><td class='hist'>" + r.statutF + "</td></tr>";
  }).join("");
  var corps = '<h1>Historique des commandes et de la facturation</h1>'
    + '<div class="meta">Client : ' + echapper(c.nom || "") + (c.email ? " — " + echapper(c.email) : "") + ' · Document généré le ' + new Date().toLocaleDateString("fr-FR") + '</div>'
    + '<table><tr><th>Réf.</th><th>Commandée le</th><th>Prestation(s)</th><th>Adresse du bien</th><th>Intervention</th><th>Heure planifiée</th><th>Total HT</th><th>Total TTC</th><th>BR validé le</th><th>Statut prestation</th><th>Statut facture</th></tr>' + lignes + '</table>'
    + '<div class="bloc" style="text-align:right;font-weight:800;color:#1F2A70">Cumul : ' + eur(totHT) + ' HT — ' + eur(totTTC) + ' TTC</div>'
    + '<div class="cond">Document récapitulatif généré localement depuis le navigateur du client — aucune donnée ni facture n\'est stockée sur le site.</div>';
  if(!ouvrirDocument("Historique commandes & facturation — EDENEL", corps)) alert("Autorisez les fenêtres pop-up pour télécharger l'historique.");
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
    date: dateStr, adresse: adresse, commentaire: "",
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
