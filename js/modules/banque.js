/* =====================================================================
   Module — Rapprochement bancaire (lettrage)
   ---------------------------------------------------------------------
   Importe un relevé bancaire (Excel/CSV), puis lettre chaque DÉBIT à une
   facture : cela enregistre le paiement (via le système de règlement) et
   marque l'opération « rapprochée ». Réversible (délettrage).
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, emptyState, busy, toNumber, infoPaiement } from "../ui.js";
import {
  listerOperations, creerOperations, supprimerOperation, rapprocherOperation, delettrerOperation,
  listerFactures,
} from "../store.js";
import { getProfil } from "../auth.js";

const peutEcrire = () => ["admin", "saisie", "controle_gestion"].includes(getProfil()?.role);

export async function render() {
  setView(`
    <div class="row between">
      <h1 class="page-title">Rapprochement bancaire</h1>
      ${peutEcrire() ? `<div class="row" style="gap:8px">
        <button id="bk-modele" class="btn btn-ghost btn-sm">⬇ Modèle</button>
        <button id="bk-import" class="btn btn-secondary btn-sm">⬆ Importer relevé</button>
      </div>` : ""}
    </div>
    <p class="muted" style="margin-top:-10px;font-size:.85rem">Lettrez chaque débit à une facture : le paiement est enregistré automatiquement.</p>
    <div id="bk-info"></div>
    <div id="bk-contenu"><div class="loading-block"><span class="spinner dark"></span></div></div>
    <input id="bk-file" type="file" accept=".xlsx,.xls,.csv" class="hidden" />
  `);

  if (peutEcrire()) {
    const input = $("#bk-file");
    $("#bk-import").onclick = () => input.click();
    input.addEventListener("change", () => { if (input.files[0]) importer(input.files[0]); input.value = ""; });
    $("#bk-modele").onclick = (e) => telechargerModele(e.currentTarget);
  }
  await dessiner();
}

async function dessiner() {
  const cible = $("#bk-contenu");
  let operations, factures;
  try { [operations, factures] = await Promise.all([listerOperations(), listerFactures()]); }
  catch (e) { cible.innerHTML = emptyState("⚠️", "Erreur", e.message); return; }

  const candidats = factures.filter((f) => f.statut !== "non_conforme")
    .map((f) => ({ f, ip: infoPaiement(f) })).filter((x) => x.ip.restant > 0.01);

  const aRappro = operations.filter((o) => o.sens === "debit" && !o.lettree);
  const rapprochees = operations.filter((o) => o.lettree);
  const credits = operations.filter((o) => o.sens === "credit" && !o.lettree).length;

  const optionsFor = (op) => {
    const arr = candidats.slice().sort((a, b) => Math.abs(a.ip.restant - op.montant) - Math.abs(b.ip.restant - op.montant));
    const exact = arr.find((x) => Math.abs(x.ip.restant - op.montant) < 0.01);
    return `<option value="">— Choisir une facture —</option>` + arr.map((x) => {
      const ex = Math.abs(x.ip.restant - op.montant) < 0.01;
      return `<option value="${esc(x.f.id)}"${exact && x.f.id === exact.f.id ? " selected" : ""}>${esc(x.f.fournisseurs?.nom || "—")} · ${esc(x.f.numero || "sans n°")} · reste ${fcfa(x.ip.restant, x.f.devise)}${ex ? " ✓" : ""}</option>`;
    }).join("");
  };

  cible.innerHTML = `
    <h2 class="section-title">À rapprocher (${aRappro.length})${credits ? ` <span class="muted" style="font-size:.7rem">· ${credits} crédit(s) importé(s)</span>` : ""}</h2>
    ${aRappro.length ? `<div class="list">${aRappro.map((op) => `
      <div class="list-item" style="flex-wrap:wrap;gap:8px">
        <div class="li-main"><div class="li-title">${fcfa(op.montant)} <span class="muted" style="font-weight:400">débit</span></div>
          <div class="li-sub">${dateFr(op.date)} · ${esc(op.libelle || "—")}</div></div>
        ${peutEcrire() ? `<div class="row" style="gap:6px;width:100%">
          <select class="op-cand" data-op="${esc(op.id)}" style="flex:1;min-width:0">${optionsFor(op)}</select>
          <button class="btn btn-primary btn-sm op-lettrer" data-op="${esc(op.id)}">Rapprocher</button>
          <button class="icon-btn op-suppr" data-op="${esc(op.id)}" style="color:var(--danger)" title="Supprimer">✕</button>
        </div>` : ""}
      </div>`).join("")}</div>`
      : emptyState("✅", "Rien à rapprocher", "Importez un relevé bancaire ou tout est lettré.")}

    ${rapprochees.length ? `<h2 class="section-title">Rapprochées (${rapprochees.length})</h2>
      <div class="list">${rapprochees.map((op) => `
        <div class="list-item">
          <div class="li-main"><div class="li-title">${fcfa(op.montant)} <span class="muted" style="font-weight:400">→ ${esc(op.factures?.fournisseurs?.nom || "facture")} ${esc(op.factures?.numero || "")}</span></div>
            <div class="li-sub">${dateFr(op.date)} · ${esc(op.libelle || "—")}</div></div>
          ${peutEcrire() ? `<button class="btn btn-ghost btn-sm op-delettrer" data-op="${esc(op.id)}">Délettrer</button>` : ""}
        </div>`).join("")}</div>` : ""}
    <div style="height:24px"></div>
  `;

  if (!peutEcrire()) return;
  $$(".op-lettrer").forEach((b) => b.onclick = async (e) => {
    const id = b.dataset.op;
    const sel = $(`.op-cand[data-op="${id}"]`);
    const factureId = sel?.value;
    if (!factureId) return toast("Choisissez une facture.", "warn");
    busy(e.currentTarget, true, "…");
    try { await rapprocherOperation(id, factureId); toast("Opération rapprochée — paiement enregistré.", "success"); dessiner(); }
    catch (err) { busy(e.currentTarget, false); toast(err.message || "Échec (période clôturée ?).", "error"); }
  });
  $$(".op-suppr").forEach((b) => b.onclick = async () => {
    if (!confirm("Supprimer cette opération du relevé ?")) return;
    try { await supprimerOperation(b.dataset.op); dessiner(); } catch (e) { toast(e.message, "error"); }
  });
  $$(".op-delettrer").forEach((b) => b.onclick = async (e) => {
    busy(e.currentTarget, true, "…");
    try { await delettrerOperation(b.dataset.op); toast("Opération délettrée (paiement annulé).", "info"); dessiner(); }
    catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  });
}

/* --------------------------- Import Excel -------------------------- */
function normCle(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
}
const COLS = {
  date: ["date", "date operation", "date valeur", "date comptable"],
  libelle: ["libelle", "description", "motif", "intitule", "operation", "nature"],
  debit: ["debit", "retrait", "sortie", "decaissement"],
  credit: ["credit", "versement", "entree", "encaissement"],
  montant: ["montant", "amount"],
  sens: ["sens", "type"],
  reference: ["reference", "ref", "piece", "numero"],
};
function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { let [, d, mo, y] = m; if (y.length === 2) y = "20" + y; return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return null;
}
function mapLigne(row) {
  const idx = {};
  for (const k of Object.keys(row)) idx[normCle(k)] = row[k];
  const lire = (c) => { for (const a of COLS[c]) if (idx[a] != null && String(idx[a]).trim() !== "") return idx[a]; return ""; };
  const debit = toNumber(lire("debit")), credit = toNumber(lire("credit")), montant = toNumber(lire("montant"));
  const sensTxt = normCle(lire("sens"));
  let sens, m;
  if (debit > 0) { sens = "debit"; m = debit; }
  else if (credit > 0) { sens = "credit"; m = credit; }
  else if (montant) { m = Math.abs(montant); sens = /cred/.test(sensTxt) ? "credit" : (/deb/.test(sensTxt) ? "debit" : (montant < 0 ? "debit" : "credit")); }
  else return null;
  return { date: parseDate(lire("date")), libelle: String(lire("libelle")).trim(), reference: String(lire("reference")).trim(), montant: m, sens };
}

async function telechargerModele(btn) {
  busy(btn, true, "Génération…");
  try {
    const mod = await import("https://esm.sh/xlsx@0.18.5");
    const XLSX = mod.read ? mod : (mod.default || mod);
    const donnees = [
      ["Date", "Libellé", "Débit", "Crédit", "Référence"],
      ["2026-06-05", "VIR FOURNISSEUR KOUASSI", "118000", "", "VIR001"],
      ["2026-06-08", "REMISE CHEQUE CLIENT", "", "250000", "REM045"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(donnees);
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relevé");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modele_releve_bancaire.xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Modèle téléchargé.", "success");
  } catch (e) { toast("Génération impossible : " + (e.message || ""), "error"); }
  finally { busy(btn, false); }
}

async function importer(file) {
  const info = $("#bk-info");
  info.innerHTML = `<div class="alert alert-info"><span class="spinner dark"></span> Lecture du relevé…</div>`;
  try {
    const mod = await import("https://esm.sh/xlsx@0.18.5");
    const XLSX = mod.read ? mod : (mod.default || mod);
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const ops = rows.map(mapLigne).filter(Boolean);
    if (!ops.length) {
      info.innerHTML = `<div class="alert alert-danger">Aucune opération reconnue. Colonnes attendues : Date, Libellé, Débit, Crédit, Référence.</div>`;
      return;
    }
    const n = await creerOperations(ops);
    info.innerHTML = `<div class="alert alert-info">✅ ${n} opération(s) importée(s).</div>`;
    toast("Relevé importé.", "success");
    dessiner();
  } catch (e) {
    info.innerHTML = `<div class="alert alert-danger">⚠️ Import impossible : ${esc(e.message || "fichier illisible")}.</div>`;
  }
}
