/* =====================================================================
   EDENEL — Espace d'administration (/admin/)
   S'appuie sur les fonctions de app.js (connexion, appels serveur, PDF).
   ===================================================================== */
var ADM_STATUTS = {recue: "Reçue", planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée"};
var ADM_FACT = {en_attente: "En attente", emise: "Émise", payee: "Payée"};
var ADM_JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
var admCommandes = {};

function admMsg(t, c){ note("adm-msg", t, c); }
function admAujourdhui(){ return isoLocal(new Date()); }
function admDecaler(iso, n){ var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); }
function admBadge(txt, cls){ return '<span class="adm-statut ' + (cls || "") + '">' + echapper(txt) + "</span>"; }

/* ---------- Connexion ---------- */
function admEnvoyerCode(){
  var email = el("adm-email").value.trim().toLowerCase();
  if(email.indexOf("@") < 1){ note("adm-note", "⚠ Email invalide.", ROUGE); return; }
  el("adm-btn-code").disabled = true;
  appelAuth("otp", {email: email, create_user: true}).then(function(){
    el("adm-bloc-code").hidden = false; el("adm-btn-valider").hidden = false; el("adm-code").focus();
    note("adm-note", "✓ Code envoyé à " + email + ".", VERT);
  }).catch(function(e){ note("adm-note", "⚠ " + (e.statut === 429 ? "Patientez une minute avant de redemander un code." : "Envoi impossible."), ROUGE); })
    .then(function(){ el("adm-btn-code").disabled = false; });
}
function admValiderCode(){
  appelAuth("verify", {type: "email", email: el("adm-email").value.trim().toLowerCase(), token: el("adm-code").value.replace(/\s/g, "")})
    .then(function(d){ memoriserSession(d); admDemarrer(); })
    .catch(function(){ note("adm-note", "⚠ Code incorrect ou expiré.", ROUGE); });
}
function admDeconnexion(){ oublierSession(); location.reload(); }
function admDemarrer(){
  if(!sessionCourante()){ el("adm-connexion").hidden = false; el("adm-app").hidden = true; return; }
  rpc("est_admin").then(function(ok){
    if(!ok){
      el("adm-connexion").hidden = false; el("adm-app").hidden = true;
      note("adm-note", "⚠ " + (sessionCourante().user || {}).email + " n'est pas administrateur. Connectez-vous avec un email autorisé.", ROUGE);
      oublierSession(); return;
    }
    el("adm-connexion").hidden = true; el("adm-app").hidden = false;
    el("adm-qui").textContent = "Connecté : " + sessionCourante().user.email;
    admOnglet("rdv");
  }).catch(function(){ oublierSession(); el("adm-connexion").hidden = false; note("adm-note", "Session expirée : reconnectez-vous.", ROUGE); });
}
function admOnglet(o){
  ["rdv", "cmd", "agenda", "etat"].forEach(function(x){
    el("adm-p-" + x).hidden = x !== o; el("adm-o-" + x).classList.toggle("actif", x === o);
  });
  admMsg("");
  ({rdv: admChargerRdv, cmd: admChargerCmd, agenda: admChargerAgenda, etat: admEtat})[o]();
}

/* ---------- Rendez-vous ---------- */
function admChargerRdv(){
  var tous = el("adm-rdv-passes").checked;
  var q = "rdv?select=*&order=date.asc,heure.asc&date=gte." + (tous ? admDecaler(admAujourdhui(), -30) : admAujourdhui()) + (tous ? "" : "&statut=neq.annule");
  appelBase(q).then(function(l){
    var t = el("adm-t-rdv");
    if(!l.length){ t.innerHTML = '<tr><td class="cmd-vide">Aucun rendez-vous.</td></tr>'; return; }
    t.innerHTML = "<tr><th>Date</th><th>Heure</th><th>Client</th><th>Contact</th><th>Objet</th><th>Statut</th><th>Actions</th></tr>" + l.map(function(r){
      var st = r.statut === "confirme" ? admBadge("Confirmé", "ok") : r.statut === "annule" ? admBadge("Annulé", "ko") : admBadge("À confirmer");
      var act = (r.statut === "demande" ? '<button class="btn btn-vert" type="button" onclick="admRdv(\'' + r.id + '\',\'confirme\')">Confirmer</button>' : "")
        + (r.statut !== "annule" ? '<button class="btn btn-ligne" type="button" onclick="admRdv(\'' + r.id + '\',\'annule\')">Annuler</button>' : "");
      return "<tr><td>" + echapper(dateLongue(r.date)) + "</td><td>" + echapper(r.heure) + "</td><td><strong>" + echapper(r.nom) + "</strong></td><td>"
        + '<a class="lien" href="tel:' + echapper(r.tel.replace(/\s/g, "")) + '">' + echapper(r.tel) + '</a><br><a class="lien" href="mailto:' + echapper(r.email) + '">' + echapper(r.email) + "</a></td><td>"
        + echapper(r.message || "—") + "</td><td>" + st + "</td><td>" + act + "</td></tr>";
    }).join("");
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admRdv(id, statut){
  var mot = prompt(statut === "annule" ? "Annuler ce rendez-vous ? Le client est prévenu par email.\nMessage à ajouter (facultatif) :" : "Confirmer ce rendez-vous ? Le client reçoit un email.\nMessage à ajouter (facultatif) :", "");
  if(mot === null) return;
  admMsg("Envoi…", GRIS);
  appelFonction("admin", {action: "rdv_statut", id: id, statut: statut, message: mot}).then(function(){
    admMsg("✓ Rendez-vous " + (statut === "annule" ? "annulé" : "confirmé") + " — le client a été prévenu par email.", VERT); admChargerRdv();
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}

/* ---------- Commandes ---------- */
function admChargerCmd(){
  var f = el("adm-cmd-filtre").value, q = "commandes?select=*";
  if(f === "actives") q += "&statut=in.(recue,planifiee,en_cours)&order=date_intervention.asc";
  else if(f === "factures") q += "&statut=neq.annulee&statut_facture=neq.payee&order=date_intervention.asc";
  else q += "&order=created_at.desc&limit=300";
  appelBase(q).then(function(l){
    if(f === "factures") l = l.filter(function(c){ return c.date_br || c.statut === "terminee"; });
    admCommandes = {}; l.forEach(function(c){ admCommandes[c.id] = c; });
    var z = el("adm-l-cmd");
    if(!l.length){ z.innerHTML = '<p class="modal-note">Aucune commande.</p>'; return; }
    z.innerHTML = l.map(admCarteCommande).join("");
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admCarteCommande(c){
  var lignes = (c.lignes || []).map(function(li){
    return "<li><strong>" + echapper(li.titre) + "</strong> — " + echapper(li.detail) + " — " + echapper(frDate(li.date)) + (li.heure ? " (souhaité " + echapper(li.heure) + ")" : "") + " — " + echapper(li.adresse) + " — " + eur(Number(li.ht)) + " HT"
      + (li.commentaire ? "<br><em>« " + echapper(li.commentaire) + " »</em>" : "") + "</li>";
  }).join("");
  var id = echapper(c.id), stCls = c.statut === "annulee" ? "ko" : (c.statut === "terminee" ? "ok" : "");
  var optS = ["recue", "planifiee", "en_cours", "terminee"].map(function(s){ return '<option value="' + s + '"' + (c.statut === s ? " selected" : "") + ">" + ADM_STATUTS[s] + "</option>"; }).join("");
  var optF = ["en_attente", "emise", "payee"].map(function(s){ return '<option value="' + s + '"' + (c.statut_facture === s ? " selected" : "") + ">" + ADM_FACT[s] + "</option>"; }).join("");
  return '<div class="adm-cmd"><h3>' + id + " — " + echapper(c.client_nom || "") + " " + admBadge(ADM_STATUTS[c.statut] || c.statut, stCls) + " " + admBadge("Facture : " + (ADM_FACT[c.statut_facture] || ""), c.statut_facture === "payee" ? "ok" : "") + "</h3>"
    + '<p class="adm-meta">Commandée le ' + echapper(frDate((c.created_at || "").slice(0, 10))) + " · "
    + '<a class="lien" href="tel:' + echapper((c.client_tel || "").replace(/\s/g, "")) + '">' + echapper(c.client_tel || "") + '</a> · <a class="lien" href="mailto:' + echapper(c.client_email || "") + '">' + echapper(c.client_email || "") + "</a>"
    + " · N° client " + echapper(c.numero_client || "—") + (c.fidelite ? " · Tarif Fidélité" : "")
    + "<br>Intervention : <strong>" + echapper(frDate(c.date_intervention)) + (c.heure_planifiee ? " à " + echapper(c.heure_planifiee) + " (confirmée)" : " — horaire à confirmer") + "</strong>"
    + " · Total : <strong>" + eur(Number(c.ht)) + " HT / " + eur(Number(c.ttc)) + " TTC</strong> (dont déplacement " + eur(Number(c.deplacement)) + ")"
    + (c.date_br ? "<br>Bon de réception validé le " + echapper(frDate(c.date_br)) + (c.br_observations ? " — « " + echapper(c.br_observations) + " »" : "") : "")
    + (c.facture_numero ? "<br>Facture " + echapper(c.facture_numero) + " du " + echapper(frDate(c.facture_date)) : "") + "</p>"
    + "<ul>" + lignes + "</ul>"
    + (c.statut === "annulee" ? "" :
      '<div class="adm-actions">'
      + '<div class="champ"><label for="p-d-' + id + '">Date</label><input id="p-d-' + id + '" type="date" value="' + echapper(c.date_intervention || "") + '"></div>'
      + '<div class="champ"><label for="p-h-' + id + '">Heure</label><input id="p-h-' + id + '" type="time" value="' + echapper(c.heure_planifiee || c.heure_souhaitee || "") + '"></div>'
      + '<button class="btn btn-vert" type="button" onclick="admPlanifier(\'' + id + '\')">Confirmer l\'horaire au client</button>'
      + '<div class="champ"><label for="s-' + id + '">Statut</label><select id="s-' + id + '" onchange="admMaj(\'' + id + '\',{statut:this.value})">' + optS + "</select></div>"
      + '<div class="champ"><label for="f-' + id + '">Facture</label><select id="f-' + id + '" onchange="admMaj(\'' + id + '\',{statut_facture:this.value})">' + optF + "</select></div>"
      + '<button class="btn btn-teal" type="button" onclick="admFacture(\'' + id + '\',false)">Facture PDF</button>'
      + '<button class="btn btn-plein" type="button" onclick="admFacture(\'' + id + '\',true)">Envoyer la facture</button>'
      + '<button class="btn btn-ligne" type="button" onclick="admAnnuler(\'' + id + '\')">Annuler la commande</button>'
      + "</div>")
    + "</div>";
}
function admPlanifier(id){
  var date = el("p-d-" + id).value, heure = el("p-h-" + id).value;
  if(!date || !heure){ admMsg("⚠ Indiquez la date et l'heure d'intervention.", ROUGE); return; }
  var mot = prompt("Le client va recevoir la confirmation : " + dateLongue(date) + " à " + heure + ".\nMessage à ajouter (facultatif) :", "");
  if(mot === null) return;
  admMsg("Envoi…", GRIS);
  appelFonction("admin", {action: "commande_planifier", id: id, date: date, heure: heure, message: mot}).then(function(){
    admMsg("✓ Intervention " + id + " planifiée — le client a reçu la confirmation par email.", VERT); admChargerCmd();
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admMaj(id, champs){
  appelBase("commandes?id=eq." + encodeURIComponent(id), {method: "PATCH", corps: champs, prefer: "return=minimal"})
    .then(function(){ admMsg("✓ Commande " + id + " mise à jour.", VERT); admChargerCmd(); })
    .catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admAnnuler(id){
  var mot = prompt("Annuler la commande " + id + " ? Le client est prévenu par email.\nMotif (facultatif) :", "");
  if(mot === null) return;
  appelFonction("admin", {action: "commande_annuler", id: id, message: mot}).then(function(){
    admMsg("✓ Commande " + id + " annulée.", VERT); admChargerCmd();
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
/* Facture PDF (numéro légal attribué par le serveur, continu et chronologique) */
function admFacture(id, envoyer){
  var c = admCommandes[id]; if(!c) return;
  if(envoyer && !confirm("Envoyer la facture de la commande " + id + " à " + c.client_email + " ?")) return;
  admMsg("Préparation de la facture…", GRIS);
  rpc("attribuer_facture", {p_commande: id}).then(function(f){
    c.facture_numero = f.numero; c.facture_date = f.date;
    return nouveauPDF(function(doc){
      var y = pdfTitre(doc, "Facture n° " + f.numero, ["Date d'émission : " + frDate(f.date) + " — Commande " + c.id + " du " + frDate((c.created_at || "").slice(0, 10)),
        "Intervention du " + frDate(c.date_intervention) + (c.heure_planifiee ? " à " + c.heure_planifiee : "")]);
      if(c.statut_facture === "payee") y = pdfBadge(doc, y, "Facture acquittée");
      y = pdfBloc(doc, y, "Client", [c.client_nom || "", "Email : " + (c.client_email || "") + (c.client_tel ? " — Tél. : " + c.client_tel : ""), "Lieu d'intervention : " + (c.adresse || ""), "N° client : " + (c.numero_client || "—")]);
      var rows = (c.lignes || []).map(function(li){ return [li.titre + "\n" + li.detail + "\nLe " + frDate(li.date) + " — " + li.adresse, eur(Number(li.ht))]; });
      if(Number(c.deplacement) > 0) rows.push(["Frais de déplacement", eur(Number(c.deplacement))]);
      y = pdfTableau(doc, y, [{titre: "Prestation", largeur: 134}, {titre: "Montant HT", largeur: 40, align: "right", gras: true}], rows);
      var ht = Number(c.ht), ttc = Number(c.ttc);
      y = pdfTotaux(doc, y, [["Total HT", eur(ht)], ["TVA (20 %)", eur(r2(ttc - ht))], ["Total TTC", eur(ttc), true]]);
      y = pdfEncadre(doc, y, "Conditions de règlement", "Facture payable à réception. Pas d'escompte pour paiement anticipé. En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal et, pour les clients professionnels, indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce).");
      pdfEncadre(doc, y, "Conditions d'annulation", ANNULATION, "orange");
      var nom = "facture-edenel-" + f.numero + ".pdf";
      if(!envoyer){ doc.save(nom); admMsg("✓ Facture " + f.numero + " téléchargée.", VERT); return; }
      var pdf = doc.output("datauristring").split(",")[1];
      return appelFonction("admin", {action: "facture_envoyer", id: id, numero: f.numero, pdf: pdf}).then(function(){
        admMsg("✓ Facture " + f.numero + " envoyée à " + c.client_email + ".", VERT); admChargerCmd();
      });
    }, function(e){ admMsg("⚠ " + (e && e.message ? e.message : "Le générateur PDF n'a pas pu se charger."), ROUGE); });
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}

/* ---------- Agenda ---------- */
function admChargerAgenda(){
  Promise.all([appelBase("agenda_regles?select=*&order=jour"), appelBase("agenda_fermetures?select=*&order=date&date=gte." + admAujourdhui()), appelBase("reglages?select=*")]).then(function(r){
    var ordre = [1, 2, 3, 4, 5, 6, 0], regles = {};
    r[0].forEach(function(x){ regles[x.jour] = x.creneaux || []; });
    el("adm-regles").innerHTML = ordre.map(function(j){
      return '<div class="champ"><label for="adm-j-' + j + '">' + ADM_JOURS[j] + '</label><input id="adm-j-' + j + '" type="text" value="' + echapper((regles[j] || []).join(", ")) + '"></div>';
    }).join("");
    el("adm-fermetures").innerHTML = r[1].length ? r[1].map(function(f){
      return "<li>" + echapper(dateLongue(f.date)) + (f.motif ? " — " + echapper(f.motif) : "") + ' <button type="button" aria-label="Rouvrir ce jour" onclick="admSupprimerFermeture(\'' + f.date + '\')">✕</button></li>';
    }).join("") : '<li class="modal-note">Aucun jour fermé à venir.</li>';
    var g = r[2][0] || {};
    el("adm-r-duree").value = g.rdv_duree; el("adm-r-delai").value = g.rdv_delai_heures; el("adm-r-horizon").value = g.rdv_horizon_jours; el("adm-r-auto").checked = !!g.rdv_confirmation_auto;
  }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admSauverRegles(){
  var erreurs = [], maj = [];
  [0, 1, 2, 3, 4, 5, 6].forEach(function(j){
    var h = el("adm-j-" + j).value.split(/[,;\s]+/).filter(Boolean).map(function(x){ var m = /^(\d{1,2})[:hH]?(\d{2})?$/.exec(x); return m ? String(m[1]).padStart(2, "0") + ":" + (m[2] || "00") : (erreurs.push(ADM_JOURS[j] + " : « " + x + " »"), null); }).filter(Boolean);
    h = h.filter(function(x, i){ return h.indexOf(x) === i && x < "24:00"; }).sort();
    maj.push(appelBase.bind(null, "agenda_regles?jour=eq." + j, {method: "PATCH", corps: {creneaux: h}, prefer: "return=minimal"}));
  });
  if(erreurs.length){ admMsg("⚠ Heures non reconnues — " + erreurs.join(", ") + ". Format attendu : 09:30", ROUGE); return; }
  Promise.all(maj.map(function(f){ return f(); })).then(function(){ admMsg("✓ Créneaux enregistrés.", VERT); admChargerAgenda(); }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admAjouterFermeture(){
  var d = el("adm-f-date").value;
  if(!d){ admMsg("⚠ Choisissez une date.", ROUGE); return; }
  appelBase("agenda_fermetures", {method: "POST", corps: {date: d, motif: el("adm-f-motif").value.trim() || null}, prefer: "resolution=merge-duplicates,return=minimal"})
    .then(function(){ admMsg("✓ " + dateLongue(d) + " fermé à la réservation.", VERT); el("adm-f-motif").value = ""; admChargerAgenda(); })
    .catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admSupprimerFermeture(d){
  appelBase("agenda_fermetures?date=eq." + d, {method: "DELETE", prefer: "return=minimal"}).then(admChargerAgenda).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}
function admSauverReglages(){
  appelBase("reglages?id=eq.true", {method: "PATCH", prefer: "return=minimal", corps: {
    rdv_duree: parseInt(el("adm-r-duree").value, 10) || 30, rdv_delai_heures: parseInt(el("adm-r-delai").value, 10) || 0,
    rdv_horizon_jours: parseInt(el("adm-r-horizon").value, 10) || 60, rdv_confirmation_auto: el("adm-r-auto").checked
  }}).then(function(){ admMsg("✓ Réglages enregistrés.", VERT); }).catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}

/* ---------- État des services ---------- */
function admEtat(){
  el("adm-etat").textContent = "Vérification…";
  appelFonction("admin", {action: "etat"}).then(function(d){
    el("adm-etat").innerHTML = "<strong>Emails :</strong> " + echapper(d.emails) + " (notifications envoyées à " + echapper(d.email_edenel) + ")<br><strong>Google Agenda :</strong> " + echapper(d.google);
  }).catch(function(e){ el("adm-etat").textContent = "⚠ " + e.message; });
}
function admTestEmail(){
  appelFonction("admin", {action: "test_email"}).then(function(){ admMsg("✓ Email de test envoyé à " + sessionCourante().user.email + ".", VERT); })
    .catch(function(e){ admMsg("⚠ " + e.message, ROUGE); });
}

document.addEventListener("DOMContentLoaded", function(){ if(el("adm-app")) admDemarrer(); });
