// Micro-harness condiviso dai file di test (Node.js puro, nessuna dipendenza esterna).
// Ogni file di test lo importa, dichiara i propri casi con suite.test(...), e chiude
// con suite.finish() che stampa l'esito e chiama process.exit(0/1) come da convenzione
// in CONTEXT.md sezione 8/12.
export function makeSuite(titolo) {
  const risultati = [];
  const suite = {
    test(nome, fn) {
      try {
        fn();
        risultati.push({ nome, ok: true });
      } catch (e) {
        risultati.push({ nome, ok: false, err: e.message });
      }
    },
    assert(cond, msg) {
      if (!cond) throw new Error(msg || "assertion fallita");
    },
    eq(a, b, msg) {
      if (a !== b) throw new Error(msg || `atteso ${JSON.stringify(b)}, ottenuto ${JSON.stringify(a)}`);
    },
    finish() {
      console.log(`\n=== ${titolo} ===`);
      risultati.forEach((r) => console.log(`${r.ok ? "✅" : "❌"} ${r.nome}${r.ok ? "" : " — " + r.err}`));
      const falliti = risultati.filter((r) => !r.ok);
      if (falliti.length) {
        console.log(`\n❌ ${falliti.length} FALLITI su ${risultati.length}`);
        process.exit(1);
      } else {
        console.log(`\n✅ TUTTI I TEST SUPERATI (${risultati.length}/${risultati.length})`);
        process.exit(0);
      }
    },
  };
  return suite;
}

// Costruisce uno slotKey per il turno NOTTURNO di un giorno feriale "semplice"
// (nessun turno diurno concorrente) del mese di test standard (agosto 2026).
// Giorni feriali senza G/festivita' in agosto 2026: 3,4,5,6,7,10,11,12,13,17,18,19,20,21,24,25,26,27,28,31
export const ANNO_TEST = 2026;
export const MESE_TEST = 7; // agosto (indice 7)
export const GIORNI_FERIALI_SEMPLICI = [3, 4, 5, 6, 7, 10, 11, 12, 13, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31];

export function dispoBase(MEDICI) {
  const d = {};
  MEDICI.forEach((m) => (d[m.id] = {}));
  return d;
}

export function turnoDisp(verde = [], blu = [], extra = {}) {
  return {
    verde, verdeLiv: extra.verdeLiv || {},
    blu, bluLiv: extra.bluLiv || {},
    no: !!extra.no, preferito: extra.preferito || null, // preferito: nome della sede verde preferita, o null
  };
}

// Ruoli "storici" (categoria + titolarità) dei 5 medici che, nella lista attuale, sono SENZA
// incarico di default (PRESSACCO, CERVESATO, DE CANDIDO, MERLINO, IENGO). Molti test isolano un
// confronto puro di categoria/debito/grad scegliendo deliberatamente coppie di determinati
// titolari della STESSA sede (così la titolarità universale, §3.1a, non decide la contesa su
// un'altra sede) — quando serve un secondo/terzo determinato oltre agli 8 nativi, si "resuscita"
// temporaneamente uno di questi 5 medici nel suo ruolo storico, preservandone id/nome/grad reali.
// Va applicato esplicitamente con comeStorico(lista, ...id): non altera MEDICI_DEFAULT.
export const RUOLO_STORICO = {
  10: { cat: "DET24", sedeContratto: "Spilimbergo" }, // PRESSACCO, grad57
  11: { cat: "DET38", sedeContratto: "Spilimbergo" }, // CERVESATO, grad63
  12: { cat: "DET24", sedeContratto: "Spilimbergo" }, // DE CANDIDO, grad83
  13: { cat: "DET12ASAP", sedeContratto: "Maniago" }, // MERLINO, grad105
  14: { cat: "DET38", sedeContratto: "Maniago" }, // IENGO, grad107
};
export function comeStorico(lista, ...ids) {
  return lista.map((m) => (ids.includes(m.id) ? { ...m, ...RUOLO_STORICO[m.id] } : m));
}
