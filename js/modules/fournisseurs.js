/* =====================================================================
   Module 6.3 — Fournisseurs : liste, fiche, historique
   (Déduplication par NCC assurée côté store.trouverOuCreerFournisseur.)
===================================================================== */
import { $, setView, toast, fcfa, dateFr, esc, emptyState, statutBadge, nccValide, busy, infoPaiement } from "../ui.js";
import { listerFournisseurs, getFournisseur, listerFactures, majFournisseur, journaliser, upsertFournisseur, getOrganisationCourante } from "../store.js";
import { getProfil } from "../auth.js";
import { exporterReleveFournisseur, exporterReleveFournisseurExcel } from "./export.js";
import { navigate } from "../app.js";

export async function renderListe() {
  const peutEcrire = ["admin", "saisie"].includes(getProfil()?.role);
  setView(`
    <div class="row between">
      <h1 class="page-title">Fournisseurs</h1>
      ${peutEcrire ? `<div class="row" style="gap:8px">
        <button id="btn-modele" class="btn btn-ghost btn-sm">⬇ Modèle</button>
        <button id="btn-import" class="btn btn-secondary btn-sm">⬆ Importer Excel</button>
      </div>` : ""}
    </div>
    <input id="recherche" type="search" placeholder="Rechercher par nom ou NCC…" class="mb" />
    <div id="import-info"></div>
    <div id="liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
    <input id="import-input" type="file" accept=".xlsx,.xls,.csv" class="hidden" />
  `);

  if (peutEcrire) {
    const input = $("#import-input");
    $("#btn-import").onclick = () => input.click();
    input.addEventListener("change", () => { if (input.files[0]) importerExcel(input.files[0]); input.value = ""; });
    $("#btn-modele").onclick = (e) => telechargerModele(e.currentTarget);
  }

  let tous = [];
  try { tous = await listerFournisseurs(); }
  catch (e) { $("#liste").innerHTML = emptyState("⚠️", "Erreur", e.message); return; }

  const dessiner = (items) => {
    const cible = $("#liste");
    if (!items.length) {
      cible.innerHTML = emptyState("🏢", "Aucun fournisseur", "Les fournisseurs sont créés automatiquement lors de l'enregistrement des factures.");
      return;
    }
    cible.innerHTML = `<div class="list">${items.map((f) => `
      <a class="list-item" href="#/fournisseur/${f.id}">
        <div class="li-main">
          <div class="li-title">${esc(f.nom)}</div>
          <div class="li-sub">${f.ncc ? "NCC " + esc(f.ncc) : `<span style="color:var(--danger)">NCC manquant</span>`}${f.telephone ? " · " + esc(f.telephone) : ""}</div>
        </div>
        <span>›</span>
      </a>`).join("")}</div>`;
  };

  dessiner(tous);
  $("#recherche").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    dessiner(tous.filter((f) => (f.nom || "").toLowerCase().includes(q) || (f.ncc || "").toLowerCase().includes(q)));
  });
}

export async function renderDetail(id) {
  if (!id) return navigate("#/fournisseurs");
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);

  let f, factures;
  try {
    f = await getFournisseur(id);
    if (!f) { setView(emptyState("🔍", "Fournisseur introuvable")); return; }
    factures = await listerFactures({ fournisseurId: id });
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const exploit = factures.filter((x) => x.statut !== "non_conforme");
  let totalTtc = 0, totalPaye = 0, solde = 0;
  for (const x of exploit) {
    const ip = infoPaiement(x);
    totalTtc += Number(x.total_ttc) || 0; totalPaye += ip.paye; solde += ip.restant;
  }
  const peutEcrire = ["admin", "saisie"].includes(getProfil()?.role);
  let orgNcc = "", orgLogo = "";
  try { const o = await getOrganisationCourante(); orgNcc = o?.ncc || ""; orgLogo = o?.logo || ""; } catch { /* ignore */ }

  setView(`
    <a href="#/fournisseurs" class="btn btn-ghost btn-sm">← Fournisseurs</a>
    <h1 class="page-title">${esc(f.nom)}</h1>

    ${!f.ncc ? `<div class="alert alert-danger">⛔ NCC manquant — les factures de ce fournisseur sont marquées non conformes.</div>` : ""}

    <div class="card">
      <div class="field"><label for="e-nom">Nom</label><input id="e-nom" value="${esc(f.nom)}" ${peutEcrire ? "" : "disabled"} /></div>
      <div class="field ${f.ncc && !nccValide(f.ncc) ? "uncertain" : ""}">
        <label for="e-ncc">NCC</label><input id="e-ncc" value="${esc(f.ncc || "")}" ${peutEcrire ? "" : "disabled"} />
        <div class="uncertain-flag">⚠️ Format NCC inattendu — attendu : 7 chiffres + 1 lettre (ex. 9502363N)</div>
      </div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="e-rccm">RCCM</label><input id="e-rccm" value="${esc(f.rccm || "")}" ${peutEcrire ? "" : "disabled"} /></div>
        <div class="grow field"><label for="e-tel">Téléphone</label><input id="e-tel" value="${esc(f.telephone || "")}" ${peutEcrire ? "" : "disabled"} /></div>
      </div>
      <div class="field"><label for="e-sap">Compte SAP (CardCode)</label>
        <input id="e-sap" value="${esc(f.compte_sap || "")}" placeholder="Ex. F0001" ${peutEcrire ? "" : "disabled"} /></div>
      ${peutEcrire ? `<button id="btn-save" class="btn btn-primary btn-sm">Enregistrer</button>` : ""}
    </div>

    <div class="kpi-grid">
      <div class="kpi accent-teal"><div class="kpi-label">Total facturé</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(totalTtc)}</div></div>
      <div class="kpi"><div class="kpi-label">Payé</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(totalPaye)}</div></div>
      <div class="kpi accent-danger"><div class="kpi-label">Solde dû</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(solde)}</div></div>
    </div>

    <div class="card">
      <h3>Relevé</h3>
      <div class="row" style="gap:12px;align-items:flex-end">
        <div class="field" style="max-width:180px"><label for="rel-type">Contenu</label>
          <select id="rel-type"><option value="toutes">Toutes les factures</option><option value="nonsoldees">Non soldées</option></select></div>
        <div class="grow field"><label for="rel-debut">Du</label><input id="rel-debut" type="date" /></div>
        <div class="grow field"><label for="rel-fin">Au</label><input id="rel-fin" type="date" /></div>
      </div>
      <div class="row" style="gap:8px">
        <button id="btn-releve" class="btn btn-secondary btn-sm">📄 Relevé PDF</button>
        <button id="btn-releve-xls" class="btn btn-secondary btn-sm">⬇ Relevé Excel</button>
      </div>
    </div>

    <h2 class="section-title">Historique des factures</h2>
    <div class="list">
      ${factures.length ? factures.map((x) => `
        <a class="list-item" href="#/facture/${x.id}">
          <div class="li-main"><div class="li-title">${esc(x.numero || "sans n°")}</div>
            <div class="li-sub">${dateFr(x.date)} · ${statutBadge(x.statut)}</div></div>
          <div class="li-amount">${fcfa(x.total_ttc, x.devise)}</div>
        </a>`).join("") : emptyState("🧾", "Aucune facture")}
    </div>
  `);

  const opts = () => ({ type: $("#rel-type").value, debut: $("#rel-debut").value, fin: $("#rel-fin").value, orgNcc, logo: orgLogo });
  const br = $("#btn-releve");
  if (br) br.onclick = () => exporterReleveFournisseur(f, factures, opts());
  const brx = $("#btn-releve-xls");
  if (brx) brx.onclick = () => exporterReleveFournisseurExcel(f, factures, opts());

  const btn = $("#btn-save");
  if (btn) btn.onclick = async (e) => {
    busy(e.currentTarget, true);
    try {
      await majFournisseur(id, {
        nom: $("#e-nom").value.trim(),
        ncc: $("#e-ncc").value.trim() || null,
        rccm: $("#e-rccm").value.trim() || null,
        telephone: $("#e-tel").value.trim() || null,
        compte_sap: $("#e-sap").value.trim() || null,
      });
      await journaliser("maj_fournisseur", `fournisseur:${id}`);
      toast("Fournisseur mis à jour.", "success");
      renderDetail(id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };
}

/* ----------------------- Import Excel (xlsx/xls/csv) ---------------- */
// Normalise une clé d'en-tête : minuscule, sans accents, espaces compactés.
function normCle(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
}

// Correspondances acceptées pour chaque champ (tolérance sur les intitulés).
const COLONNES = {
  nom: ["nom", "raison sociale", "fournisseur", "name", "supplier", "cardname"],
  ncc: ["ncc", "numero compte contribuable", "n ccc", "tax id", "taxid", "compte contribuable"],
  rccm: ["rccm", "registre commerce"],
  telephone: ["telephone", "tel", "phone", "contact", "mobile"],
  compteSap: ["compte sap", "compte sap fournisseur", "cardcode", "card code", "code sap", "sap", "compte fournisseur"],
};

function mapLigne(row) {
  // row : objet { en-tête: valeur }. On indexe par clé normalisée.
  const index = {};
  for (const k of Object.keys(row)) index[normCle(k)] = row[k];
  const lire = (champ) => {
    for (const alias of COLONNES[champ]) if (index[alias] != null && String(index[alias]).trim() !== "") return String(index[alias]).trim();
    return "";
  };
  return { nom: lire("nom"), ncc: lire("ncc"), rccm: lire("rccm"), telephone: lire("telephone"), compteSap: lire("compteSap") };
}

// Télécharge un modèle Excel prêt à remplir (en-têtes reconnus + exemples).
async function telechargerModele(btn) {
  busy(btn, true, "Génération…");
  try {
    const mod = await import("https://esm.sh/xlsx@0.18.5");
    const XLSX = mod.read ? mod : (mod.default || mod);
    const donnees = [
      ["Nom", "NCC", "RCCM", "Téléphone", "Compte SAP"],
      ["Établissements Kouassi", "CC1234567A", "CI-ABJ-2020-B-12345", "+225 07 00 00 00 00", "F0001"],
      ["Société Diallo & Fils", "CC7654321B", "", "+225 05 11 22 33 44", "F0002"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(donnees);
    ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fournisseurs");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modele_fournisseurs.xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Modèle téléchargé.", "success");
  } catch (e) {
    toast("Génération du modèle impossible : " + (e.message || ""), "error");
  } finally {
    busy(btn, false);
  }
}

async function importerExcel(file) {
  const info = $("#import-info");
  info.innerHTML = `<div class="alert alert-info"><span class="spinner dark"></span> Lecture du fichier…</div>`;
  try {
    // Chargement à la demande de SheetJS (lecture xlsx/xls/csv).
    const mod = await import("https://esm.sh/xlsx@0.18.5");
    const XLSX = mod.read ? mod : (mod.default || mod); // export nommé ou default selon le CDN
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const feuille = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(feuille, { defval: "" });

    if (!rows.length) { info.innerHTML = `<div class="alert alert-warn">Fichier vide ou sans données.</div>`; return; }

    const lignes = rows.map(mapLigne).filter((l) => l.nom || l.ncc);
    if (!lignes.length) {
      info.innerHTML = `<div class="alert alert-danger">Aucune colonne reconnue. Attendu : Nom, NCC, RCCM, Téléphone, Compte SAP.</div>`;
      return;
    }

    let cree = 0, maj = 0, ignore = 0, erreurs = 0;
    for (const l of lignes) {
      try {
        const r = await upsertFournisseur(l);
        if (r.action === "cree") cree++;
        else if (r.action === "maj") maj++;
        else ignore++;
      } catch { erreurs++; }
    }

    await journaliser("import_fournisseurs", `${lignes.length} lignes`);
    info.innerHTML = `<div class="alert alert-info">✅ Import terminé : <strong>${cree}</strong> créé(s),
      <strong>${maj}</strong> mis à jour, ${ignore} ignoré(s)${erreurs ? `, <strong style="color:var(--danger)">${erreurs} erreur(s)</strong>` : ""}.</div>`;
    toast("Import des fournisseurs terminé.", "success");

    // Rafraîchit la liste.
    const tous = await listerFournisseurs();
    const cible = $("#liste");
    cible.innerHTML = `<div class="list">${tous.map((f) => `
      <a class="list-item" href="#/fournisseur/${f.id}">
        <div class="li-main"><div class="li-title">${esc(f.nom)}</div>
          <div class="li-sub">${f.ncc ? "NCC " + esc(f.ncc) : `<span style="color:var(--danger)">NCC manquant</span>`}${f.compte_sap ? " · SAP " + esc(f.compte_sap) : ""}</div></div>
        <span>›</span></a>`).join("")}</div>`;
  } catch (e) {
    info.innerHTML = `<div class="alert alert-danger">⚠️ Import impossible : ${esc(e.message || "fichier illisible")}.</div>`;
  }
}
