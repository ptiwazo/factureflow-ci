/* =====================================================================
   Module 6.6 — Export comptable
   ---------------------------------------------------------------------
   Sans dépendance externe (contrainte stack §3) :
     - CSV (séparateur ';', BOM UTF-8) → ouvrable Excel & importable Sage*
     - Excel (.xls) via table HTML (ouverte nativement par Excel)
     - PDF récapitulatif via fenêtre d'impression (Enregistrer en PDF)
   * Le mapping exact des colonnes Sage dépend du paramétrage comptable :
     format générique fourni, à valider/adapter par l'expert-comptable.
===================================================================== */
import { fcfa, dateFr, esc } from "../ui.js";
import { journaliser } from "../store.js";

// En-têtes du relevé comptable.
const COLS = [
  "Date", "N° facture", "Fournisseur", "NCC", "RCCM",
  "Total HT", "Taux TVA", "Montant TVA", "Total TTC", "Devise", "Statut",
];

function lignesExport(factures) {
  return factures.map((f) => [
    f.date || "",
    f.numero || "",
    f.fournisseurs?.nom || "",
    f.fournisseurs?.ncc || "",
    f.fournisseurs?.rccm || "",
    Number(f.total_ht) || 0,
    Number(f.taux_tva) || 0,
    Number(f.montant_tva) || 0,
    Number(f.total_ttc) || 0,
    f.devise || "XOF",
    f.statut || "",
  ]);
}

function telecharger(contenu, nomFichier, mime) {
  const blob = new Blob([contenu], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function horodatage() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------- CSV ------------------------------- */
export async function exporterCSV(factures) {
  const sep = ";"; // séparateur FR (Excel/Sage en locale française)
  const echappe = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [COLS.join(sep), ...lignesExport(factures).map((r) => r.map(echappe).join(sep))];
  const contenu = "﻿" + lignes.join("\r\n"); // BOM pour Excel
  telecharger(contenu, `factureflow_${horodatage()}.csv`, "text/csv;charset=utf-8");
  await journaliser("export_csv", `${factures.length} factures`);
}

/* ------------------------------ Excel ------------------------------ */
// Table HTML enregistrée en .xls : Excel l'ouvre nativement (pas de lib).
export async function exporterExcel(factures) {
  const ths = COLS.map((c) => `<th>${esc(c)}</th>`).join("");
  const trs = lignesExport(factures).map((r) =>
    `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8" /></head>
    <body><table border="1"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
  telecharger("﻿" + html, `factureflow_${horodatage()}.xls`, "application/vnd.ms-excel");
  await journaliser("export_excel", `${factures.length} factures`);
}

/* --------------------------- PDF récap ----------------------------- */
// Ouvre une fenêtre imprimable ; l'utilisateur choisit « Enregistrer en PDF ».
function imprimer(titre, corpsHtml) {
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres pop-up pour générer le PDF."); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />
    <title>${esc(titre)}</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0F172A;padding:24px;}
      h1{color:#0F766E;margin:0 0 4px;} .muted{color:#64748B;font-size:.85rem;}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:.9rem;}
      th,td{border:1px solid #E2E8F0;padding:8px;text-align:right;} th{background:#ECFDF5;}
      th:first-child,td:first-child{text-align:left;}
      .tot{margin-top:16px;float:right;width:280px;}
      .tot div{display:flex;justify-content:space-between;padding:4px 0;}
      .tot .g{font-weight:700;border-top:1px solid #E2E8F0;padding-top:8px;}
      .foot{margin-top:60px;font-size:.75rem;color:#94A3B8;clear:both;}
      @media print{ .noprint{display:none;} }
    </style></head><body>${corpsHtml}
    <div class="foot">Document généré par FactureFlow CI le ${dateFr(new Date().toISOString())}.
      Les montants et la conformité fiscale restent à valider par un professionnel.</div>
    <button class="noprint" onclick="window.print()" style="margin-top:20px;padding:10px 16px">Imprimer / PDF</button>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// Récapitulatif d'une facture.
export async function exporterFacturePDF(f, lignes) {
  const fourn = f.fournisseurs || {};
  const rows = (lignes || []).map((l) => `<tr>
    <td>${esc(l.designation)}</td><td>${l.quantite}</td>
    <td>${fcfa(l.prix_unitaire, f.devise)}</td><td>${fcfa(l.montant_ht, f.devise)}</td></tr>`).join("");
  const corps = `
    <h1>Facture ${esc(f.numero || "")}</h1>
    <div class="muted">${esc(fourn.nom || "Fournisseur inconnu")}${fourn.ncc ? " · NCC " + esc(fourn.ncc) : ""}</div>
    <div class="muted">Date : ${dateFr(f.date)}${f.echeance ? " · Échéance : " + dateFr(f.echeance) : ""}</div>
    <table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Aucune ligne</td></tr>`}</tbody></table>
    <div class="tot">
      <div><span>Total HT</span><span>${fcfa(f.total_ht, f.devise)}</span></div>
      <div><span>TVA (${f.taux_tva}%)</span><span>${fcfa(f.montant_tva, f.devise)}</span></div>
      <div class="g"><span>Total TTC</span><span>${fcfa(f.total_ttc, f.devise)}</span></div>
    </div>`;
  imprimer(`Facture ${f.numero || ""}`, corps);
  await journaliser("export_pdf", `facture:${f.id}`);
}
