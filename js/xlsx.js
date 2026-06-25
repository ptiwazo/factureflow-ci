/* =====================================================================
   Générateur .xlsx minimal — SANS librairie (contrainte stack §3)
   ---------------------------------------------------------------------
   Produit un vrai classeur OOXML (.xlsx) en assemblant une archive ZIP
   « stored » (non compressée) à la main + CRC32. Suffisant pour Excel,
   LibreOffice et les outils de chargement SAP (Journal Upload).

   API :
     construireXlsx(nomFeuille, lignes) -> Uint8Array
     telechargerXlsx(nomFichier, nomFeuille, lignes)

   `lignes` : tableau de lignes ; chaque ligne est un tableau de cellules.
   Type de cellule déduit : `number` fini -> cellule numérique, sinon texte
   (inlineStr, ce qui préserve les zéros de tête des comptes/codes SAP).
===================================================================== */

/* ----------------------------- CRC32 ------------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* --------------------------- Utilitaires --------------------------- */
const enc = new TextEncoder();

// Échappement XML pour contenu d'élément (texte des cellules).
function escXml(v) {
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Retire les caractères de contrôle non autorisés en XML 1.0.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// Index de colonne (0-based) -> lettre Excel (A, B, …, AA, AB…).
function colLettre(i) {
  let s = "";
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/* ----------------------- Construction OOXML ------------------------ */
function feuilleXml(lignes) {
  const rowsXml = lignes.map((cells, r) => {
    const ref = r + 1;
    const cellsXml = cells.map((val, c) => {
      const adr = `${colLettre(c)}${ref}`;
      if (val == null || val === "") return ""; // cellule vide → omise
      if (typeof val === "number" && Number.isFinite(val)) {
        return `<c r="${adr}"><v>${val}</v></c>`;
      }
      return `<c r="${adr}" t="inlineStr"><is><t xml:space="preserve">${escXml(val)}</t></is></c>`;
    }).join("");
    return `<row r="${ref}">${cellsXml}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function fichiersClasseur(nomFeuille, lignes) {
  const nom = escXml(nomFeuille).slice(0, 31) || "Feuille1";
  return [
    ["[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nom}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", feuilleXml(lignes)],
  ];
}

/* --------------------------- ZIP « stored » ------------------------ */
// En-tête/écriture little-endian via DataView sur des Uint8Array.
function u16(n) { return [n & 0xff, (n >>> 8) & 0xff]; }
function u32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

export function construireXlsx(nomFeuille, lignes) {
  const fichiers = fichiersClasseur(nomFeuille, lignes).map(([nom, contenu]) => {
    const nameBytes = enc.encode(nom);
    const data = enc.encode(contenu);
    return { nameBytes, data, crc: crc32(data) };
  });

  const locales = [];   // chunks d'octets des en-têtes locaux + données
  const centrales = []; // chunks du répertoire central
  let offset = 0;

  for (const f of fichiers) {
    // En-tête de fichier local.
    const lh = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(f.crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(f.nameBytes.length), ...u16(0),
    ];
    locales.push(Uint8Array.from(lh), f.nameBytes, f.data);

    // Entrée du répertoire central (réutilise l'offset de l'en-tête local).
    const ch = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(f.crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(f.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ];
    centrales.push(Uint8Array.from(ch), f.nameBytes);

    offset += lh.length + f.nameBytes.length + f.data.length;
  }

  const tailleCentral = centrales.reduce((s, a) => s + a.length, 0);
  const eocd = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(fichiers.length), ...u16(fichiers.length),
    ...u32(tailleCentral), ...u32(offset), ...u16(0),
  ]);

  const morceaux = [...locales, ...centrales, eocd];
  const total = morceaux.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) { out.set(m, p); p += m.length; }
  return out;
}

export function telechargerXlsx(nomFichier, nomFeuille, lignes) {
  const bytes = construireXlsx(nomFeuille, lignes);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
