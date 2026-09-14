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

## 4. À renseigner avant la mise en ligne

Dans `hugo.toml` :

- `formsubmit` : l'adresse email qui reçoit les formulaires (**FormSubmit envoie un email d'activation lors du premier envoi : cliquez sur le lien pour activer**).
- `telephone` : numéro affiché dans le pied de page et le JSON-LD (laisser vide pour ne rien afficher).
- `lienStripe`, `lienPaypal` : liens de paiement (Payment Link Stripe, bouton PayPal.me) — tant qu'ils sont vides, le bouton de paiement affiche un rappel.
- `calendrierExterne` : URL Calendly / Google Agenda si vous préférez un agenda externe au calendrier intégré.
- `codeInterne` : code de l'onglet « générer la facture ». ⚠ Ce code est lisible dans le JavaScript public ; il évite les erreurs de manipulation mais n'est pas une protection de sécurité. Pour une vraie facturation en ligne, utilisez un outil dédié.

## 5. Structure du projet

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

## 6. Vérifications SEO après publication

1. Google Search Console : ajouter la propriété, soumettre `sitemap.xml`.
2. Tester les données structurées : https://search.google.com/test/rich-results (LocalBusiness, FAQ, Service, BlogPosting).
3. Vérifier l'aperçu de partage : https://www.opengraph.xyz.
4. Créer/mettre à jour la fiche Google Business Profile avec la même adresse et le même téléphone que dans `hugo.toml`.
