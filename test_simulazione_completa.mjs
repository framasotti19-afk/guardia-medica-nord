// Simulazione massiva: scenari casuali con tutti i 26 medici, su più mesi e più semi,
// verificando gli invarianti INV1-INV4 (CONTEXT.md §5) su OGNI singolo turno prodotto.
// È il test più importante del pacchetto: non verifica un caso puntuale, ma che il
// motore non violi mai le sue garanzie fondamentali qualunque combinazione di
// disponibilità gli venga data in pasto.
import { MEDICI, byId, dk, turniDelGiorno, elaboraSchema, normDispo, ripiegoPerLivello, SEDI5, MESI_DISPONIBILI } from './engine_test.mjs';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEMI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// tutti i mesi disponibili (agosto 2026 - novembre 2027): copre ogni combinazione di
// weekend/festivi/prefestivi presente nel calendario dell'app.
const IDX_MESI = MESI_DISPONIBILI.map((_, i) => i);

let checkCount = 0;
let violazioni = [];

function generaScenario(seed, anno, mese) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  const extras = {};
  for (let d = 1; d <= nGiorni; d++) if (chance(0.1)) extras[dk(anno, mese, d)] = { M: chance(0.5), P: chance(0.5) };

  const SEDI_MAGGIORI = ["Maniago", "Spilimbergo", "Meduno"];
  const dispo = {};
  MEDICI.forEach((m, idx) => {
    dispo[m.id] = {};
    const casa = pick(SEDI5);
    const altre = SEDI5.filter((s) => s !== casa);
    const nRip = 1 + Math.floor(rnd() * 3);
    const ripiego = []; const ripiegoLiv = {};
    for (let i = 0; i < nRip; i++) { const s = pick(altre); if (!ripiego.includes(s)) { ripiego.push(s); ripiegoLiv[s] = 1 + Math.floor(rnd() * 5); } }
    const piene2 = chance(0.2) ? pick(SEDI_MAGGIORI.filter((s) => s !== casa)) : null;

    for (let d = 1; d <= nGiorni; d++) {
      const info = turniDelGiorno(anno, mese, d, extras);
      info.turni.forEach((turno) => {
        const slotKey = `${info.key}|${turno.id}`;
        if (chance(0.3)) return; // giorno non compilato affatto (nessuna dichiarazione)
        if (turno.extra) {
          if (chance(0.3)) dispo[m.id][slotKey] = { piene: [casa], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false };
          return;
        }
        if (chance(0.2)) {
          dispo[m.id][slotKey] = { piene: [], pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: true, preferito: false, preferitoRip: false };
          return;
        }
        const piene = [casa]; const pieneLiv = { [casa]: 1 + Math.floor(rnd() * 5) };
        if (piene2) { piene.push(piene2); pieneLiv[piene2] = pieneLiv[casa]; } // pari livello: indifferenti
        dispo[m.id][slotKey] = {
          piene, pieneLiv, ripiego: [...ripiego], ripiegoLiv: { ...ripiegoLiv },
          no: false, preferito: chance(0.03), preferitoRip: chance(0.01),
        };
      });
    }
  });
  const extraOre = {};
  MEDICI.forEach((m) => { if (chance(0.15)) extraOre[m.id] = Math.floor((rnd() - 0.3) * 60); });
  return { dispo, extras, extraOre };
}

function verificaTurno(giorno, t, dispo, slotKeyBase) {
  if (!t) return;
  const slotKey = `${slotKeyBase}|${t.id}`;
  if (t.extra) {
    const mid = t.slots[0];
    checkCount++;
    if (mid) {
      const v = normDispo(dispo[mid]?.[slotKey]);
      if (v.no) violazioni.push(`g${giorno} ${t.label}: NO assegnato a extra (INV2)`);
      if (!v.piene.length) violazioni.push(`g${giorno} ${t.label}: extra senza disponibilità dichiarata (INV1)`);
    }
    return;
  }
  const fisSet = new Set(t.fis);
  t.slots.forEach((mid, si) => {
    checkCount++;
    if (!mid) return;
    const v = normDispo(dispo[mid]?.[slotKey]);
    if (v.no) violazioni.push(`g${giorno} ${t.label} ${SEDI5[si]}: NO esplicito presente in slots (INV2)`);
    if (fisSet.has(si)) {
      const site = SEDI5[si];
      if (!v.piene.includes(site) && !v.ripiego.includes(site)) violazioni.push(`g${giorno} ${t.label}: ${byId[mid]?.nome} fisico a ${site} senza averla dichiarata (INV1)`);
    } else {
      const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
      if (!presenteAltrove) violazioni.push(`g${giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
    }
  });
  checkCount++;
  if (t.slots[3] && !fisSet.has(3) && t.slots[3] !== t.slots[0]) {
    violazioni.push(`g${giorno} ${t.label}: Claut a distanza NON coperta da Maniago (INV4) — coperta da ${byId[t.slots[3]]?.nome}`);
  }
}

console.log("=== test_simulazione_completa — scenari randomici × mesi × semi ===\n");
let scenari = 0;
for (const seedBase of SEMI) {
  for (const idxMese of IDX_MESI) {
    const { anno, mese } = MESI_DISPONIBILI[idxMese];
    const { dispo, extras, extraOre } = generaScenario(seedBase * 1000 + idxMese, anno, mese);
    let schema;
    try {
      ({ schema } = elaboraSchema(dispo, extraOre, anno, mese, extras));
    } catch (e) {
      violazioni.push(`ECCEZIONE seme=${seedBase} mese=${anno}-${mese + 1}: ${e.message}`);
      continue;
    }
    schema.forEach((g) => g.turni.forEach((t) => verificaTurno(g.giorno, t, dispo, g.key)));
    scenari++;
  }
}

console.log(`Scenari elaborati: ${scenari} (${SEMI.length} semi × ${IDX_MESI.length} mesi)`);
console.log(`Check di invariante eseguiti: ${checkCount}`);

if (violazioni.length) {
  console.log(`\n❌ ${violazioni.length} VIOLAZIONI:`);
  violazioni.slice(0, 40).forEach((v) => console.log(" - " + v));
  if (violazioni.length > 40) console.log(`  ... e altre ${violazioni.length - 40}`);
  console.log(`\n❌ ${violazioni.length} FALLITI`);
  process.exit(1);
} else {
  console.log(`\n✅ TUTTI I TEST SUPERATI — 0 violazioni su ${checkCount} check`);
  process.exit(0);
}
