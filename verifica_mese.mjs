// verifica_mese.mjs — CONTROLLO SEMANTICO dell'export, al posto dell'hash fisso.
//
// L'hash `2c002077` valeva per UNA fixture congelata: diceva "i byte non sono cambiati".
// Con la regola nuova (voce 108) l'Excel dipende dallo schema, che dipende dai dati → un hash
// fisso non è più il metro. Questo script è il metro nuovo: verifica che lo SCHEMA di un mese
// rispetti gli INVARIANTI aziendali (le stesse proprietà che la simulazione 100k controlla su
// scenari casuali, qui applicate al TUO mese vero). Vale per QUALSIASI mese.
//
// USO:  node verifica_mese.mjs                      → esegue un autotest (mese sintetico valido + uno rotto)
//       node verifica_mese.mjs <store.json> <YYYY-M> → verifica il TUO mese (store esportato dall'app)
//
// Lo `store.json` è il blob che l'app salva su Supabase (colonna app_state.data). `store[mKey].schema`
// è lo schema del mese (mKey es. "2026-7" per agosto). Se passi solo lo store senza mKey, li controlla tutti.

import fs from "node:fs";
import { MEDICI_DEFAULT, setMediciGlobal, byId, elaboraSchema, dk } from "./engine_test.mjs";

const SEDI = ["Maniago", "Spilimbergo", "Meduno", "Claut", "Anduins"];

// Verifica gli invarianti su UNO schema (array di giorni {giorno, festivo, prefestivo, weekend, turni:[{id, slots[5], fis[]}]}).
export function verificaSchema(schema, etichetta = "") {
  const errori = [];
  const E = (giorno, turno, msg) => errori.push(`g${giorno} ${turno}: ${msg}`);

  for (const g of schema) {
    const haDiurno = g.turni.some((t) => t && t.id === "G");
    for (const t of g.turni) {
      const fis = new Set(t.fis);
      const nome = (i) => (t.slots[i] != null ? (byId[t.slots[i]]?.nome || `id${t.slots[i]}`) : "·");

      // INV-1 (regola voce 108): Claut(3)/Anduins(4) non sono MAI sedi fisiche, in nessun turno.
      if (fis.has(3)) E(g.giorno, t.id, `Claut è FISICA (vietato dalla regola nuova): ${nome(3)}`);
      if (fis.has(4)) E(g.giorno, t.id, `Anduins è FISICA (vietato): ${nome(4)}`);

      // INV-2 (chiusura, invariata): nei NOTTURNI dei giorni CON diurno, Claut/Anduins devono essere VUOTE (servizio non attivo).
      if (haDiurno && t.id !== "G") {
        if (t.slots[3] != null) E(g.giorno, t.id, `Claut coperta in un notturno-con-diurno (deve essere "servizio non attivo"): ${nome(3)}`);
        if (t.slots[4] != null) E(g.giorno, t.id, `Anduins coperta in un notturno-con-diurno (deve essere "servizio non attivo"): ${nome(4)}`);
      }

      // INV-3: un medico occupa al massimo 1 sede FISICA nello stesso turno (nessun doppione fisico).
      const fisIds = [...fis].map((i) => t.slots[i]).filter((x) => x != null);
      const dup = fisIds.find((id, i) => fisIds.indexOf(id) !== i);
      if (dup != null) E(g.giorno, t.id, `${byId[dup]?.nome || dup} è fisico su due sedi nello stesso turno`);

      // INV-4: ogni copertura a distanza (slot pieno NON in fis) è fatta da un medico FISICAMENTE presente in quel turno,
      //        e rispetta il vincolo territoriale (Claut←Maniago; Anduins←Spilimbergo/Meduno).
      for (let si = 0; si < 5; si++) {
        if (t.slots[si] == null || fis.has(si)) continue; // vuota o fisica → non è a-distanza
        const mid = t.slots[si];
        const suaFisica = [...fis].find((fi) => t.slots[fi] === mid);
        if (suaFisica === undefined) { E(g.giorno, t.id, `${SEDI[si]} coperta a distanza da ${byId[mid]?.nome || mid}, che NON è fisico in questo turno`); continue; }
        if (si === 3 && suaFisica !== 0) E(g.giorno, t.id, `Claut coperta da ${SEDI[suaFisica]} (solo Maniago può, vincolo territoriale)`);
        if (si === 4 && !(suaFisica === 1 || suaFisica === 2)) E(g.giorno, t.id, `Anduins coperta da ${SEDI[suaFisica]} (solo Spilimbergo/Meduno possono)`);
      }

      // INV-5 (catena di copertura, lato FISICO — ciò che il motore garantisce davvero): una sede FISICA
      //        si apre solo se le CDC sopra hanno un CORPO. Meduno(2) FISICO ⟹ entrambe le CDC (0,1) fisiche.
      //        (La copertura a DISTANZA di Claut/Anduins è già governata dal vincolo territoriale, INV-4:
      //         Claut esige il fisico di Maniago, Anduins quello di Spilimbergo/Meduno — non serve Meduno.)
      if (fis.has(2) && !(fis.has(0) && fis.has(1)))
        E(g.giorno, t.id, `Meduno è FISICA con una CDC scoperta (catena violata)`);
    }
  }
  return errori;
}

function report(nome, errori) {
  if (errori.length === 0) { console.log(`✅ ${nome}: tutti gli invarianti rispettati`); return true; }
  console.log(`❌ ${nome}: ${errori.length} violazioni`);
  errori.slice(0, 30).forEach((e) => console.log("   ·", e));
  if (errori.length > 30) console.log(`   … e altre ${errori.length - 30}`);
  return false;
}

// ---- MODALITÀ FILE: verifica il mese vero ----
const [fileArg, mKeyArg] = process.argv.slice(2);
if (fileArg) {
  const store = JSON.parse(fs.readFileSync(fileArg, "utf8"));
  if (Array.isArray(store.medici)) setMediciGlobal(store.medici); // usa il roster del coordinatore se presente
  const keys = mKeyArg ? [mKeyArg] : Object.keys(store).filter((k) => /^\d{4}-\d+$/.test(k) && store[k]?.schema);
  if (!keys.length) { console.log("Nessuno schema trovato nello store (chiavi tipo \"2026-7\" con .schema)."); process.exit(2); }
  let ok = true;
  for (const k of keys) ok = report(`mese ${k}`, verificaSchema(store[k].schema, k)) && ok;
  process.exit(ok ? 0 : 1);
}

// ---- MODALITÀ AUTOTEST (senza argomenti): dimostra che PASSA sul valido e PRENDE il rotto ----
setMediciGlobal(MEDICI_DEFAULT);
const ANNO = 2026, MESE = 7;
const { turniDelGiorno } = await import("./engine_test.mjs");
const dispo = {};
for (const m of MEDICI_DEFAULT) dispo[m.id] = {};
const set = (id, g, tid, verde, blu = []) => { dispo[id][`${dk(ANNO, MESE, g)}|${tid}`] = { verde, blu, verdeLiv: Object.fromEntries(verde.map((s) => [s, 1])), bluLiv: Object.fromEntries(blu.map((s) => [s, 1])) }; };
const nG = new Date(ANNO, MESE + 1, 0).getDate();
for (let g = 1; g <= nG; g++) for (const t of turniDelGiorno(ANNO, MESE, g, {}).turni) {
  set(1, g, t.id, ["Maniago"], ["Claut"]); set(6, g, t.id, ["Spilimbergo"], ["Anduins"]); set(3, g, t.id, ["Meduno"]);
  if (t.id === "G") { set(10, g, t.id, ["Claut"], ["Claut"]); set(11, g, t.id, ["Anduins"], ["Anduins"]); }
}
const { schema } = elaboraSchema(dispo, {}, ANNO, MESE, {}, {});
const okValido = report("AUTOTEST mese valido (motore reale)", verificaSchema(schema));

// mese ROTTO: forzo Claut fisica in un diurno (viola INV-1) e Anduins coperta in un notturno-con-diurno (viola INV-2)
const rotto = JSON.parse(JSON.stringify(schema));
for (const g of rotto) for (const t of g.turni) {
  if (t.id === "G") { t.fis = [...new Set([...t.fis, 3])]; t.slots[3] = 1; }      // Claut fisica di giorno → vietato
  const haD = g.turni.some((x) => x.id === "G");
  if (haD && t.id === "N") t.slots[4] = 6;                                          // Anduins "coperta" di notte con diurno → vietato
}
const okRotto = report("AUTOTEST mese ROTTO (deve fallire)", verificaSchema(rotto));
console.log(`\nesito autotest: valido=${okValido ? "PASS" : "FAIL"} · rotto-rilevato=${okRotto ? "FAIL(non ha visto il rotto!)" : "PASS"}`);
process.exit(okValido && !okRotto ? 0 : 1);
