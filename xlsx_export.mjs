// xlsx_export.mjs — MIRROR Node dell'export .XLSX, GENERATO da turni-guardia-medica.jsx via regen_xlsx_export.mjs.
// NON modificare a mano: la sorgente è il jsx (buildSheetModel/buildSheetXML inline). Qui le var di closure
// (store, notaSlot, byId, GIORNI_IT, MESI_BREVI, MESI_IT) sono iniettate via ctx. Serve al byte-test Node.
  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const enc = new TextEncoder();

  // CRC32
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  // ZIP con entry non compresse (STORED) → xlsx standard
  const zipStore = (files) => {
    const chunks = [], central = [];
    let offset = 0;
    const u16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);
    const u32 = (n) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]);
    files.forEach(({ name, data }) => {
      const nameB = enc.encode(name);
      const crc = crc32(data);
      const local = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB, data];
      const localLen = local.reduce((a, b) => a + b.length, 0);
      central.push({ nameB, crc, size: data.length, offset });
      local.forEach((b) => chunks.push(b));
      offset += localLen;
    });
    const cdStart = offset;
    central.forEach(({ nameB, crc, size, offset: off }) => {
      [u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nameB].forEach((b) => chunks.push(b));
    });
    const cdLen = chunks.reduce((a, b) => a + b.length, 0) - cdStart;
    [u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(cdStart), u16(0)].forEach((b) => chunks.push(b));
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    chunks.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  };

  const colLetter = (n) => { let s = ""; n++; while (n) { s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s; n = Math.floor((n - 1) / 26); } return s; };

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="14">
<font><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="8"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF8A3A00"/><name val="Calibri"/></font>
<font><b/><sz val="7.5"/><color rgb="FF1A5C4A"/><name val="Calibri"/></font>
<font><sz val="8.5"/><name val="Calibri"/></font>
<font><i/><sz val="8"/><color rgb="FF5B5F59"/><name val="Calibri"/></font>
<font><b/><sz val="8.5"/><color rgb="FFB03030"/><name val="Calibri"/></font>
<font><sz val="8.5"/><color rgb="FF666666"/><name val="Calibri"/></font>
<font><i/><sz val="9"/><color rgb="FF666666"/><name val="Calibri"/></font>
<font><b/><sz val="8.5"/><name val="Calibri"/></font>
<font><sz val="9"/><name val="Calibri"/></font>
<font><sz val="9"/><color rgb="FF666666"/><name val="Calibri"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6DC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE5D6"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0F2EE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3F2EC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFA6A6A6"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="21">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="8" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
<xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="10" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="12" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="12" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="13" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="11" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;
  // indici stile: 1=sAgg 2=sHead 3=sHeadF 4=sDate 5=sTurno 6=sTurnoF 7=sTurnoX 8=sSede 9=sCell 10=sCov 11=sScop 12=sB 13=sScopSec 14=sNonAttiva(grigio) 15=sMedunoPriorita(neutro) 16-20=varianti SMALL di 8/9/10/13/14 (righe Claut/Anduins)

export function buildSheetModel(mKey, ctx) {
  const { store, notaSlot, byId, GIORNI_IT, MESI_BREVI } = ctx;
    const [y, m] = mKey.split("-").map(Number);
    const d = store[mKey];
    if (!d?.schema) return null;
    const cols = [];
    d.schema.forEach((g) => g.turni.forEach((t, ti) => cols.push({ g, t, prima: ti === 0, span: g.turni.length })));
    const oggi = new Date();
    const agg = `aggiornato al ${String(oggi.getDate()).padStart(2, "0")}.${String(oggi.getMonth() + 1).padStart(2, "0")}.${oggi.getFullYear()}`;

    // MODEL condiviso Excel↔PDF: righe [{ r, ht, cells:[{c,testo,stile,vuota}] }]. C = cella con testo, CV = cella vuota (ex cellV).
    const rowsModel = [];
    const merges = [];
    const C = (c, testo, stile) => ({ c, testo, stile, vuota: false });
    const CV = (c, stile) => ({ c, testo: null, stile, vuota: true });

    // R1 giorni settimana
    const cR1 = [C(0, agg, 1)];
    let ci = 1;
    let i = 0;
    while (i < cols.length) {
      const c = cols[i];
      const fest = c.g.festivo || c.g.prefestivo;
      cR1.push(C(ci, GIORNI_IT[c.g.dow], fest ? 3 : 2));
      if (c.span > 1) {
        merges.push(`${colLetter(ci)}1:${colLetter(ci + c.span - 1)}1`);
        for (let k = 1; k < c.span; k++) cR1.push(CV(ci + k, fest ? 3 : 2));
      }
      ci += c.span;
      i += c.span;
    }
    rowsModel.push({ r: 1, ht: 30, cells: cR1 });

    // R2 date
    const cR2 = [CV(0, 12)];
    cols.forEach(({ g }, k) => { cR2.push(C(k + 1, `${String(g.giorno).padStart(2, "0")}-${MESI_BREVI[m]}`, 4)); });
    rowsModel.push({ r: 2, ht: 15, cells: cR2 });

    // R3 turni — etichette adattate solo per l'export (la griglia a schermo usa t.label invariato):
    // il diurno feriale/weekend "semplice" perde l'orario "8-20" (resta "DIURNO"), prefestivo e
    // superfestivo restano con l'orario completo; le colonne MMG mattina/pomeriggio diventano
    // "ANTICIPO DIURNO MMG e PLS 8-14" / "...14-20".
    const ETICHETTE_EXPORT = {
      "DIURNO 8-20": "DIURNO",
      "MATTINA MMG 8-14": "ANTICIPO DIURNO MMG e PLS 8-14",
      "POMERIGGIO MMG 14-20": "ANTICIPO DIURNO MMG e PLS 14-20",
    };
    const cR3 = [CV(0, 12)];
    cols.forEach(({ t }, k) => {
      const st = t.extra ? 7 : (t.label.includes("SUPER") || t.label.includes("PREFESTIVO")) ? 6 : 5;
      cR3.push(C(k + 1, ETICHETTE_EXPORT[t.label] || t.label, st));
    });
    rowsModel.push({ r: 3, ht: 34, cells: cR3 });

    // Sedi
    const SEDI_EXPORT = ["SPILIMBERGO", "MANIAGO", "MEDUNO", "CLAUT", "ANDUINS"];
    const mapIdx = { MANIAGO: 0, SPILIMBERGO: 1, MEDUNO: 2, CLAUT: 3, ANDUINS: 4 };
    // Claut e Anduins (sedi minori) pesano meno anche visivamente: riga più bassa e font più piccolo
    // per TUTTA la riga (§10). `small()` rimappa gli stili che compaiono in quelle righe alle loro
    // varianti sz7 (16-20); gli altri stili restano invariati. Additivo, preesistenti byte-identici.
    const SMALL_MAP = { 8: 16, 9: 17, 10: 18, 13: 19, 14: 20 };
    SEDI_EXPORT.forEach((sede, ri) => {
      const r = 4 + ri;
      const isSmall = sede === "CLAUT" || sede === "ANDUINS";
      const st = (s) => (isSmall ? (SMALL_MAP[s] ?? s) : s);
      const cRow = [C(0, sede, st(8))];
      cols.forEach(({ t, g }, k) => {
        // Notturno/MMG: Claut e Anduins NON sono sedi fisiche (§10 voce 55). Ma "servizio non attivo"
        // (grigio, stile 14) va scritto SOLO nei giorni che hanno ANCHE il diurno — sabato/domenica
        // sera, festivi, prefestivi (§10 voce 30: esistenza del turno "G", stesso predicato del motore
        // così non divergono). Nei feriali normali quelle sedi non hanno mai un servizio da attivare →
        // cella BIANCA vuota, niente scritta. Meduno resta fisica ovunque, il diurno ha tutte e 5 le
        // sedi. Se la sede È coperta a distanza (slot pieno) si passa dal ramo copertura, invariato.
        const treFisiche = t.id === "N" || !!t.extra;
        const haDiurno = g.turni.some((x) => x && x.id === "G");
        // CHIUSA (regola aziendale ASFO, §10 voce 94): nei notturni/MMG dei giorni CON diurno (sab/dom/
        // festivi/prefestivi) Claut e Anduins sono CHIUSE — servizio non attivo, nemmeno a distanza. Lì
        // di giorno hanno già avuto il loro servizio fisico. Un documento ufficiale non deve MAI dichiarare
        // aperto un servizio chiuso: si scrive SEMPRE "servizio non attivo" (grigio, stile 14), qualunque
        // cosa dica lo schema (anche se il motore, che resta intatto, avesse segnato una copertura a
        // distanza da una dichiarazione blu inerte). Stesso predicato del motore (esistenza di "G", voce 30).
        const chiusa = treFisiche && (sede === "CLAUT" || sede === "ANDUINS") && haDiurno;
        // CRITERIO GENERALE (§10 voce 95): una cella scoperta si segnala "scoperto" SOLO se quella sede
        // può davvero aprirsi; se una sede SOPRA la blocca (catena §3.2/voce 90), resta BIANCA — non è un
        // buco da riempire, è chiusa per conseguenza. "Coperta" = presidiata FISICAMENTE (`fis`): una CDC
        // coperta solo a distanza è "spenta" e non apre nulla sotto (voce 90), quindi si usa `fis`, non lo
        // slot pieno — stessa semantica del motore, così non diverge.
        const cdcFis = t.fis.includes(0) && t.fis.includes(1); // Maniago & Spilimbergo presidiate (corpo)
        // testo/stile per una sede SECONDARIA scoperta:
        // - MEDUNO vuota → frase di priorità (stile 15) SOLO se una CDC è scoperta (Meduno bloccata); se le
        //   CDC sono presidiate ed è comunque vuota è un buco vero → "scoperto" (stile 13).
        // - CLAUT/ANDUINS vuote (diurno E notturno FERIALE; il notturno CON diurno è già preso sopra da
        //   `chiusa`) → "scoperto" (stile 13) SOLO se le due CDC {Maniago, Spilimbergo} sono presidiate
        //   FISICAMENTE (`cdcFis`, stesso discriminante che fa sparire la frase d'attesa di Meduno); se le
        //   CDC non sono entrambe coperte la catena le tiene chiuse → BIANCA (stile 9). Non serve che Meduno
        //   sia coperto: basta {Maniago, Spilimbergo}. La copertura a distanza (slot pieno) non passa di qui.
        const secScoperta = sede === "MEDUNO"
          ? (cdcFis ? { testo: "scoperto", stile: 13 } : { testo: "Assegnazione solo dopo inserimento medico su Spilimbergo e Maniago", stile: 15 })
          : ((sede === "CLAUT" || sede === "ANDUINS")
              ? (cdcFis ? { testo: "scoperto", stile: 13 } : { testo: "", stile: 9 })
              : { testo: "scoperto", stile: 13 });
        let testo = "", stile = 9;
        if (chiusa) {
          testo = "servizio non attivo"; stile = 14; // (voce 94) sempre chiuso, qualunque cosa dica lo schema
        } else if (!t.slots.some(Boolean)) {
          if (sede === "MANIAGO" || sede === "SPILIMBERGO") { testo = "SCOPERTO"; stile = 11; }
          else ({ testo, stile } = secScoperta);
        } else {
          const si = mapIdx[sede];
          const mid = t.slots[si];
          if (mid) {
            const nota = notaSlot(t.slots, si, t.fis);
            if (nota.tipo === "copertura") { testo = nota.testo; stile = 10; }
            // La nota "*copre Claut/Anduins" non può più comparire sui notturni con diurno: con la chiusura
            // nel motore (voce 96) quelle sedi sono null lì, nessuno le copre → `notaSlot` non le elenca mai.
            else testo = byId[mid].nome + (nota.testo ? "\n" + nota.testo : "");
          } else if (sede === "MANIAGO" || sede === "SPILIMBERGO") {
            testo = "SCOPERTO"; stile = 11; // anche se un'altra sede del turno è coperta, Maniago/Spilimbergo scoperte vanno sempre segnalate in rosso
          } else {
            ({ testo, stile } = secScoperta); // Meduno/Claut/Anduins: "scoperto" oppure "servizio non attivo"
          }
        }
        cRow.push(C(k + 1, testo, st(stile)));
      });
      rowsModel.push({ r, ht: isSmall ? 28 : 42, cells: cRow });
    });
    // ---- Sezione REPERIBILITÀ (§10 voce 89): struttura fissa da compilare A MANO dopo l'export
    // (l'app non calcola nulla, lascia solo lo spazio con bordi/stile coerenti col foglio ASFO reale).
    // Riga 9: stacco vuoto (nessun bordo esplicito). Riga 10: intestazione "Reperibilità". Riga 11:
    // "Area 1" con celle giorno vuote e bordate. Etichette con lo stesso stile delle sedi (8).
    const cR9 = [CV(0, 0)];
    cols.forEach((_, k) => { cR9.push(CV(k + 1, 0)); });
    rowsModel.push({ r: 9, ht: 12, cells: cR9 });
    // "Reperibilità" è SOLO un'etichetta di sezione: la cella a sinistra con la scritta, niente
    // celle né griglia a destra (formato ASFO). Solo "Area 1" ha le celle vuote bordate da compilare.
    rowsModel.push({ r: 10, ht: 18, cells: [C(0, "Reperibilità", 8)] });
    const cR11 = [C(0, "Area 1", 8)];
    cols.forEach((_, k) => { cR11.push(CV(k + 1, 9)); });
    rowsModel.push({ r: 11, ht: 30, cells: cR11 });

    return { cols, rowsModel, merges };
  };
export function buildSheetXML(mKey, ctx) {
  const model = buildSheetModel(mKey, ctx);
  if (!model) return null;
  const { cols, rowsModel, merges } = model;
    const cell = (r, c, testo, stile) => `<c r="${colLetter(c)}${r}" s="${stile}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(testo)}</t></is></c>`;
    const cellV = (r, c, stile) => `<c r="${colLetter(c)}${r}" s="${stile}"/>`;
    let rows = "";
    for (const row of rowsModel) {
      let s = "";
      for (const cl of row.cells) s += cl.vuota ? cellV(row.r, cl.c, cl.stile) : cell(row.r, cl.c, cl.testo, cl.stile);
      rows += `<row r="${row.r}" ht="${row.ht}" customHeight="1">${s}</row>`;
    }
    const colsXML = `<cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="${cols.length + 1}" width="19" customWidth="1"/></cols>`;
    const mergeXML = merges.length ? `<mergeCells count="${merges.length}">${merges.map((mm) => `<mergeCell ref="${mm}"/>`).join("")}</mergeCells>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXML}<sheetData>${rows}</sheetData>${mergeXML}</worksheet>`;
}
export function buildXlsxBytes(keys, ctx) {
  const { store, MESI_IT, notaSlot, byId, GIORNI_IT, MESI_BREVI } = ctx;
      const fogli = [];
      keys.forEach((k) => {
        const xml = buildSheetXML(k, ctx);
        if (xml) {
          const [y, m] = k.split("-").map(Number);
          fogli.push({ nome: `${MESI_IT[m]} ${y}`, xml });
        }
      });
      if (!fogli.length) return null;

      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${fogli.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${fogli.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${fogli.map((f, i) => `<sheet name="${xmlEsc(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`;

      const files = [
        { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
        { name: "_rels/.rels", data: enc.encode(rels) },
        { name: "xl/workbook.xml", data: enc.encode(workbook) },
        { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRels) },
        { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
        ...fogli.map((f, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(f.xml) })),
      ];
      const zip = zipStore(files);
    return zip;
}
