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
{{- range $t.copro.tailles }}{{ $cTailles = $cTailles | append (dict "n" .nom "prix" .prix) }}{{ end -}}
{{- $txArticles := slice -}}
{{- with $t.textile }}{{ range .articles }}{{ $txArticles = $txArticles | append (dict "n" .nom "u" .unite "prix" .prix) }}{{ end }}{{ end }}

/* ====== GRILLE TARIFAIRE (HT — source : data/tarifs.yaml, mise à jour {{ $t.miseAJour }}) ====== */
var TARIF_BASE = {{ $t.base }};
var TVA = {{ $t.tva }};
var MAJO_DIM_FERIE = {{ $t.majorationDimanche }};
var REMISE_FIDELITE = {{ $t.remiseFidelite }};
var SUP_CHANTIER = {{ $t.supplementChantier }};
var DEPL_HT = {{ $t.deplacement }};
var DEPL_OFFERT_DES = {{ $t.deplacementOffertDes | default 0 }};
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

var TEXTILE = {
  articles: {{ $txArticles | jsonify | safeJS }},
  minimum: {{ with $t.textile }}{{ .minimum | default 0 }}{{ else }}0{{ end }}
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

/* ====== SERVEUR (Supabase) — vide = fonctionnement sans serveur ====== */
var SUPA_URL = {{ site.Params.supabaseUrl | default "" | strings.TrimSuffix "/" | jsonify | safeJS }};
var SUPA_CLE = {{ site.Params.supabaseCle | default "" | jsonify | safeJS }};
var BACKEND = !!(SUPA_URL && SUPA_CLE);
var SESSION_KEY = "edenel_session";
var PROFIL = null;          /* profil du client connecté (mode serveur) */
var CMDS_SERVEUR = [];      /* ses commandes (mode serveur) */

function erreurApi(r, d){
  var e = new Error((d && (d.erreur || d.msg || d.message || d.error_description)) || ("Erreur " + r.status));
  e.statut = r.status; return e;
}
function appelJson(url, opts){
  return fetch(url, opts).then(function(r){
    return r.text().then(function(t){
      var d = null; try{ d = t ? JSON.parse(t) : null; }catch(e){}
      if(!r.ok) throw erreurApi(r, d);
      return d;
    });
  });
}
function sessionCourante(){ return lireJSON(SESSION_KEY); }
function memoriserSession(d){
  if(!d || !d.access_token) return null;
  var s = {access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)), user: d.user || (sessionCourante() || {}).user};
  ecrireJSON(SESSION_KEY, s); return s;
}
function oublierSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} PROFIL = null; CMDS_SERVEUR = []; }
function appelAuth(chemin, corps){
  return appelJson(SUPA_URL + "/auth/v1/" + chemin, {method: "POST", headers: {"apikey": SUPA_CLE, "Content-Type": "application/json"}, body: JSON.stringify(corps)});
}
/* Jeton d'accès valide (rafraîchi si besoin) ou null si déconnecté */
var rafraichissement = null;
function jetonValide(){
  var s = sessionCourante();
  if(!s) return Promise.resolve(null);
  if(s.expires_at * 1000 - 60000 > Date.now()) return Promise.resolve(s.access_token);
  if(!rafraichissement){
    rafraichissement = appelAuth("token?grant_type=refresh_token", {refresh_token: s.refresh_token})
      .then(function(d){ return memoriserSession(d).access_token; })
      .catch(function(e){ if(e.statut && e.statut < 500) oublierSession(); return null; })
      .then(function(t){ rafraichissement = null; return t; });
  }
  return rafraichissement;
}
function entetes(jeton){
  var h = {"apikey": SUPA_CLE, "Content-Type": "application/json"};
  if(jeton) h.Authorization = "Bearer " + jeton;
  return h;
}
/* Base de données (PostgREST) avec la session du client */
function appelBase(chemin, opts){
  opts = opts || {};
  return jetonValide().then(function(j){
    var h = entetes(j); if(opts.prefer) h.Prefer = opts.prefer;
    return appelJson(SUPA_URL + "/rest/v1/" + chemin, {method: opts.method || "GET", headers: h, body: opts.corps ? JSON.stringify(opts.corps) : undefined});
  });
}
function rpc(nom, args){ return appelBase("rpc/" + nom, {method: "POST", corps: args || {}}); }
/* Fonctions serveur (supabase/functions) */
function appelFonction(nom, corps, methode, requete){
  return jetonValide().then(function(j){
    return appelJson(SUPA_URL + "/functions/v1/" + nom + (requete || ""), {method: methode || "POST", headers: entetes(j), body: corps ? JSON.stringify(corps) : undefined});
  });
}
/* Profil courant : serveur si connecté, sinon compte local de l'appareil */
function compteCourant(){
  if(BACKEND) return PROFIL;
  return lireJSON(COMPTE_KEY);
}
/* Commandes du serveur au format utilisé par le site */
function commandeVersLocal(c){
  return {
    id: c.id, dateCmd: (c.created_at || "").slice(0, 10), prestations: (c.lignes || []).map(function(l){ return l.titre; }).join(" + "),
    adresse: c.adresse || "", dateInt: c.date_intervention, ht: Number(c.ht), ttc: Number(c.ttc), heurePlan: c.heure_planifiee || "",
    dateBR: c.date_br, statutP: {recue: "Reçue", planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée"}[c.statut] || "",
    statutF: {en_attente: "En attente", emise: "Émise", payee: "Payée"}[c.statut_facture] || "En attente",
    trajets: c.statut === "annulee" ? [] : (c.trajets || []), numClient: c.numero_client, annulee: c.statut === "annulee"
  };
}
function chargerEspace(){
  var s = sessionCourante();
  if(!BACKEND || !s) return Promise.resolve(null);
  return Promise.all([
    appelBase("profils?select=*&id=eq." + encodeURIComponent(s.user.id)),
    appelBase("commandes?select=*&order=created_at.desc")
  ]).then(function(r){
    var p = r[0] && r[0][0];
    PROFIL = p ? {nom: p.nom, email: s.user.email, tel: p.tel || "", numero: p.numero_client} : null;
    CMDS_SERVEUR = (r[1] || []).map(commandeVersLocal);
    return PROFIL;
  }).catch(function(e){ if(e.statut === 401) oublierSession(); return null; });
}

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
  if(el("tx-date")) el("tx-date").min = auj;
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
  var horsDepl = r2(prest + majo + supp + opt);
  var depl = deplacementSimule(dateStr, el("bc-adresse").value, horsDepl);
  var ht = r2(horsDepl + depl.montant);
  return {taux: taux, h: h, tier: t, prest: prest, majo: majo, supp: r2(supp), suppTxt: suppTxt, opt: opt, ht: ht, horsDepl: horsDepl, depl: depl, prodOk: prodOk, s: s, l: l, dateStr: dateStr};
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
    ["t-prest", "t-supp", "t-opt", "t-depl", "t-ht", "t-tva", "t-ttc"].forEach(function(i){ el(i).textContent = "—"; });
    el("lig-majo").hidden = el("lig-supp").hidden = el("lig-opt").hidden = true; return;
  }
  el("t-prest").textContent = eur(d.prest);
  el("lig-majo").hidden = d.majo === 0; el("t-majo").textContent = eur(d.majo);
  el("lig-supp").hidden = d.supp === 0; el("t-supp").textContent = eur(d.supp);
  el("lbl-supp").textContent = "Suppléments obligatoires (" + d.suppTxt.join(" + ") + ")";
  el("lig-opt").hidden = d.opt === 0; el("t-opt").textContent = eur(d.opt);
  el("t-depl").textContent = eur(d.depl.montant);
  el("lbl-depl").textContent = d.depl.libelle;
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
    ht: d.horsDepl   /* le déplacement est compté une fois par intervention (date + adresse) dans le panier */
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
/* ====== FRAIS DE DÉPLACEMENT : un seul par intervention (même date + même adresse) ======
   - plusieurs prestations le même jour à la même adresse = 1 déplacement ;
   - une intervention déjà commandée depuis cet appareil (même date + adresse) n'est pas refacturée ;
   - offerts si les prestations de l'intervention atteignent DEPL_OFFERT_DES € HT (0 = jamais). */
function cleTrajet(date, adresse){ return date + "|" + String(adresse || "").toLowerCase().replace(/[\s,]+/g, " ").trim(); }
function trajetsDejaCommandes(){
  var deja = {};
  lireCmds().forEach(function(r){ (r.trajets || []).forEach(function(k){ deja[k] = 1; }); });
  return deja;
}
function calculDeplacements(lignes){
  var groupes = {}, deja = trajetsDejaCommandes();
  lignes.forEach(function(it){ if(it.date && !it.mensuel){ var k = cleTrajet(it.date, it.adresse); groupes[k] = r2((groupes[k] || 0) + it.ht); } });
  var cles = Object.keys(groupes);
  var payants = cles.filter(function(k){ return !deja[k] && !(DEPL_OFFERT_DES > 0 && groupes[k] >= DEPL_OFFERT_DES); });
  return {cles: cles, nb: payants.length, total: r2(payants.length * DEPL_HT), gratuits: cles.length - payants.length};
}
/* Déplacement affiché dans le simulateur pour une prestation en cours de saisie */
function deplacementSimule(date, adresse, htPrestation){
  var base = "Frais de déplacement (" + eur(DEPL_HT) + " HT par intervention)";
  adresse = String(adresse || "").trim();
  if(date && adresse){
    var k = cleTrajet(date, adresse), deja = trajetsDejaCommandes(), cumul = htPrestation;
    var dansPanier = panier.some(function(it){ if(it.date && !it.mensuel && cleTrajet(it.date, it.adresse) === k){ cumul += it.ht; return true; } return false; });
    if(deja[k]) return {montant: 0, libelle: "Frais de déplacement — déjà facturés sur votre commande pour cette date et cette adresse"};
    if(dansPanier) return {montant: 0, libelle: "Frais de déplacement — déjà comptés dans votre panier (même date, même adresse)"};
    if(DEPL_OFFERT_DES > 0 && cumul >= DEPL_OFFERT_DES) return {montant: 0, libelle: "Frais de déplacement offerts (dès " + eur(DEPL_OFFERT_DES) + " HT de prestations)"};
  }
  return {montant: DEPL_HT, libelle: base};
}
var PANIER_KEY = "edenel_panier";
function sauverPanier(){ try{ localStorage.setItem(PANIER_KEY, JSON.stringify(panier)); }catch(e){} }
function chargerPanier(){
  try{ var p = JSON.parse(localStorage.getItem(PANIER_KEY)); if(Array.isArray(p)) panier = p; }catch(e){}
}
function majPanier(){
  sauverPanier();
  var n = panier.length;
  el("cpt-panier").textContent = n;
  ["cpt-panier2", "cpt-panier3"].forEach(function(i){ if(el(i)) el(i).textContent = n; });
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
  var dp = calculDeplacements(panier);
  var nbDepl = dp.nb, depl = dp.total;
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
function ouvrirCommande(simu, u){
  if(u && el("zone-" + u)) univers = u;
  el("titre-commande").textContent = simu === true ? "Combien ça coûte ?" : "Passer commande";
  el("sous-commande").textContent = simu === true
    ? "Simulez votre devis en quelques clics : les montants HT se calculent instantanément (TVA de 20 % ajoutée au total). Si le prix vous convient, ajoutez la prestation au panier."
    : "Composez votre prestation : les montants HT se calculent automatiquement, la TVA de 20 % est ajoutée au total.";
  initCommande();
  /* Déverrouillage automatique du Tarif Fidélité : 4 commandes ou 400 € TTC cumulés */
  var cpt = compteCourant(), cmds = cmdsActives();
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
  if(!compteCourant()){
    note("pan-note", BACKEND ? "⚠ Pour passer commande, connectez-vous à votre Espace client (un code vous est envoyé par email) — il s'ouvre à l'instant. Votre panier est conservé."
      : "⚠ Pour passer commande (et cumuler vos commandes vers le Tarif Fidélité −8 %), créez d'abord votre compte dans l'Espace client — il s'ouvre à l'instant.", ROUGE);
    ouvrirCompte(); return;
  }
  if(!telNational(el("pan-tel").value)){
    note("pan-note", "⚠ Téléphone mobile obligatoire pour commander : choisissez l'indicatif pays puis saisissez votre numéro commençant par 0 (ex. : 0612345678).", ROUGE); return;
  }
  derniereCommande = preparerCommande();   /* enregistrée dans l'historique seulement une fois transmise */
  el("paiement-montant").textContent = BACKEND ? "Total de votre commande : " + eur(derniereCommande.ttc) + " TTC" : "Commande " + derniereCommande.id + " — total " + eur(derniereCommande.ttc) + " TTC";
  el("paiement-choix").hidden = false; el("paiement-succes").hidden = true;
  var bc = el("btn-confirmer"); if(bc) bc.disabled = false;
  note("note-paiement", "", "");
  fermerPanier(); ouvrir("modal-paiement");
}
function confirmerCommande(){
  var rec = derniereCommande;
  if(!rec || panier.length === 0){ note("note-paiement", "⚠ Aucune commande en cours.", ROUGE); return; }
  var compte = compteCourant() || {};
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
    sauverCommande(rec);
    panier = []; majPanier();
  }
  if(estLocal()){
    location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("COMMANDE " + rec.id) + "&body=" + encodeURIComponent(detailsTxt + "\nTotal : " + eur(rec.ttc) + " TTC\nAjouter à l'agenda : " + lienSociete);
    succes("Mode test local : votre messagerie s'est ouverte avec la commande pré-remplie. En ligne, l'envoi est automatique."); return;
  }
  note("note-paiement", "Transmission de votre commande…", GRIS);
  var bc = el("btn-confirmer"); if(bc) bc.disabled = true;
  if(BACKEND){
    appelFonction("commande", {lignes: panier, tel: rec.tel}).then(function(rep){
      Object.assign(rec, commandeVersLocal(rep.commande));
      evClient.uid = rec.id;
      evClient.details = "Commande " + rec.id + "\n" + detailsTxt + "\nTotal : " + eur(rec.ttc) + " TTC\nL'heure exacte vous est confirmée par EDENEL.";
      succes(rep.email_envoye
        ? "✓ Commande " + rec.id + " enregistrée. Un récapitulatif vient de vous être envoyé par email ; nous vous confirmons l'heure exacte d'intervention. Enregistrez-la dès maintenant :"
        : "✓ Commande " + rec.id + " enregistrée (l'email de récapitulatif n'a pas pu partir : retrouvez-la dans votre Espace client). Enregistrez l'intervention :");
    }).catch(function(e){
      if(bc) bc.disabled = false;
      if(e.statut && e.statut < 500){ note("note-paiement", "⚠ " + e.message, ROUGE); return; }
      echecCommande();
    });
    return;
  }
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
  }).catch(function(){ if(bc) bc.disabled = false; echecCommande(); });
  function echecCommande(){
    /* Échec : le panier est conservé, le client peut réessayer ou envoyer la commande par email */
    var mail = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("COMMANDE " + rec.id + " — " + (compte.nom || ""))
      + "&body=" + encodeURIComponent("Client : " + (compte.nom || "") + " — " + (compte.email || "") + " — " + rec.tel + "\nNuméro client : " + (rec.numClient || "—") + "\n\n" + detailsTxt + "\n\nTotal : " + eur(rec.ht) + " HT / " + eur(rec.ttc) + " TTC");
    var n = el("note-paiement");
    n.style.color = ROUGE;
    n.innerHTML = "⚠ La transmission automatique n'a pas abouti : votre commande n'est pas encore enregistrée (votre panier est conservé). Réessayez dans un instant, ou <a class=\"lien\" href=\"" + echapper(mail) + "\">envoyez-la-nous par email en un clic</a> (" + echapper(LEGAL.email) + ", référence " + echapper(rec.id) + ").";
  }
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
    if(BACKEND){
      chargerCreneaux();
      var p = compteCourant();
      if(p){ if(!el("rdv-nom").value) el("rdv-nom").value = p.nom || ""; if(!el("rdv-email").value) el("rdv-email").value = p.email || ""; }
    }
    el("rdv-interne").hidden = false; el("rdv-succes").hidden = true; el("creneaux").hidden = true;
    note("rdv-note", "Rendez-vous téléphonique ou sur site, 7j/7 — sans engagement.", "");
  }
  ouvrir("modal-rdv");
}
function changerMois(d){ calMois += d; if(calMois < 0){ calMois = 11; calAnnee--; } if(calMois > 11){ calMois = 0; calAnnee++; } dessinerCal(); if(BACKEND) chargerCreneaux(); }
/* Mode serveur : créneaux réellement libres (agenda EDENEL + rendez-vous déjà pris) */
var CRENEAUX = null, creneauxMois = "";
function chargerCreneaux(){
  var cle = calAnnee + "-" + calMois;
  creneauxMois = cle; CRENEAUX = null; dessinerCal();
  el("creneaux").hidden = true;
  note("rdv-note", "Chargement des disponibilités…", GRIS);
  var debut = isoLocal(new Date(calAnnee, calMois, 1)), fin = isoLocal(new Date(calAnnee, calMois + 1, 0));
  appelFonction("rdv", null, "GET", "?debut=" + debut + "&fin=" + fin).then(function(d){
    if(creneauxMois !== cle) return;
    CRENEAUX = d.creneaux || {}; RDV_DUREE_MIN = d.duree || RDV_DUREE_MIN;
    /* Mois en cours complet (ou presque fini) : on affiche directement le mois suivant */
    var t = new Date();
    if(!Object.keys(CRENEAUX).length && calAnnee === t.getFullYear() && calMois === t.getMonth()){ changerMois(1); return; }
    dessinerCal();
    note("rdv-note", Object.keys(CRENEAUX).length ? "Choisissez un jour disponible, puis un créneau. Rendez-vous téléphonique ou sur site — sans engagement." : "Aucun créneau libre ce mois-ci : essayez le mois suivant (›).", "");
  }).catch(function(){
    if(creneauxMois !== cle) return;
    CRENEAUX = {}; dessinerCal();
    note("rdv-note", "⚠ Les disponibilités n'ont pas pu être chargées — réessayez, ou écrivez-nous à " + LEGAL.email + ".", ROUGE);
  });
}
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
    var passe = d < auj || (BACKEND && !(CRENEAUX && CRENEAUX[iso]));
    g += '<button type="button" class="cal-case' + (rdvDate === iso ? " choisi" : "") + '"' + (passe ? ' disabled' : '') + ' onclick="choisirJour(\'' + iso + '\')">' + j + '</button>';
  }
  el("cal-grille").innerHTML = g;
}
function choisirJour(iso){
  rdvDate = iso; rdvHeure = null; dessinerCal();
  el("creneaux").hidden = false;
  var heures = BACKEND ? ((CRENEAUX && CRENEAUX[iso]) || []) : RDV_CRENEAUX;
  el("creneaux").innerHTML = heures.map(function(h){
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
  if(BACKEND){
    var btn = document.querySelector('#rdv-interne .btn-vert'); if(btn) btn.disabled = true;
    note("rdv-note", "Réservation en cours…", GRIS);
    appelFonction("rdv", {date: rdvDate, heure: rdvHeure, nom: nom, email: rdvEmail, tel: tel, message: ((el("rdv-message") || {}).value || "").trim()}).then(function(rep){
      evClient.duree = rep.duree || evClient.duree;
      var confirme = rep.statut === "confirme";
      el("rdv-succes").querySelector("h4").textContent = confirme ? "Rendez-vous confirmé" : "Demande de rendez-vous enregistrée";
      succes((confirme ? "✓ Votre créneau est réservé." : "✓ Demande enregistrée : nous vous confirmons le créneau très vite.")
        + (rep.email_envoye ? " Un email de confirmation vous a été envoyé à " + rdvEmail + "." : " (L'email de confirmation n'a pas pu partir : notez bien votre créneau.)") + " Ajoutez-le à votre agenda :");
    }).catch(function(e){
      if(e.statut === 409){ note("rdv-note", "⚠ " + e.message, ROUGE); rdvHeure = null; chargerCreneaux(); return; }
      note("rdv-note", "⚠ " + (e.statut && e.statut < 500 ? e.message : "La réservation n'a pas abouti — réessayez, ou écrivez-nous à " + LEGAL.email + "."), ROUGE);
    }).then(function(){ if(btn) btn.disabled = false; });
    return;
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
/* ====== ENVOI DES FORMULAIRES (FormSubmit, mode AJAX) ======
   FormSubmit répond HTTP 200 même quand l'envoi est refusé (formulaire pas encore activé,
   adresse bloquée…) : seul le champ JSON « success » indique si l'email est réellement parti. */
function envoyerFormulaire(charge){
  return fetch(FORMSUBMIT, {
    method: "POST",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify(Object.assign({_captcha: "false", _template: "table"}, charge))
  }).then(function(r){
    if(!r.ok) throw new Error("FormSubmit " + r.status);
    return r.json().catch(function(){ return {}; });
  }).then(function(rep){
    if(String(rep.success) !== "true"){
      if(window.console) console.warn("FormSubmit a refusé l'envoi :", rep.message || rep);
      throw new Error(rep.message || "FormSubmit : envoi refusé");
    }
    return rep;
  });
}

/* Envoi d'un message : fonction serveur « message » en mode serveur, FormSubmit sinon */
function envoyerMessage(type, donnees, chargeFormSubmit){
  if(BACKEND) return appelFonction("message", Object.assign({type: type}, donnees));
  return envoyerFormulaire(chargeFormSubmit);
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
  var dejaPanier = {};
  panier.forEach(function(it){ dejaPanier[JSON.stringify([it.titre, it.detail, it.date, it.adresse, it.ht])] = 1; });
  var lignes = panier.slice().concat(lignesCourantes().filter(function(it){ return !dejaPanier[JSON.stringify([it.titre, it.detail, it.date, it.adresse, it.ht])]; }));
  if(lignes.length === 0){
    note("dv-note", "⚠ Configurez une prestation ci-dessus (champs requis selon l'univers choisi) ou ajoutez-en au panier.", ROUGE); return;
  }
  var dp = calculDeplacements(lignes);
  var nbDepl = dp.nb, depl = dp.total;
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
    if(dp.cles.length) rows.push(["Frais de déplacement — " + nbDepl + " intervention(s) × " + eur(DEPL_HT) + " HT (un seul déplacement par date et par adresse" + (dp.gratuits ? " ; " + dp.gratuits + " déjà facturé(s) ou offert(s)" : "") + ")", eur(depl)]);
    y = pdfTableau(doc, y, [{titre: "Prestation", largeur: 134}, {titre: "Montant HT", largeur: 40, align: "right", gras: true}], rows);
    y = pdfTotaux(doc, y, [["Total HT", eur(ht)], ["TVA (20 %)", eur(tva)], ["Total TTC", eur(ttc), true]]);
    if(htMensuel > 0) y = pdfEncadre(doc, y, "Contrats mensuels", eur(htMensuel) + " HT/mois, soit " + eur(r2(htMensuel * (1 + TVA))) + " TTC/mois — estimation à confirmer après visite gratuite.");
    y = pdfEncadre(doc, y, "Conditions", "Tarifs conformes à notre grille en vigueur. Les produits d'entretien obligatoires sont avancés par nos soins (" + PROD_ENTRETIEN + " € HT) sauf s'ils sont déjà fournis dans le logement par le donneur d'ordre ; en leur absence, la prestation de ménage est reportée et de nouveaux frais de déplacement sont facturés. Majoration de 10 % les dimanches et jours fériés. Commande le jour même : avant 11 h 30, selon disponibilité.", "orange");
    doc.save("devis-edenel-" + num + ".pdf");

    if(estLocal()){
      location.href = "mailto:" + LEGAL.email + "?subject=" + encodeURIComponent("DEVIS " + num + " — " + client) + "&body=" + encodeURIComponent(texte);
      note("dv-note", "✓ Devis " + num + " téléchargé en PDF. Mode test local : votre messagerie s'est ouverte — en ligne, l'envoi par email est automatique.", VERT); return;
    }
    envoyerMessage("devis", {email: email, nom: prenom + " " + nom, client: client, numero: num, resume: resume + "\nFrais de déplacement : " + eur(depl) + " HT (" + nbDepl + " intervention(s))",
      totaux: "Total HT : " + eur(ht) + " — TVA (20 %) : " + eur(tva) + " — TOTAL TTC : " + eur(ttc) + (htMensuel > 0 ? "\nContrats mensuels : " + eur(htMensuel) + " HT/mois (estimation à confirmer après visite)" : "")},
      {_subject: "DEVIS " + num + " généré — " + client, email: email, _autoresponse: texte, "Client": client, "Devis": num, "Détail": resume, "Total": eur(ht) + " HT / " + eur(ttc) + " TTC"})
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
    if(BACKEND){
      ev.preventDefault();
      var dc = champsFormulaire(fc), suite = fc.querySelector('input[name="_next"]');
      var nomC = (dc.champs.filter(function(c){ return c[0] === "Nom"; })[0] || [])[1] || "";
      var btnC = fc.querySelector('button[type="submit"]'); if(btnC) btnC.disabled = true;
      var honey = fc.querySelector('input[name="_honey"]');
      appelFonction("message", {type: "contact", email: dc.email, nom: nomC, champs: dc.champs, _honey: honey ? honey.value : ""}).then(function(){
        if(suite && suite.value) location.href = suite.value; else noteContact("ct-note", "✓ Message envoyé — réponse sous 24 h.", VERT);
      }).catch(function(e){
        noteContact("ct-note", "⚠ " + (e.statut && e.statut < 500 ? e.message : "L'envoi n'a pas abouti — écrivez-nous à " + LEGAL.email + "."), ROUGE);
      }).then(function(){ if(btnC) btnC.disabled = false; });
      return;
    }
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
    envoyerMessage("demande-devis", {email: email, nom: nom, numero: num, tel: tel, prestation: presta, secteur: lieu, besoin: besoin}, {
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
  if(!el("ong-fact")) return;
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
  envoyerMessage("bon-reception", {email: email, nom: nom, numero: num, date: dateStr, heure: el("br-heure").value, observations: el("br-comm").value.trim()}, {
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
function lireCmds(){ return BACKEND ? CMDS_SERVEUR : (lireJSON(CMD_KEY) || []); }
function cmdsActives(){ return lireCmds().filter(function(r){ return !r.annulee; }); }

/* ---------- Espace client en mode serveur : connexion par code email ---------- */
function etapeConnexion(etape){
  ["email", "code", "profil"].forEach(function(x){ el("cx-etape-" + x).hidden = x !== etape; });
}
function afficherEspaceServeur(){
  el("zone-auth").hidden = true; el("zone-import").hidden = true;
  if(PROFIL){ el("zone-connexion").hidden = true; el("zone-tableau").hidden = false; afficherTableau(); return; }
  el("zone-connexion").hidden = false; el("zone-tableau").hidden = true;
  var s = sessionCourante();
  if(s){ etapeConnexion("profil"); if(!el("cx-nom").value && lireJSON(COMPTE_KEY)){ el("cx-nom").value = lireJSON(COMPTE_KEY).nom || ""; el("cx-numero").value = lireJSON(COMPTE_KEY).numero || ""; } }
  else etapeConnexion(el("cx-etape-code").hidden ? "email" : "code");
}
function envoyerCodeConnexion(){
  var email = el("cx-email").value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ note("cx-note", "⚠ Merci d'indiquer un email valide.", ROUGE); return; }
  el("cx-btn-code").disabled = true; note("cx-note", "Envoi du code…", GRIS);
  appelAuth("otp", {email: email, create_user: true}).then(function(){
    etapeConnexion("code"); el("cx-code").value = ""; el("cx-code").focus();
    note("cx-note", "✓ Code envoyé à " + email + " (pensez à regarder dans les spams). Il est valable 1 heure.", VERT);
  }).catch(function(e){
    note("cx-note", e.statut === 429 ? "⚠ Trop de demandes : patientez une minute avant de redemander un code." : "⚠ Le code n'a pas pu être envoyé — réessayez dans un instant.", ROUGE);
  }).then(function(){ el("cx-btn-code").disabled = false; });
}
function changerEmailConnexion(){ etapeConnexion("email"); note("cx-note", ""); }
function validerCodeConnexion(){
  var email = el("cx-email").value.trim().toLowerCase(), code = el("cx-code").value.replace(/\s/g, "");
  if(!/^\d{6,10}$/.test(code)){ note("cx-note", "⚠ Saisissez le code à 6 chiffres reçu par email.", ROUGE); return; }
  el("cx-btn-valider").disabled = true; note("cx-note", "Vérification…", GRIS);
  appelAuth("verify", {type: "email", email: email, token: code}).then(function(d){
    memoriserSession(d);
    return chargerEspace();
  }).then(function(){
    note("cx-note", "");
    afficherEspaceServeur();
    majEtatConnexion();
  }).catch(function(){
    note("cx-note", "⚠ Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.", ROUGE);
  }).then(function(){ el("cx-btn-valider").disabled = false; });
}
function enregistrerProfil(){
  var nom = el("cx-nom").value.trim(), tel = el("cx-tel").value.trim(), num = el("cx-numero").value.trim();
  if(nom.length < 2){ note("cx-note", "⚠ Merci d'indiquer votre nom.", ROUGE); return; }
  if(tel.replace(/\D/g, "").length < 9){ note("cx-note", "⚠ Merci d'indiquer votre téléphone mobile.", ROUGE); return; }
  note("cx-note", "Enregistrement…", GRIS);
  rpc("creer_profil", {p_nom: nom, p_tel: tel, p_numero: num || null}).then(function(){ return chargerEspace(); }).then(function(){
    note("cx-note", ""); afficherEspaceServeur(); majEtatConnexion();
  }).catch(function(e){ note("cx-note", "⚠ " + (e.message || "Enregistrement impossible."), ROUGE); });
}
function deconnexionServeur(){
  jetonValide().then(function(j){ if(j) fetch(SUPA_URL + "/auth/v1/logout", {method: "POST", headers: entetes(j)}).catch(function(){}); });
  oublierSession(); majEtatConnexion(); etapeConnexion("email"); afficherEspaceServeur();
}
/* Menu : « Espace client » devient « Mon compte » une fois connecté */
function majEtatConnexion(){
  document.querySelectorAll(".lien-compte").forEach(function(a){ a.textContent = compteCourant() ? "Mon compte" : "Espace client"; });
}

function ouvrirCompte(){
  if(BACKEND){ afficherEspaceServeur(); ouvrir("modal-compte"); if(sessionCourante()) chargerEspace().then(afficherEspaceServeur); return; }
  var c = lireJSON(COMPTE_KEY);
  el("zone-import").hidden = true;
  if(el("zone-transfert")) el("zone-transfert").hidden = true;
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
  var numExistant = ((el("cp-numero") || {}).value || "").trim().toUpperCase();
  if(numExistant && !/^[A-Z]{1,4}-?\d{6,8}(-?\d{1,3})?$/.test(numExistant)){ note("auth-note", "⚠ Numéro client non reconnu (format attendu : SH-20260724-41). Laissez le champ vide pour en obtenir un nouveau.", ROUGE); return; }
  var numero = numExistant || (initiales + "-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(10 + Math.random() * 90));
  var compte = {nom: nom, email: email, pin: pin, tel: tel, numero: numero, cree: new Date().toISOString().slice(0, 10)};
  if(!ecrireJSON(COMPTE_KEY, compte)){ note("auth-note", "⚠ Impossible d'enregistrer sur cet appareil (navigation privée ?).", ROUGE); return; }
  compteConnecte = true; el("zone-auth").hidden = true; el("zone-tableau").hidden = false; afficherTableau();
  var fiche = (numExistant ? "COMPTE RECRÉÉ SUR UN NOUVEL APPAREIL — NUMÉRO CLIENT EXISTANT : " : "NOUVEAU NUMÉRO CLIENT : ") + numero + "\nNom : " + nom + "\nEmail : " + email + "\nTéléphone : " + tel + "\nCréé le : " + new Date().toLocaleDateString("fr-FR");
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
/* ====== UTILISER SON COMPTE SUR UN AUTRE APPAREIL ======
   Le site n'a pas de serveur : le compte vit dans le navigateur. Pour le retrouver sur un
   autre appareil, on génère un lien personnel qui contient le compte (sans le code secret)
   et l'historique ; en l'ouvrant sur l'autre appareil, tout est recopié. */
function b64urlEncode(txt){
  var bin = unescape(encodeURIComponent(txt));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(b){
  b = b.replace(/-/g, "+").replace(/_/g, "/");
  while(b.length % 4) b += "=";
  return decodeURIComponent(escape(atob(b)));
}
var lienTransfertCourant = "";
function lienTransfert(){
  var c = lireJSON(COMPTE_KEY);
  if(!c || !compteConnecte) return;
  var charge = {v: 1, c: {nom: c.nom, email: c.email, tel: c.tel, numero: c.numero, cree: c.cree}, k: lireCmds()};
  lienTransfertCourant = location.origin + location.pathname + "#compte=" + b64urlEncode(JSON.stringify(charge));
  el("tr-lien").value = lienTransfertCourant;
  el("tr-mail").href = "mailto:" + encodeURIComponent(c.email) + "?subject=" + encodeURIComponent("Mon compte " + LEGAL.marque + " — lien pour mon autre appareil")
    + "&body=" + encodeURIComponent("Ouvrez ce lien sur votre téléphone ou votre autre ordinateur pour y retrouver votre compte (n° client " + c.numero + ") et votre historique :\n\n" + lienTransfertCourant + "\n\nNe transférez pas ce message : il contient vos coordonnées.");
  el("tr-partager").hidden = !navigator.share;
  note("tr-note", "");
  el("zone-transfert").hidden = false;
  el("zone-transfert").scrollIntoView({behavior: "smooth", block: "nearest"});
}
function copierTransfert(){
  var ok = function(){ note("tr-note", "✓ Lien copié — collez-le dans un message à vous-même, puis ouvrez-le sur l'autre appareil.", VERT); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(lienTransfertCourant).then(ok, function(){ el("tr-lien").select(); document.execCommand("copy"); ok(); });
  } else { el("tr-lien").select(); document.execCommand("copy"); ok(); }
}
function partagerTransfert(){
  if(navigator.share) navigator.share({title: "Mon compte " + LEGAL.marque, url: lienTransfertCourant}).catch(function(){});
}
var importEnAttente = null;
function detecterImport(){
  var m = /^#compte=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if(!m) return;
  try{
    var d = JSON.parse(b64urlDecode(m[1]));
    if(!d || !d.c || !d.c.email || !d.c.numero) throw new Error("lien incomplet");
    importEnAttente = d;
  }catch(e){ importEnAttente = null; }
  try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
  el("zone-auth").hidden = true; el("zone-tableau").hidden = true; el("zone-import").hidden = false;
  if(!importEnAttente){
    el("imp-sous").textContent = "Ce lien de transfert est incomplet ou abîmé (il a peut-être été coupé par votre messagerie). Générez-en un nouveau depuis votre autre appareil.";
    el("imp-pin").parentNode.hidden = true;
  } else {
    var existant = lireJSON(COMPTE_KEY);
    el("imp-pin").parentNode.hidden = false;
    el("imp-sous").textContent = "Transfert du compte de " + importEnAttente.c.nom + " (n° client " + importEnAttente.c.numero + ", " + (importEnAttente.k || []).length + " commande(s)) sur cet appareil."
      + (existant && existant.numero !== importEnAttente.c.numero ? " ⚠ Le compte « " + existant.nom + " » déjà présent sur cet appareil sera remplacé." : "");
  }
  ouvrir("modal-compte");
}
function confirmerImport(){
  var d = importEnAttente;
  if(!d){ annulerImport(); return; }
  var pin = el("imp-pin").value;
  if(pin.length < 4){ note("imp-note", "⚠ Choisissez un code secret d'au moins 4 chiffres pour cet appareil.", ROUGE); return; }
  var existant = lireJSON(COMPTE_KEY);
  var cmds = (existant && existant.numero === d.c.numero) ? lireCmds() : [];
  (d.k || []).forEach(function(r){ if(r && r.id && !cmds.some(function(x){ return x.id === r.id; })) cmds.push(r); });
  var compte = Object.assign({}, d.c, {pin: pin});
  if(!ecrireJSON(COMPTE_KEY, compte) || !ecrireJSON(CMD_KEY, cmds)){ note("imp-note", "⚠ Impossible d'enregistrer sur cet appareil (navigation privée ?).", ROUGE); return; }
  importEnAttente = null;
  compteConnecte = true; el("zone-import").hidden = true; el("zone-tableau").hidden = false; afficherTableau();
}
function annulerImport(){
  importEnAttente = null;
  el("zone-import").hidden = true; el("zone-auth").hidden = false;
}
function seDeconnecter(){ if(BACKEND){ deconnexionServeur(); return; } compteConnecte = false; el("zone-tableau").hidden = true; el("zone-transfert").hidden = true; el("zone-auth").hidden = false; }

function preparerCommande(){
  if(panier.length === 0) return null;
  var dp = calculDeplacements(panier);
  var depl = dp.total;
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
    numClient: (compteCourant() || {}).numero || "",
    trajets: dp.cles
  };
  return rec;
}
function sauverCommande(rec){
  if(BACKEND){ if(!CMDS_SERVEUR.some(function(r){ return r.id === rec.id; })) CMDS_SERVEUR.unshift(rec); return; }
  var l = lireCmds();
  if(!l.some(function(r){ return r.id === rec.id; })){ l.push(rec); ecrireJSON(CMD_KEY, l); }
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
  var c = compteCourant() || {nom: ""};
  el("tb-bonjour").textContent = "Bonjour " + c.nom + " — voici le récapitulatif de vos commandes :";
  var lc = lireCmds(), actives = cmdsActives();
  var cumul = r2(actives.reduce(function(s, x){ return s + x.ttc; }, 0));
  var eligible = actives.length >= 4 || cumul >= 400;
  if(BACKEND){
    el("btn-transfert").hidden = true;
    el("tb-note").textContent = "Vos commandes sont enregistrées sur votre compte : vous les retrouvez sur tous vos appareils. Les statuts sont mis à jour par EDENEL.";
  }
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
  if(BACKEND){
    t.innerHTML = "<tr><th>Réf.</th><th>Commandée le</th><th>Prestation(s)</th><th>Adresse du bien</th><th>Intervention</th><th>Heure confirmée</th><th>Total HT</th><th>Total TTC</th><th>Bon de réception</th><th>Statut</th><th>Facture</th></tr>"
      + lc.map(function(r){
        return "<tr><td><strong>" + echapper(r.id) + "</strong></td><td>" + frDate(r.dateCmd) + "</td><td>" + echapper(r.prestations) + "</td><td>" + echapper(r.adresse) + "</td><td>" + frDate(r.dateInt) + "</td><td>" + echapper(r.heurePlan || "à confirmer") + "</td><td>" + eur(r.ht) + "</td><td>" + eur(r.ttc) + "</td><td>" + (r.dateBR ? "validé le " + frDate(r.dateBR) : "à valider") + "</td><td>" + echapper(r.statutP) + "</td><td>" + echapper(r.statutF) + "</td></tr>";
      }).join("");
    return;
  }
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
  var c = compteCourant() || {nom: "", email: ""};
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
    pdfEncadre(doc, y, "Information", BACKEND ? "Récapitulatif de votre compte client EDENEL au " + new Date().toLocaleDateString("fr-FR") + "." : "Récapitulatif généré localement depuis le navigateur du client — aucune donnée ni facture n'est stockée sur le site.");
    doc.save("historique-edenel-" + new Date().toISOString().slice(0, 10) + ".pdf");
  }, function(){ alert("Le générateur PDF n'a pas pu se charger. Réessayez dans un instant."); }, {orientation: "landscape", marge: 12})
  .then(function(){ if(btn){ btn.disabled = false; btn.textContent = "Télécharger l'historique (PDF)"; } });
}
/* ====== UNIVERS BUREAUX & COPROPRIÉTÉS ====== */
function choisirUnivers(u){
  univers = u;
  ["menage", "bureaux", "textile", "copro"].forEach(function(x){
    if(!el("zone-" + x)) return;
    el("zone-" + x).hidden = x !== u;
    el("ong-u-" + x).classList.toggle("actif", x === u);
  });
  if(u === "menage") calculer();
  if(u === "bureaux") calcBureaux();
  if(u === "textile") calcTextile();
  if(u === "copro") calcCopro();
}
/* ====== UNIVERS MOQUETTES & CANAPÉS (prix à la pièce / au m², data/tarifs.yaml → textile) ====== */
function detailsTextile(){
  var lignes = [], sousTotal = 0, surDevis = [];
  TEXTILE.articles.forEach(function(a, i){
    var q = Math.max(0, Math.floor(parseFloat((el("tx-q" + i) || {}).value) || 0));
    if(!q) return;
    if(a.prix > 0){ sousTotal += q * a.prix; lignes.push(q + (a.u === "m²" ? " m² de " + a.n.toLowerCase() : " × " + a.n) + " (" + eur(a.prix) + "/" + a.u + ")"); }
    else surDevis.push(q + " × " + a.n);
  });
  sousTotal = r2(sousTotal);
  var dateStr = el("tx-date").value;
  if(!lignes.length && !surDevis.length) return null;
  if(!lignes.length) return {erreur: "Ces articles sont chiffrés sur devis : générez votre devis ou prenez rendez-vous."};
  var prest = Math.max(sousTotal, TEXTILE.minimum);
  var minApplique = prest > sousTotal;
  var majo = estDimancheOuFerie(dateStr) ? r2(prest * MAJO_DIM_FERIE) : 0;
  var horsDepl = r2(prest + majo);
  var depl = deplacementSimule(dateStr, el("tx-adresse").value, horsDepl);
  return {lignes: lignes, surDevis: surDevis, sousTotal: sousTotal, prest: prest, minApplique: minApplique, majo: majo, horsDepl: horsDepl, depl: depl, ht: r2(horsDepl + depl.montant), dateStr: dateStr};
}
function calcTextile(){
  if(!el("zone-textile")) return;
  var d = detailsTextile(), det = el("tx-detail");
  function vide(){ ["tx-prest", "tx-majo", "tx-depl", "tx-ht", "tx-tva", "tx-ttc"].forEach(function(i){ el(i).textContent = "—"; }); el("tx-lig-majo").hidden = true; }
  if(!d){ det.textContent = "Indiquez au moins un article : le prix s'affiche instantanément."; vide(); return; }
  if(d.erreur){ det.textContent = d.erreur; vide(); return; }
  det.textContent = d.lignes.join(" + ")
    + (d.minApplique ? " — minimum d'intervention appliqué : " + eur(TEXTILE.minimum) + " HT" : "")
    + (d.surDevis.length ? " · sur devis : " + d.surDevis.join(", ") : "")
    + (d.dateStr ? "" : " — indiquez la date souhaitée (majoration de 10 % les dimanches et jours fériés).");
  el("tx-prest").textContent = eur(d.prest);
  el("tx-lig-majo").hidden = d.majo === 0; el("tx-majo").textContent = eur(d.majo);
  el("tx-depl").textContent = eur(d.depl.montant); el("tx-lbl-depl").textContent = d.depl.libelle;
  var tva = r2(d.ht * TVA);
  el("tx-ht").textContent = eur(d.ht); el("tx-tva").textContent = eur(tva); el("tx-ttc").textContent = eur(r2(d.ht + tva));
}
function itemTextile(){
  var d = detailsTextile(), adresse = el("tx-adresse").value.trim();
  if(!d || d.erreur || !d.dateStr || !adresse || joursAvant(d.dateStr) < 0) return null;
  return {
    titre: "Nettoyage moquettes, tapis & canapés — injection-extraction",
    detail: d.lignes.join(" + ") + (d.minApplique ? " · minimum d'intervention " + eur(TEXTILE.minimum) + " HT" : "")
      + (d.majo > 0 ? " · +10 % dim./férié" : "") + (d.surDevis.length ? " · sur devis (non chiffré) : " + d.surDevis.join(", ") : "")
      + (el("tx-heure").value ? " · heure souhaitée : " + el("tx-heure").value : ""),
    date: d.dateStr, heure: el("tx-heure").value, h: 2, adresse: adresse,
    commentaire: el("tx-comment").value.trim(),
    ht: d.horsDepl
  };
}
function ajouterAuPanierTextile(){
  var det = el("tx-detail"), d = detailsTextile();
  if(!d){ det.textContent = "⚠ Indiquez au moins un article à nettoyer."; return; }
  if(d.erreur){ det.textContent = d.erreur; return; }
  if(!d.dateStr){ det.textContent = "⚠ Merci d'indiquer la date d'intervention souhaitée."; return; }
  if(joursAvant(d.dateStr) < 0){ det.textContent = "⚠ La date choisie est passée — merci de sélectionner une date à venir."; return; }
  if(!el("tx-adresse").value.trim()){ det.textContent = "⚠ Merci d'indiquer l'adresse de l'intervention."; return; }
  if(!adresseValide("tx-adresse")){ det.textContent = "⚠ Adresse non reconnue : sélectionnez une adresse dans la liste proposée pendant la saisie."; return; }
  if(!el("bc-cgv").checked){ det.textContent = "⚠ Merci d'accepter les Conditions Générales de Vente pour ajouter au panier."; return; }
  panier.push(itemTextile());
  majPanier(); fermerCommande(); ouvrirPanier();
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
    var dpB = deplacementSimule(el("bp-date").value, el("bp-adresse").value, r2(taux * h));
    det.textContent = BUREAUX.ponctuel[s].n + " : " + taux + " € HT/h × " + h + " h + " + dpB.libelle.charAt(0).toLowerCase() + dpB.libelle.slice(1) + " : " + eur(dpB.montant) + " HT.";
    afficherBureaux(r2(taux * h + dpB.montant), "");
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
  if(univers === "textile"){
    var tx = itemTextile();
    return tx ? [tx] : [];
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
              if(id === "tx-adresse") calcTextile();
              if(id === "bp-adresse") calcBureaux();
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
["bc-adresse", "bp-adresse", "bc-adr-bur", "co-adresse", "tx-adresse"].forEach(attacherAutocomplete);
function adresseValide(id){
  return el(id).value.trim() !== "" && adresseOK[id] === true;
}

/* Ferme le menu mobile quand on suit un lien de navigation */
document.querySelectorAll("nav.liens a").forEach(function(a){ a.addEventListener("click", fermerMenu); });

/* Au chargement : panier conservé d'une page à l'autre, import d'un compte depuis un lien de transfert */
chargerPanier(); majPanier();
if(BACKEND){
  /* La facturation se fait depuis la page /admin/ (accès protégé) */
  ["ong-fact", "volet-fact"].forEach(function(i){ if(el(i)) el(i).remove(); });
  if(el("ong-br")) el("ong-br").style.flex = "1";
  chargerEspace().then(majEtatConnexion);
} else {
  detecterImport();
}
