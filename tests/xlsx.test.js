/* Tests du générateur .xlsx natif (js/xlsx.js → construireXlsx).
   Vérifie la structure ZIP (signatures), l'encodage des cellules texte/nombre
   et l'échappement XML. Les entrées sont « stored » (non compressées), donc le
   contenu XML apparaît littéralement dans les octets de sortie. */
import { construireXlsx } from "../js/xlsx.js";

const bytes = construireXlsx("Journal", [
  ["Nom", "Montant"],
  ["A & B <x>", 4414000],
  ["Ligne 2", 1000000.5],
]);
const buf = Buffer.from(bytes);
const txt = buf.toString("latin1"); // recherche d'octets littéraux

test("renvoie un Uint8Array non vide", () => {
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.length).toBeGreaterThan(100);
});

test("signature ZIP en tête (PK\\x03\\x04)", () => {
  expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test("contient l'End Of Central Directory (PK\\x05\\x06)", () => {
  expect(txt.includes("PK\x05\x06")).toBe(true);
});

test("contient les parties OOXML essentielles", () => {
  expect(txt).toContain("[Content_Types].xml");
  expect(txt).toContain("xl/worksheets/sheet1.xml");
  expect(txt).toContain("xl/workbook.xml");
});

test("nom de feuille appliqué", () => {
  expect(txt).toContain('name="Journal"');
});

test("cellule texte en inlineStr avec échappement XML", () => {
  expect(txt).toContain('t="inlineStr"');
  expect(txt).toContain("A &amp; B &lt;x&gt;"); // & < > échappés
});

test("cellule numérique encodée en <v>", () => {
  expect(txt).toContain("<v>4414000</v>");
  expect(txt).toContain("<v>1000000.5</v>");
});

test("deux classeurs identiques → octets identiques (déterministe)", () => {
  const a = construireXlsx("S", [["x", 1]]);
  const b = construireXlsx("S", [["x", 1]]);
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
});
