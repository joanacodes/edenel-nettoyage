# Mise en service du serveur (Supabase + Resend + Google Agenda)

Le site reste hébergé sur **GitHub Pages** (gratuit). Tout ce qui demande un serveur passe par **Supabase** (gratuit jusqu'à 50 000 utilisateurs) :

| Fonction | Avant (sans serveur) | Avec Supabase |
| --- | --- | --- |
| Espace client | compte stocké dans le navigateur, un par appareil | connexion par **code reçu par email**, même compte sur ordinateur et téléphone |
| Commandes | email FormSubmit | enregistrées en base, montants et Tarif Fidélité **vérifiés par le serveur**, emails de récapitulatif |
| Rendez-vous | simple demande | **agenda réel** : créneaux libres, pas de double réservation, confirmation par email + .ics |
| Emails | FormSubmit (souvent en spam) | envoyés par **Resend** depuis `contact@edenelnettoyage.fr` |
| Factures | code interne visible dans le JavaScript | page **/admin/** protégée, numérotation légale continue (FAC-2026-00001…), envoi du PDF au client |
| Google Agenda | — | (facultatif) chaque RDV / intervention s'ajoute à l'agenda EDENEL, et les occupations de l'agenda bloquent les créneaux |

Sans configuration (`supabaseUrl` vide dans `hugo.toml`), le site garde le fonctionnement sans serveur.

---

## 1. Supabase (5 min)

1. Créer un compte sur <https://supabase.com> → **New project** → région **Europe (Paris ou Frankfurt)** → noter le mot de passe de la base (on n'en a pas besoin ensuite).
2. Récupérer :
   - l'**identifiant du projet** (Project Settings → General → *Reference ID*, ex. `abcdefghijklmnop`) ;
   - un **jeton d'accès** : avatar → *Account preferences* → **Access Tokens** → *Generate new token* (`sbp_…`). Il sert uniquement au déploiement ; il peut être révoqué ensuite.

## 2. Resend — emails au nom de edenelnettoyage.fr (10 min + délai DNS)

1. Créer un compte sur <https://resend.com> → **Domains** → *Add domain* → `edenelnettoyage.fr` (région EU).
2. Resend affiche 3 enregistrements DNS (MX `send`, TXT SPF `send`, TXT DKIM `resend._domainkey`). Les ajouter chez le registrar du domaine (OVH, Gandi, IONOS…), puis cliquer **Verify** (quelques minutes à quelques heures).
3. **API Keys** → *Create API key* (permission *Sending access*) → `re_…`.
4. ⚠ La boîte `contact@edenelnettoyage.fr` doit exister pour **recevoir** les notifications et les réponses des clients (Resend ne fait qu'envoyer).

## 3. Google Agenda (facultatif, gratuit, sans Google Workspace — 10 min)

1. <https://console.cloud.google.com> avec le compte Google d'EDENEL → créer un projet « EDENEL site ».
2. **API et services → Bibliothèque** → activer **Google Calendar API** (aucune facturation requise).
3. **IAM et administration → Comptes de service** → *Créer* (nom : `site-edenel`) → ouvrir le compte → **Clés** → *Ajouter une clé* → **JSON** : un fichier se télécharge.
4. Dans **Google Agenda** (agenda.google.com) → paramètres de l'agenda EDENEL → **Partager avec des personnes** → ajouter l'adresse du compte de service (`site-edenel@….iam.gserviceaccount.com`) avec **« Apporter des modifications aux événements »**.
5. Noter l'**ID de l'agenda** (même page, section *Intégrer l'agenda* ; pour l'agenda principal, c'est l'adresse Gmail).

## 4. Déploiement

Depuis le dossier du site (ou demander à Claude de le faire) :

```bash
SUPABASE_ACCESS_TOKEN=sbp_… \
SUPABASE_PROJECT_REF=abcdefghijklmnop \
RESEND_API_KEY=re_… \
ADMIN_EMAILS="contact@edenelnettoyage.fr,autre@exemple.fr" \
GOOGLE_SA_KEY_FILE=~/Téléchargements/cle-google.json \
GOOGLE_CALENDAR_ID=edenel@gmail.com \
./scripts/deployer-supabase.sh
```

Le script (relançable sans risque) : crée les tables, ajoute les administrateurs, configure la connexion par code email (envoyée via Resend), enregistre les secrets, déploie les 4 fonctions serveur, puis écrit l'URL et la clé publique dans `hugo.toml`. Il suffit ensuite de commiter et publier (push sur `main`).

⚠ Après chaque modification de `deplacement` / `deplacementOffertDes` dans `data/tarifs.yaml`, relancer le script : le serveur vérifie les frais de déplacement avec ces valeurs.

## 5. Vérifications après mise en ligne

1. **/admin/** → se connecter avec un email administrateur → onglet **État des services** : emails « configurés », Google « connecté ✓ » → *M'envoyer un email de test*.
2. **Agenda & horaires** : régler les créneaux de chaque jour, les jours fermés, la durée d'un RDV et la confirmation automatique.
3. Sur le site : prendre un rendez-vous, créer un compte, passer une commande → vérifier les emails reçus (client et `contact@`), puis planifier la commande et envoyer une facture depuis /admin/.
4. Se connecter avec le même email sur un téléphone : les commandes doivent y apparaître.

## Où se trouve quoi

```
supabase/migrations/        tables, sécurité (RLS), numérotation des factures
supabase/functions/rdv      créneaux libres + réservation
supabase/functions/commande validation d'une commande (contrôle des montants et de la fidélité)
supabase/functions/message  formulaire de contact, devis, bon de réception
supabase/functions/admin    actions de /admin/ (confirmations, annulations, factures)
assets/js/admin.js          page /admin/
scripts/deployer-supabase.sh déploiement
```
