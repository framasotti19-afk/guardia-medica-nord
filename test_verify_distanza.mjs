// Regressione rapida sulle coperture a distanza (CONTEXT.md 3.2), per accompagnare
// il fix del bug su Meduno (ME deve usare la priorità completa, non solo il grad).
import { MEDICI, byId, dk, elaboraSchema } from './engine_test.mjs';

const base = () => { const d = {}; MEDICI.forEach((m) => (d[m.id] = {})); return d; };
const N = (g) => `${dk(2026, 7, g)}|N`;
const disp = (p = []) => ({ piene: p, pieneLiv: {}, ripiego: [], ripiegoLiv: {}, no: false, preferito: false, preferitoRip: false });

let ok = 0, fail = 0;
const check = (nome, cond, dettaglio) => {
  if (cond) { ok++; console.log(`✅ ${nome}`); }
  else { fail++; console.log(`❌ ${nome} — ${dettaglio}`); }
};

// --- Caso 1: n=1 medico → "tutto il resto da lì" (Maniago) ---
{
  const dispo = base();
  dispo[3][N(3)] = disp(["Maniago"]); // TRIGODKO, unico presente
  const { schema } = elaboraSchema(dispo, {}, 2026, 7, {});
  const t = schema.find((g) => g.giorno === 3).turni.find((t) => t.id === "N");
  check("n=1: tutte le sedi coperte dall'unico medico", t.slots.every((s) => s === 3), t.slots.map((s) => s && byId[s].nome));
}

// --- Caso 2: Claut sempre da Maniago (mai da SP/ME/AN), anche con n=2 (MA+SP) ---
{
  const dispo = base();
  dispo[3][N(3)] = disp(["Maniago"]);      // TRIGODKO
  dispo[13][N(3)] = disp(["Spilimbergo"]); // ZURLO
  const { schema } = elaboraSchema(dispo, {}, 2026, 7, {});
  const t = schema.find((g) => g.giorno === 3).turni.find((t) => t.id === "N");
  check("Claut coperta da Maniago (n=2)", t.slots[3] === t.slots[0], t.slots.map((s) => s && byId[s].nome));
}

// --- Caso 3: Anduins usa il grad puro (non la priorità completa) tra SP e ME ---
// SP = ZURLO (SENZA, grad2, priorità bassa ma grad numerico migliore)
// ME("virtuale", coperta da MA) = TRIGODKO (DET36, grad4, priorità alta ma grad numerico peggiore)
// Attesa: AN segue il grad puro → ZURLO (grad2 < grad4), anche se TRIGODKO ha priorità gerarchica superiore.
{
  const dispo = base();
  dispo[3][N(3)] = disp(["Maniago"]);      // TRIGODKO copre anche ME per distanza (priorità superiore su ME)
  dispo[13][N(3)] = disp(["Spilimbergo"]); // ZURLO
  const { schema } = elaboraSchema(dispo, {}, 2026, 7, {});
  const t = schema.find((g) => g.giorno === 3).turni.find((t) => t.id === "N");
  // slots[2] (ME) atteso TRIGODKO (fix priorità), slots[4] (AN) atteso ZURLO (grad puro: SP vs ME -> grad2 < grad4)
  check("ME segue priorità completa (TRIGODKO)", t.slots[2] === 3, byId[t.slots[2]]?.nome);
  check("AN segue grad puro tra SP e ME (ZURLO, grad2 < grad4)", t.slots[4] === 13, byId[t.slots[4]]?.nome);
}

console.log(`\n${ok} OK, ${fail} falliti`);
process.exit(fail ? 1 : 0);
