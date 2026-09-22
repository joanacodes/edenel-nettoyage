# EDENEL NETTOYAGE PROFESSIONNEL — site web (Hugo)

Site vitrine statique, rapide et optimisé SEO, construit avec [Hugo](https://gohugo.io) (version étendue) et publié automatiquement sur **GitHub Pages** à chaque `git push`.

- **Landing page** complète (hero, garanties, expérience, prestations, étapes, zone, FAQ, avis, blog, contact).
- **Une page dédiée par prestation** du menu : `/prestations/…` (7 pages) + page index.
- **Grille tarifaire** `/tarifs/` générée depuis `data/tarifs.yaml` (même source que le simulateur).
- **Simulateur / devis / panier / rendez-vous / bon de réception / espace client** : `assets/js/app.js`.
- **Blog** Markdown (`content/blog/`) avec pagination, articles liés, flux RSS.
- **Pages légales** : CGV, mentions légales ; page « merci » après envoi du formulaire.
- **SEO** : title/description par page, canonical, Open Graph, Twitter Cards, JSON-LD (LocalBusiness, WebSite, FAQPage, BreadcrumbList, Service + Offer, BlogPosting), sitemap.xml, robots.txt, RSS, polices auto-hébergées.
- **CSS et JS séparés**, minifiés et empreintés (cache long + `integrity`) ; aucun style en ligne dans les gabarits.
- **Formulaire de contact** via FormSubmit (aucun serveur), plus envoi AJAX pour devis, RDV, bon de réception, création de compte.

---

## 1. Lancer le site en local

Prérequis : [Hugo extended ≥ 0.166](https://gohugo.io/installation/) et Git.

```bash
hugo server -D          # http://localhost:1313 — rechargement automatique
hugo --gc --minify      # génère le site dans public/ (facultatif, l'action GitHub le fait)
```

Dans VS Code : ouvrez le dossier, terminal → `hugo server -D`. Extensions recommandées proposées automatiquement (`.vscode/extensions.json`).

## 2. Publier sur GitHub Pages (une seule fois)

1. Créez le dépôt (ex. `edenel-nettoyage`), poussez ce dossier sur la branche `main` depuis VS Code (Source Control → Publish / Commit → Push).
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
3. Le workflow `.github/workflows/hugo.yml` construit et déploie le site à chaque push sur `main`. L'URL (`https://<utilisateur>.github.io/<dépôt>/`) est injectée automatiquement : **inutile de modifier `baseURL`** dans `hugo.toml`.

Domaine personnalisé (ex. `edenel-nettoyage.fr`) : ajoutez un fichier `static/CNAME` contenant le domaine, configurez les DNS chez votre registrar, puis renseignez le domaine dans Settings → Pages. Le workflow adapte l'URL de base.

## 3. Où modifier quoi

| Je veux…                                  | Fichier                                        |
| ----------------------------------------- | ---------------------------------------------- |
| Changer un prix, un coefficient, une durée minimum | `data/tarifs.yaml` (met à jour la page Tarifs **et** le simulateur) |
| Modifier les textes de l'accueil          | `data/accueil.yaml`                            |
| Modifier la FAQ / les avis                | `data/faq.yaml`, `data/avis.yaml`              |
| Modifier une page prestation              | `content/prestations/<slug>.md` (texte, tarifs indicatifs, points inclus, FAQ) |
| Ajouter une prestation                    | copier un fichier de `content/prestations/` : elle apparaît automatiquement dans le menu, l'index et le maillage |
| Écrire un article de blog                 | `hugo new blog/mon-article.md` puis éditer, passer `draft: false` |
| CGV / mentions légales                    | `content/cgv.md`, `content/mentions-legales.md` |
| Email de réception des formulaires, téléphone, réseaux, liens de paiement, calendrier externe | `hugo.toml` → `[params]` |
| Coordonnées légales de la société          | `hugo.toml` → `[params.societe]` (utilisées partout : pied de page, JSON-LD, devis, factures, mentions) |
| Styles                                    | `assets/css/main.css`                          |
| Logique du simulateur / panier / devis    | `assets/js/app.js` (les constantes tarifaires y sont injectées depuis `data/tarifs.yaml`) |
| Icônes SVG                                | `layouts/partials/icone.html`                  |
| Image de partage (Open Graph)             | `static/og-image.png` (1200 × 630)             |

### Front matter d'un article de blog

```yaml
---
title: "Titre de l'article (60 caractères max. idéalement)"
description: "Résumé de 150 caractères max. : affiché dans Google et sur les cartes."
date: 2026-10-01
lastmod: 2026-10-01
tags: ["Airbnb", "Tarifs"]
draft: false
---
```

Le slug (URL) est le nom du fichier : `content/blog/menage-airbnb-paris-15.md` → `/blog/menage-airbnb-paris-15/`. Les 15 articles actuels reprennent le contenu de l'ancien site ; ils peuvent être enrichis ou remplacés par les 30 articles de 1 000 mots prévus.

## 4. Réservations, commandes et agendas — sans aucun compte à connecter

Le site fonctionne **sans serveur et sans API** : rien à brancher, rien à payer.

**Rendez-vous** (« Prendre rendez-vous ») : le client choisit un jour et un créneau, laisse son nom, son mobile et son email, puis confirme.
1. La société reçoit un email d'alerte (FormSubmit) avec les coordonnées **et un lien « Ajouter à l'agenda EDENEL » en un clic** — l'événement se crée dans le Google Agenda de la société.
2. Le client reçoit un email de confirmation avec le même type de lien pour **son** agenda.
3. À l'écran, le client voit immédiatement deux boutons : « Ajouter à Google Agenda » et « Fichier .ics » (Apple Calendar, Outlook).

**Commandes** (« Passer commande » → panier → « Valider ma commande » → « Confirmer ma commande ») : même mécanique. La société reçoit le détail (prestations, date, adresse, total, n° client) avec le lien agenda ; le client reçoit un récapitulatif avec le sien. Le règlement se fait à réception de la facture. Si vous renseignez `lienStripe` ou `lienPaypal` dans `hugo.toml`, un paiement en ligne immédiat s'ajoute en option.

Ce qu'il faut savoir : le créneau demandé est une **demande**, pas une réservation ferme — le site ne connaît pas l'agenda réel de la société, donc c'est la société qui confirme par téléphone (c'est écrit au client). Pour une vérification automatique des disponibilités, il faudrait connecter un outil de réservation (Cal.com ou les plages de rendez-vous Google) via le paramètre `calendrierExterne` — prêt à l'emploi si vous changez d'avis.

**Devis, factures, historique** : tous les documents sont générés dans le navigateur en **vrais fichiers PDF** téléchargés (bibliothèque jsPDF hébergée sur le site, chargée uniquement au clic). Aucune fenêtre pop-up, donc aucun blocage par les navigateurs.

## 5. À renseigner avant la mise en ligne

Dans `hugo.toml` :

- `formsubmit` : l'adresse email qui reçoit les formulaires. ⚠ **Indispensable : lors du tout premier envoi depuis le site en ligne, FormSubmit envoie un email d'activation à cette adresse — tant que le lien n'est pas cliqué, aucun formulaire, rendez-vous ni commande n'arrive.** Faites un premier envoi test vous-même juste après la mise en ligne.
- `telephone` : numéro affiché dans le pied de page et le JSON-LD (laisser vide pour ne rien afficher).
- `lienStripe`, `lienPaypal` : facultatifs. Liens de paiement (Payment Link Stripe, bouton PayPal.me) — tant qu'ils sont vides, la commande se confirme par email avec règlement à réception de facture ; dès qu'un lien est renseigné, le paiement en ligne apparaît en option.
- `calendrierExterne` : URL Calendly / Google Agenda si vous préférez un agenda externe au calendrier intégré.
- `codeInterne` : code de l'onglet « générer la facture ». ⚠ Ce code est lisible dans le JavaScript public ; il évite les erreurs de manipulation mais n'est pas une protection de sécurité. Pour une vraie facturation en ligne, utilisez un outil dédié.

## 6. Structure du projet

```
hugo.toml                 configuration, paramètres, mentions légales
archetypes/               modèles pour `hugo new`
assets/css/main.css       feuille de style unique
assets/js/app.js          script unique (gabarit Hugo)
content/                  pages Markdown (accueil, prestations, tarifs, blog, légal)
data/                     tarifs.yaml, accueil.yaml, faq.yaml, avis.yaml
layouts/                  gabarits HTML (baseof, home, page, tarifs, blog/, prestations/, partials/)
static/                   polices, favicons, image OG, manifest
.github/workflows/        déploiement GitHub Pages
```

## 7. Vérifications SEO après publication

1. Google Search Console : ajouter la propriété, soumettre `sitemap.xml`.
2. Tester les données structurées : https://search.google.com/test/rich-results (LocalBusiness, FAQ, Service, BlogPosting).
3. Vérifier l'aperçu de partage : https://www.opengraph.xyz.
4. Créer/mettre à jour la fiche Google Business Profile avec la même adresse et le même téléphone que dans `hugo.toml`.
