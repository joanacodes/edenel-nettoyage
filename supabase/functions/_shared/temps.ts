// Dates et heures, toujours exprimées à l'heure de Paris.

/** Instant UTC correspondant à « date + heure » à Paris (gère l'heure d'été). */
export function parisVersDate(date: string, heure = "00:00"): Date {
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const supposé = Date.UTC(a, m - 1, j, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(supposé)).map((p) => [p.type, p.value]),
  );
  const vuAParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(supposé - (vuAParis - supposé));
}

/** Date du jour à Paris (AAAA-MM-JJ). */
export function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

export function ajouterJours(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = dimanche … 6 = samedi */
export function jourSemaine(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

export function ajouterMinutes(date: string, heure: string, minutes: number): { date: string; heure: string } {
  const [h, mi] = heure.split(":").map(Number);
  const total = h * 60 + mi + minutes;
  const jours = Math.floor(total / 1440), reste = ((total % 1440) + 1440) % 1440;
  return { date: ajouterJours(date, jours), heure: `${String(Math.floor(reste / 60)).padStart(2, "0")}:${String(reste % 60).padStart(2, "0")}` };
}

export function dateLongue(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function dateCourte(date: string): string {
  return date ? new Date(date + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—";
}
export function eur(x: number): string {
  return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
