// Simulazione massiva: scenari casuali con tutti i 26 medici, su più mesi e più semi,
// verificando gli invarianti (CONTEXT.md §5) su OGNI singolo turno prodotto.
// È il test più importante del pacchetto: non verifica un caso puntuale, ma che il
// motore non violi mai le sue garanzie fondamentali qualunque combinazione di
// disponibilità verde/blu e titolarità gli venga data in pasto.
import { MEDICI, MEDICI_DEFAULT, setMediciGlobal, byId, dk, turniDelGiorno, elaboraSchema, normDispo, ordinaPerLivello, MAX_LIV_VERDE, MAX_LIV_BLU, SEDI5, isDeterminato, MESI_DISPONIBILI } from './engine_test.mjs';

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

// Assegna titolarità casuali ad alcuni determinati, per esercitare anche quel percorso
// nella simulazione massiva (deterministico rispetto al seme).
function generaMediciConTitolarita(seed) {
  const rnd = mulberry32(seed);
  return MEDICI_DEFAULT.map((m) => {
    if (!isDeterminato(m.id) && m.cat !== "DET36" && m.cat !== "DET24") return { ...m };
    const haTitolarita = rnd() < 0.25;
    return { ...m, sedeContratto: haTitolarita ? (rnd() < 0.5 ? "Maniago" : "Spilimbergo") : null };
  });
}

function generaScenario(seed, anno, mese) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const nGiorni = new Date(anno, mese + 1, 0).getDate();
  const extras = {};
  for (let d = 1; d <= nGiorni; d++) if (chance(0.1)) extras[dk(anno, mese, d)] = { M: chance(0.5), P: chance(0.5) };

  const SEDI_MAGGIORI = ["Maniago", "Spilimbergo", "Meduno"];
  const dispo = {};
  MEDICI.forEach((m) => {
    dispo[m.id] = {};
    const casa = pick(SEDI5);
    const altre = SEDI5.filter((s) => s !== casa);
    const nBlu = 1 + Math.floor(rnd() * 3);
    const blu = []; const bluLiv = {};
    for (let i = 0; i < nBlu; i++) { const s = pick(altre); if (!blu.includes(s)) { blu.push(s); bluLiv[s] = 1 + Math.floor(rnd() * MAX_LIV_BLU); } }
    const verde2 = chance(0.2) ? pick(SEDI_MAGGIORI.filter((s) => s !== casa)) : null;

    for (let d = 1; d <= nGiorni; d++) {
      const info = turniDelGiorno(anno, mese, d, extras);
      info.turni.forEach((turno) => {
        const slotKey = `${info.key}|${turno.id}`;
        if (chance(0.3)) return; // giorno non compilato affatto (nessuna dichiarazione)
        if (turno.extra) {
          if (chance(0.3)) dispo[m.id][slotKey] = { verde: [casa], verdeLiv: {}, blu: [], bluLiv: {}, no: false, preferito: chance(0.03) ? casa : null };
          return;
        }
        if (chance(0.2)) {
          dispo[m.id][slotKey] = { verde: [], verdeLiv: {}, blu: [], bluLiv: {}, no: true, preferito: null };
          return;
        }
        const verde = [casa]; const verdeLiv = { [casa]: 1 + Math.floor(rnd() * MAX_LIV_VERDE) };
        if (verde2) { verde.push(verde2); verdeLiv[verde2] = verdeLiv[casa]; } // pari livello: indifferenti
        dispo[m.id][slotKey] = {
          verde, verdeLiv, blu: [...blu], bluLiv: { ...bluLiv },
          no: false, preferito: chance(0.03) ? pick(verde) : null,
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
      if (!v.verde.length) violazioni.push(`g${giorno} ${t.label}: extra senza disponibilità verde dichiarata (INV1)`);
    }
    return;
  }
  const fisSet = new Set(t.fis);
  const bluDaMedico = {}; // conteggio sedi coperte a distanza per medico, in questo turno
  t.slots.forEach((mid, si) => {
    checkCount++;
    if (!mid) return;
    const v = normDispo(dispo[mid]?.[slotKey]);
    if (v.no) violazioni.push(`g${giorno} ${t.label} ${SEDI5[si]}: NO esplicito presente in slots (INV2)`);
    if (fisSet.has(si)) {
      const site = SEDI5[si];
      if (!v.verde.includes(site)) violazioni.push(`g${giorno} ${t.label}: ${byId[mid]?.nome} fisico a ${site} senza averla dichiarata come verde (INV1)`);
    } else {
      // INV3: la copertura a distanza deve provenire da un fisico DI QUESTO turno
      const presenteAltrove = t.fis.some((fi) => t.slots[fi] === mid);
      if (!presenteAltrove) violazioni.push(`g${giorno} ${t.label} ${SEDI5[si]}: copertura a distanza da medico non fisico nel turno (INV3)`);
      // deve aver dichiarato quella sede come blu
      if (!v.blu.includes(SEDI5[si])) violazioni.push(`g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${SEDI5[si]} a distanza senza averla dichiarata come blu`);
      bluDaMedico[mid] = (bluDaMedico[mid] || 0) + 1;
    }
  });
  // REGOLA GENERALE: un medico copre al massimo 1 sede a distanza
  checkCount++;
  Object.entries(bluDaMedico).forEach(([mid, n]) => {
    if (n > 1) violazioni.push(`g${giorno} ${t.label}: ${byId[mid]?.nome} copre ${n} sedi a distanza, il massimo consentito è 1`);
  });
}

console.log("=== test_simulazione_completa — scenari randomici × mesi × semi (con titolarità) ===\n");
let scenari = 0;
for (const seedBase of SEMI) {
  setMediciGlobal(generaMediciConTitolarita(seedBase * 7919));
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
setMediciGlobal(MEDICI_DEFAULT);

console.log(`Scenari elaborati: ${scenari} (${SEMI.length} semi × ${IDX_MESI.length} mesi, titolarità casuali per seme)`);
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
