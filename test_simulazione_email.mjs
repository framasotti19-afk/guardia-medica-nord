// Simula un mese reale: 26 medici "ipotetici" che mandano le loro disponibilità
// (come se arrivassero via email), con NO, ripieghi a più livelli, preferiti,
// turni extra (M/P) e scenari a 1-5 medici presenti per notte. Elabora lo schema
// e verifica che il risultato sia coerente con le regole di CONTEXT.md:
// - nessuna violazione degli invarianti INV1-INV4
// - nessuna eccezione durante l'elaborazione
// - stampa leggibile per controllo visivo "ha senso"
import {
  MEDICI, byId, CAT_INFO, SEDI5, SEDI_BREVI, dk, mk,
  turniDelGiorno, elaboraSchema, normDispo, ripiegoPerLivello,
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
// Ogni medico ha una sede di casa (piena) e 1-2 sedi di ripiego, con livelli.
// ~25% dei giorni sono NO (impegni personali). Un paio di preferiti sparsi nel mese.
const SEDI_MAGGIORI = ["Maniago", "Spilimbergo", "Meduno"];
const dispo = {};
MEDICI.forEach((m, idx) => {
  dispo[m.id] = {};
  const casa = SEDI_MAGGIORI[idx % 3];
  const altre = SEDI5.filter((s) => s !== casa);
  const ripiego1 = pick(altre);
  const ripiego2 = chance(0.5) ? pick(altre.filter((s) => s !== ripiego1)) : null;
  // un paio di medici dichiarano DUE sedi piene a pari livello (indifferenti)
  const piena2 = chance(0.15) ? pick(SEDI_MAGGIORI.filter((s) => s !== casa)) : null;

  let preferitiDati = 0;
  for (let d = 1; d <= N_GIORNI; d++) {
    const info = turniDelGiorno(ANNO, MESE, d, extras);
    info.turni.forEach((turno) => {
      const slotKey = `${info.key}|${turno.id}`;
      if (turno.extra) {
        // disponibile ai turni extra solo se "vicino" (piena = casa) e non troppo spesso
        if (chance(0.35)) {
          dispo[m.id][slotKey] = { piene: [casa], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false };
        }
        return;
      }
      if (chance(0.22)) {
        // indisponibilità esplicita (impegno personale)
        dispo[m.id][slotKey] = { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false };
        return;
      }
      const piene = [casa];
      const pieneLiv = { [casa]: 1 };
      if (piena2) { piene.push(piena2); pieneLiv[piena2] = 1; } // pari livello = indifferente
      const ripiego = [ripiego1];
      const ripiegoLiv = { [ripiego1]: 1 };
      if (ripiego2) { ripiego.push(ripiego2); ripiegoLiv[ripiego2] = 2; }
      let preferito = false, preferitoRip = false;
      if (preferitiDati < 2 && chance(0.05)) {
        preferito = true;
        preferitiDati++;
        if (chance(0.3)) preferitoRip = true;
      }
      dispo[m.id][slotKey] = { piene, pieneLiv, ripiego, ripiegoLiv, no: false, preferito, preferitoRip };
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

// ---- Verifica invarianti INV1-INV4 ----
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
        if (!v.piene.length) viol.push(`Giorno ${g.giorno} ${t.label}: medico senza disponibilità dichiarata assegnato a extra (INV1)`);
      }
      return;
    }
    const fisSet = new Set(t.fis);
    t.slots.forEach((mid, si) => {
      if (!mid) return;
      const v = normDispo(dispo[mid]?.[slotKey]);
      if (v.no) viol.push(`Giorno ${g.giorno} ${t.label} ${SEDI5[si]}: medico con NO esplicito presente in slots (INV2)`);
      if (fisSet.has(si)) {
        // presenza fisica: deve avere dichiarato quella sede (piena o ripiego)
        const site = SEDI5[si];
        const ok = v.piene.includes(site) || v.ripiego.includes(site);
        if (!ok) viol.push(`Giorno ${g.giorno} ${t.label}: ${byId[mid].nome} fisico a ${site} senza averla dichiarata (INV1)`);
      } else {
        // copertura a distanza: l'occupante deve essere fisico da qualche altra parte nello stesso turno
        if (!fisSet.has(t.slots.indexOf(mid))) {
          const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
          if (!presenteAltrove) viol.push(`Giorno ${g.giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
        }
      }
    });
    // INV4: Claut a distanza sempre da Maniago
    if (t.slots[3] && !fisSet.has(3)) {
      if (t.slots[3] !== t.slots[0]) viol.push(`Giorno ${g.giorno} ${t.label}: Claut a distanza NON coperta da Maniago (INV4) — coperta da ${byId[t.slots[3]]?.nome}`);
    }
  });
});

if (viol.length) {
  console.log(`❌ ${viol.length} VIOLAZIONI DI INVARIANTI:`);
  viol.slice(0, 30).forEach((v) => console.log(" - " + v));
} else {
  console.log("✅ Nessuna violazione INV1-INV4 su tutto il mese.");
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

// ---- Sanity aggiuntiva: nessun turno con candidati rimane con Maniago/Spilimbergo scoperte se c'era >=1 candidato ----
let maSpScoperte = 0;
schema.forEach((g) => g.turni.forEach((t) => {
  if (!t || t.extra) return;
  if (t.fis.length === 0) return; // nessun candidato per quel turno, ok
  if (!t.slots[0] || !t.slots[1]) maSpScoperte++;
}));
console.log(`\nTurni con candidati ma MA/SP non coperte: ${maSpScoperte} ${maSpScoperte === 0 ? "✅" : "❌ (atteso 0, MA/SP sono sempre prioritarie)"}`);

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
