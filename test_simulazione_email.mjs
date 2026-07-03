// Simula un mese reale: 26 medici "ipotetici" che mandano le loro disponibilità
// (come se arrivassero via email), con NO, sedi verdi/blu a più livelli, preferiti,
// turni extra (M/P) e scenari a 1-5 medici presenti per notte. Elabora lo schema
// e verifica che il risultato sia coerente con le regole di CONTEXT.md:
// - nessuna violazione degli invarianti
// - nessuna eccezione durante l'elaborazione
// - stampa leggibile per controllo visivo "ha senso"
import {
  MEDICI, byId, CAT_INFO, SEDI5, SEDI_BREVI, dk, mk,
  turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU,
} from './engine_test.mjs';

// PRNG deterministico (mulberry32) per riproducibilità
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260802);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;

const ANNO = 2026, MESE = 7; // agosto 2026 (indice 7): weekend + FERRAGOSTO + prefestivi
const N_GIORNI = new Date(ANNO, MESE + 1, 0).getDate();

// Qualche turno extra (MMG mattina/pomeriggio) sparso nel mese, per testare anche
// il ramo turno.extra (assegnazione singola, senza scenario/distanza).
const extras = {};
[3, 10, 17, 24].forEach((d) => { extras[dk(ANNO, MESE, d)] = { M: true }; });
[6, 20].forEach((d) => { extras[dk(ANNO, MESE, d)] = { ...(extras[dk(ANNO, MESE, d)] || {}), P: true }; });

// ---- Genera disponibilità "via email" per ciascun medico ----
// Ogni medico ha una sede di casa (verde) e 1-2 sedi blu (copertura a distanza), con livelli.
// ~22% dei giorni sono NO (impegni personali). Un paio di preferiti sparsi nel mese.
const SEDI_MAGGIORI = ["Maniago", "Spilimbergo", "Meduno"];
const dispo = {};
MEDICI.forEach((m, idx) => {
  dispo[m.id] = {};
  const casa = SEDI_MAGGIORI[idx % 3];
  const altre = SEDI5.filter((s) => s !== casa);
  const blu1 = pick(altre);
  const blu2 = chance(0.5) ? pick(altre.filter((s) => s !== blu1)) : null;
  // un paio di medici dichiarano DUE sedi verdi a pari livello (indifferenti)
  const verde2 = chance(0.15) ? pick(SEDI_MAGGIORI.filter((s) => s !== casa)) : null;

  let preferitiDati = 0;
  for (let d = 1; d <= N_GIORNI; d++) {
    const info = turniDelGiorno(ANNO, MESE, d, extras);
    info.turni.forEach((turno) => {
      const slotKey = `${info.key}|${turno.id}`;
      if (turno.extra) {
        // disponibile ai turni extra solo se "vicino" (verde = casa) e non troppo spesso
        if (chance(0.35)) {
          dispo[m.id][slotKey] = { verde: [casa], verdeLiv: {}, blu: [], bluLiv: {}, no: false, preferito: false, preferitoRip: false };
        }
        return;
      }
      if (chance(0.22)) {
        // indisponibilità esplicita (impegno personale)
        dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: false, preferitoRip: false };
        return;
      }
      const verde = [casa];
      const verdeLiv = { [casa]: 1 };
      if (verde2) { verde.push(verde2); verdeLiv[verde2] = 1; } // pari livello = indifferente
      const blu = [blu1];
      const bluLiv = { [blu1]: 1 };
      if (blu2) { blu.push(blu2); bluLiv[blu2] = 2; }
      let preferito = false, preferitoRip = false;
      if (preferitiDati < 2 && chance(0.05)) {
        preferito = true;
        preferitiDati++;
        if (chance(0.3)) preferitoRip = true;
      }
      dispo[m.id][slotKey] = { verde, verdeLiv, blu, bluLiv, no: false, preferito, preferitoRip };
    });
  }
});

// una manciata di medici a debito extra (recupero ore mese precedente)
const extraOre = { 4: 12, 9: 6, 20: 18 };

console.log(`=== SIMULAZIONE: ${MESI_LABEL()} — ${MEDICI.length} medici, ${N_GIORNI} giorni ===\n`);
function MESI_LABEL() { return `agosto ${ANNO}`; }

let schema, avvisi;
try {
  ({ schema, avvisi } = elaboraSchema(dispo, extraOre, ANNO, MESE, extras));
} catch (e) {
  console.error("❌ ECCEZIONE durante elaboraSchema:", e);
  process.exit(1);
}

// ---- Verifica invarianti ----
let viol = [];
schema.forEach((g) => {
  g.turni.forEach((t) => {
    if (!t) return;
    const slotKey = `${g.key}|${t.id}`;
    if (t.extra) {
      const mid = t.slots[0];
      if (mid) {
        const v = normDispo(dispo[mid]?.[slotKey]);
        if (v.no) viol.push(`Giorno ${g.giorno} ${t.label}: medico NO assegnato a extra (INV2)`);
        if (!v.verde.length) viol.push(`Giorno ${g.giorno} ${t.label}: medico senza disponibilità verde assegnato a extra (INV1)`);
      }
      return;
    }
    const fisSet = new Set(t.fis);
    const bluDaMedico = {};
    t.slots.forEach((mid, si) => {
      if (!mid) return;
      const v = normDispo(dispo[mid]?.[slotKey]);
      if (v.no) viol.push(`Giorno ${g.giorno} ${t.label} ${SEDI5[si]}: medico con NO esplicito presente in slots (INV2)`);
      if (fisSet.has(si)) {
        const site = SEDI5[si];
        if (!v.verde.includes(site)) viol.push(`Giorno ${g.giorno} ${t.label}: ${byId[mid].nome} fisico a ${site} senza averla dichiarata come verde (INV1)`);
      } else {
        const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
        if (!presenteAltrove) viol.push(`Giorno ${g.giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
        if (!v.blu.includes(SEDI5[si])) viol.push(`Giorno ${g.giorno} ${t.label}: ${byId[mid].nome} copre ${SEDI5[si]} a distanza senza averla dichiarata come blu`);
        bluDaMedico[mid] = (bluDaMedico[mid] || 0) + 1;
      }
    });
    Object.entries(bluDaMedico).forEach(([mid, n]) => {
      if (n > 1) viol.push(`Giorno ${g.giorno} ${t.label}: ${byId[mid]?.nome} copre ${n} sedi a distanza (massimo 1 consentito)`);
    });
  });
});

if (viol.length) {
  console.log(`❌ ${viol.length} VIOLAZIONI DI INVARIANTI:`);
  viol.slice(0, 30).forEach((v) => console.log(" - " + v));
} else {
  console.log("✅ Nessuna violazione di invariante su tutto il mese.");
}

// ---- Stampa leggibile di una settimana (7-13 agosto, include weekend) per controllo visivo ----
console.log("\n=== Estratto schema (giorni 7-14 agosto) ===");
schema.filter((g) => g.giorno >= 7 && g.giorno <= 14).forEach((g) => {
  const tag = g.festivo ? ` [${g.festivo}]` : g.prefestivo ? " [prefestivo]" : g.weekend ? " [weekend]" : "";
  console.log(`\nGiorno ${g.giorno}${tag}`);
  g.turni.forEach((t) => {
    if (!t) return;
    const desc = t.extra
      ? `${t.label}: ${t.slots[0] ? byId[t.slots[0]].nome : "—"}`
      : `${t.label}: ` + SEDI5.map((s, i) => `${SEDI_BREVI[s]}=${t.slots[i] ? byId[t.slots[i]].nome : "—"}`).join(" ");
    console.log("  " + desc);
  });
});

// ---- Ferragosto (15 agosto): giorno festivo, controllo esplicito ----
const ferragosto = schema.find((g) => g.giorno === 15);
console.log(`\n=== Giorno 15 (FERRAGOSTO, festivo=${ferragosto.festivo}) ===`);
ferragosto.turni.forEach((t) => {
  console.log("  " + t.label + ": " + SEDI5.map((s, i) => `${SEDI_BREVI[s]}=${t.slots[i] ? byId[t.slots[i]].nome : "—"}`).join(" "));
});

// ---- Avvisi generati: conteggio e primi esempi ----
console.log(`\n=== Avvisi generati: ${avvisi.length} ===`);
avvisi.slice(0, 8).forEach((a) => console.log(" - " + a));

// ---- Sanity: quanti turni con candidati lasciano Maniago o Spilimbergo scoperte ----
// Nel modello verde/blu nessuna copertura è più automatica: questo NON è più un invariante
// assoluto come nel vecchio sistema, ma un dato informativo — atteso basso se la maggior parte
// dei medici dichiara verde su una CDC (come nella simulazione), non necessariamente zero.
let maSpScoperte = 0;
schema.forEach((g) => g.turni.forEach((t) => {
  if (!t || t.extra) return;
  if (t.fis.length === 0) return; // nessun candidato per quel turno, ok
  if (!t.slots[0] || !t.slots[1]) maSpScoperte++;
}));
console.log(`\nTurni con candidati ma MA/SP non coperte: ${maSpScoperte} (informativo — non più un invariante assoluto nel modello verde/blu dichiarativo)`);

// ---- Riepilogo ore assegnate e debito residuo per medico (sanity sul bilanciamento) ----
const oreAssegnate = {}; MEDICI.forEach((m) => (oreAssegnate[m.id] = 0));
schema.forEach((g) => g.turni.forEach((t) => {
  if (!t) return;
  if (t.extra) { if (t.slots[0]) oreAssegnate[t.slots[0]] += t.ore; return; }
  t.fis.forEach((si) => { const mid = t.slots[si]; if (mid) oreAssegnate[mid] += t.ore; });
}));
const debitiFinali = {};
MEDICI.forEach((m) => {
  const base = CAT_INFO[m.cat].ore;
  debitiFinali[m.id] = base === null ? null : base + (extraOre[m.id] || 0) - oreAssegnate[m.id];
});
console.log("\n=== Riepilogo ore/debito per medico (ordine gerarchia) ===");
[...MEDICI].sort((a, b) => CAT_INFO[a.cat].prio - CAT_INFO[b.cat].prio || a.grad - b.grad).forEach((m) => {
  const deb = debitiFinali[m.id];
  console.log(`  ${m.nome.padEnd(20)} ${m.cat.padEnd(6)} grad${String(m.grad).padEnd(4)} ore=${String(oreAssegnate[m.id]).padStart(3)}h  debito_residuo=${deb === null ? "n/a" : deb}`);
});

console.log(`\n${viol.length === 0 ? "✅ SIMULAZIONE COERENTE" : "❌ SIMULAZIONE CON PROBLEMI"}`);
process.exit(viol.length ? 1 : 0);
