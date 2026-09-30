#!/usr/bin/env bash
# =====================================================================
#  EDENEL — déploiement / mise à jour du serveur Supabase
#  Applique la base, les réglages de connexion (code par email via Resend),
#  les secrets et les fonctions serveur. Peut être relancé sans risque.
#
#  Variables requises :
#    SUPABASE_ACCESS_TOKEN   jeton personnel (sbp_…)   — Supabase › Account › Access Tokens
#    SUPABASE_PROJECT_REF    identifiant du projet (ex. abcdefghijklmnop)
#    RESEND_API_KEY          clé API Resend (re_…)
#    ADMIN_EMAILS            emails administrateurs, séparés par des virgules
#  Facultatives :
#    SITE_URL                défaut https://edenelnettoyage.fr
#    EMAIL_EDENEL            défaut contact@edenelnettoyage.fr (reçoit les notifications)
#    GOOGLE_SA_KEY_FILE      fichier JSON de la clé du compte de service Google
#    GOOGLE_CALENDAR_ID      identifiant de l'agenda EDENEL (souvent l'adresse Gmail)
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN manquant}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF manquant}"
: "${RESEND_API_KEY:?RESEND_API_KEY manquant}"
: "${ADMIN_EMAILS:?ADMIN_EMAILS manquant}"
SITE_URL="${SITE_URL:-https://edenelnettoyage.fr}"
SITE_URL="${SITE_URL%/}"
EMAIL_EDENEL="${EMAIL_EDENEL:-contact@edenelnettoyage.fr}"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"

appel() { # méthode chemin [corps-json]
  local reponse code
  reponse=$(curl -sS -w '\n%{http_code}' -X "$1" "$API$2" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" ${3:+--data-binary "$3"})
  code=$(tail -n1 <<<"$reponse")
  if [[ "$code" -ge 300 ]]; then echo "✗ $1 $2 → HTTP $code : $(sed '$d' <<<"$reponse")" >&2; return 1; fi
  sed '$d' <<<"$reponse"
}
json() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }
sql() { appel POST /database/query "{\"query\": $(printf '%s' "$1" | json)}"; }

echo "1/6 Base de données (migrations)"
sql "create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null
for f in supabase/migrations/*.sql; do
  nom=$(basename "$f" .sql); version="${nom%%_*}"
  deja=$(sql "select count(*) as n from supabase_migrations.schema_migrations where version = '$version'" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["n"])')
  if [[ "$deja" == "0" ]]; then
    echo "   → $nom"
    sql "$(cat "$f")" >/dev/null
    sql "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '${nom#*_}')" >/dev/null
  fi
done

echo "2/6 Administrateurs : $ADMIN_EMAILS"
valeurs=$(python3 -c 'import sys; print(",".join("(%s)" % repr(e.strip().lower()) for e in sys.argv[1].split(",") if e.strip()))' "$ADMIN_EMAILS" | tr "\"" "'")
sql "insert into public.admins (email) values $valeurs on conflict do nothing" >/dev/null

echo "3/6 Connexion par code email (Resend en SMTP)"
modele='<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#3b4a61"><div style="background:#1e2a6e;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;font-weight:700;font-size:20px">EDENEL <span style="font-size:11px;letter-spacing:3px;color:#96d2e1">NETTOYAGE PRO</span></div><div style="background:#fff;border:1px solid #e3ebef;border-top:0;padding:22px;border-radius:0 0 12px 12px"><p>Votre code de connexion à votre Espace client :</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e2a6e;margin:18px 0">{{ .Token }}</p><p style="font-size:13px;color:#68758a">Valable 1 heure. Si vous n’avez rien demandé, ignorez cet email.</p></div></div>'
config=$(MODELE="$modele" python3 - <<PY
import json, os
m = os.environ["MODELE"]
print(json.dumps({
  "site_url": "$SITE_URL",
  "uri_allow_list": "$SITE_URL/**",
  "external_email_enabled": True,
  "mailer_autoconfirm": False,
  "mailer_otp_exp": 3600,
  "mailer_otp_length": 6,
  "smtp_admin_email": "$EMAIL_EDENEL",
  "smtp_sender_name": "EDENEL Nettoyage",
  "smtp_host": "smtp.resend.com",
  "smtp_port": "465",
  "smtp_user": "resend",
  "smtp_pass": os.environ["RESEND_API_KEY"],
  "rate_limit_email_sent": 60,
  "mailer_subjects_magic_link": "Votre code de connexion EDENEL",
  "mailer_subjects_confirmation": "Votre code de connexion EDENEL",
  "mailer_templates_magic_link_content": m,
  "mailer_templates_confirmation_content": m,
}))
PY
)
appel PATCH /config/auth "$config" >/dev/null

echo "4/6 Secrets des fonctions serveur"
lire_tarif() { python3 -c 'import re,sys; m=re.search(r"^"+sys.argv[1]+r":\s*([0-9.]+)", open("data/tarifs.yaml").read(), re.M); print(m.group(1) if m else sys.argv[2])' "$1" "$2"; }
origines="$SITE_URL,$(sed -E 's#^(https?://)#\1www.#' <<<"$SITE_URL")"
secrets=$(python3 - "$@" <<PY
import json, os
s = {
  "RESEND_API_KEY": os.environ["RESEND_API_KEY"],
  "EMAIL_FROM": "EDENEL Nettoyage <$EMAIL_EDENEL>",
  "EMAIL_EDENEL": "$EMAIL_EDENEL",
  "SITE_URL": "$SITE_URL",
  "SITE_ORIGINS": "$origines",
  "TARIF_DEPLACEMENT": "$(lire_tarif deplacement 15)",
  "TARIF_DEPLACEMENT_OFFERT_DES": "$(lire_tarif deplacementOffertDes 0)",
  "TARIF_TVA": "$(lire_tarif tva 0.2)",
}
f = os.environ.get("GOOGLE_SA_KEY_FILE")
if f:
  cle = json.load(open(f))
  s["GOOGLE_SA_EMAIL"] = cle["client_email"]
  s["GOOGLE_SA_KEY"] = cle["private_key"]
  s["GOOGLE_CALENDAR_ID"] = os.environ["GOOGLE_CALENDAR_ID"]
print(json.dumps([{"name": k, "value": v} for k, v in s.items()]))
PY
)
appel POST /secrets "$secrets" >/dev/null

echo "5/6 Fonctions serveur (rdv, commande, message, admin)"
for f in rdv commande message admin; do
  npx --yes supabase@latest functions deploy "$f" --project-ref "$SUPABASE_PROJECT_REF" --use-api --no-verify-jwt >/dev/null
  echo "   → $f"
done

echo "6/6 Clé publique du site"
cle=$(appel GET "/api-keys?reveal=false" | python3 -c '
import json,sys
k = json.load(sys.stdin)
pub = [x for x in k if x.get("type") == "publishable"] or [x for x in k if x.get("name") == "anon"]
print(pub[0]["api_key"] if pub else "")')
url="https://$SUPABASE_PROJECT_REF.supabase.co"
if [[ -n "$cle" ]]; then
  python3 - "$url" "$cle" <<'PY'
import re, sys
p = "hugo.toml"; s = open(p).read()
s = re.sub(r'(supabaseUrl\s*=\s*)"[^"]*"', lambda m: m.group(1) + '"%s"' % sys.argv[1], s, count=1)
s = re.sub(r'(supabaseCle\s*=\s*)"[^"]*"', lambda m: m.group(1) + '"%s"' % sys.argv[2], s, count=1)
open(p, "w").write(s)
PY
  echo "   → hugo.toml mis à jour ($url)"
fi
echo "✓ Serveur prêt. Pensez à commiter hugo.toml puis à publier le site."
