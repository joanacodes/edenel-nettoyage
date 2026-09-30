// Fichier .ics (Apple Calendar, Outlook…) et lien « Ajouter à Google Agenda ».
import { ajouterMinutes } from "./temps.ts";

export type Evenement = { titre: string; date: string; heure: string; duree: number; lieu?: string; details?: string; uid: string };

const horo = (date: string, heure: string) => date.replace(/-/g, "") + "T" + heure.replace(":", "") + "00";

export function lienGoogleAgenda(ev: Evenement): string {
  const fin = ajouterMinutes(ev.date, ev.heure, ev.duree);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(ev.titre)
    + "&dates=" + horo(ev.date, ev.heure) + "/" + horo(fin.date, fin.heure)
    + "&ctz=Europe/Paris"
    + "&details=" + encodeURIComponent(ev.details ?? "")
    + (ev.lieu ? "&location=" + encodeURIComponent(ev.lieu) : "");
}

export function ics(ev: Evenement, methode: "PUBLISH" | "CANCEL" = "PUBLISH"): string {
  const fin = ajouterMinutes(ev.date, ev.heure, ev.duree);
  const e = (t: string) => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const maintenant = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EDENEL NETTOYAGE PRO//Site web//FR", "CALSCALE:GREGORIAN", "METHOD:" + methode,
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT", "UID:" + ev.uid + "@edenelnettoyage.fr", "DTSTAMP:" + maintenant,
    "DTSTART;TZID=Europe/Paris:" + horo(ev.date, ev.heure),
    "DTEND;TZID=Europe/Paris:" + horo(fin.date, fin.heure),
    "SUMMARY:" + e(ev.titre), "DESCRIPTION:" + e(ev.details ?? ""),
    ...(ev.lieu ? ["LOCATION:" + e(ev.lieu)] : []),
    ...(methode === "CANCEL" ? ["STATUS:CANCELLED", "SEQUENCE:1"] : ["BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:" + e(ev.titre), "END:VALARM"]),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function base64(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin);
}

export function pieceIcs(ev: Evenement, nom: string, methode: "PUBLISH" | "CANCEL" = "PUBLISH") {
  return { filename: nom, content: base64(ics(ev, methode)), content_type: "text/calendar; charset=utf-8" };
}
