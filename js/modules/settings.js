/* =====================================================================
   Module 6.7 — Administration & réglages
   ---------------------------------------------------------------------
   - Profil / organisation / rôle
   - Export comptable (période → CSV / Excel) + marquage "exportée"
   - Utilisateurs de l'organisation (lecture ; gestion via Supabase pour le MVP)
   - Journal d'audit (logs)
===================================================================== */
import { $, $$, setView, toast, dateFr, esc, busy, emptyState } from "../ui.js";
import { getProfil, deconnexion, supabase } from "../auth.js";
import { listerFactures, listerLogs, majStatutFacture } from "../store.js";
import { exporterCSV, exporterExcel, exporterSAP, getParamsSAP, setParamsSAP } from "./export.js";

export async function render() {
  const p = getProfil();
  const estAdmin = p?.role === "admin";
  const moisDebut = new Date(); moisDebut.setDate(1);
  const isoDebut = moisDebut.toISOString().slice(0, 10);
  const isoFin = new Date().toISOString().slice(0, 10);

  setView(`
    <h1 class="page-title">Réglages</h1>

    <div class="card">
      <h3>Organisation</h3>
      <div class="detail-grid">
        <div><div class="dt">Nom</div><div class="dd">${esc(p?.org_nom || "—")}</div></div>
        <div><div class="dt">Votre rôle</div><div class="dd">${esc(p?.role || "—")}</div></div>
        <div><div class="dt">Compte</div><div class="dd">${esc(p?.user?.email || "—")}</div></div>
      </div>
    </div>

    <div class="card">
      <h3>Export comptable</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Exporte les factures <strong>validées/exportées</strong> de la période choisie.
        Format à valider avec votre expert-comptable (compatibilité Sage générique).
      </p>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="ex-debut">Du</label><input id="ex-debut" type="date" value="${isoDebut}" /></div>
        <div class="grow field"><label for="ex-fin">Au</label><input id="ex-fin" type="date" value="${isoFin}" /></div>
      </div>
      <div class="row wrap" style="gap:10px">
        <button id="ex-csv" class="btn btn-primary grow">⬇ CSV (Sage)</button>
        <button id="ex-xls" class="btn btn-secondary grow">⬇ Excel</button>
        <button id="ex-sap" class="btn btn-secondary grow">⬇ SAP (écritures FI)</button>
      </div>
      <label class="row" style="gap:8px;margin-top:12px;font-size:.85rem">
        <input id="ex-marquer" type="checkbox" style="width:auto" />
        Marquer les factures exportées comme « exportée »
      </label>
      <p id="ex-info" class="muted" style="font-size:.82rem"></p>
    </div>

    <div class="card">
      <h3>Paramètres comptables SAP</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Comptes utilisés pour générer les écritures FI (partie double). ⚠️ Le plan
        comptable, les codes société/TVA et le type de pièce dépendent de VOTRE
        configuration SAP — à valider avec votre intégrateur / expert-comptable.
        Ces réglages sont enregistrés sur cet appareil.
      </p>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="sap-societe">Code société (BUKRS)</label><input id="sap-societe" placeholder="Ex. CI01" /></div>
        <div class="grow field"><label for="sap-piece">Type de pièce (BLART)</label><input id="sap-piece" placeholder="KR" /></div>
      </div>
      <div class="field"><label for="sap-charge">Compte de charge / achats (débit)</label><input id="sap-charge" placeholder="Ex. 601000" /></div>
      <div class="field"><label for="sap-tva">Compte TVA déductible (débit)</label><input id="sap-tva" placeholder="Ex. 445660" /></div>
      <p class="muted" style="font-size:.8rem">Le compte crédit (fournisseur) provient du <strong>compte SAP de chaque fournisseur</strong> (fiche Fournisseurs).</p>
      <div class="field" style="max-width:200px"><label for="sap-codetva">Code TVA (MWSKZ)</label><input id="sap-codetva" placeholder="Ex. V1" /></div>
      <button id="sap-save" class="btn btn-primary btn-sm">Enregistrer les comptes</button>
    </div>

    ${estAdmin ? `<div class="card">
      <h3>Utilisateurs</h3>
      <div id="users"><span class="spinner dark"></span></div>
      <p class="muted" style="font-size:.8rem">L'ajout d'utilisateurs se fait via l'invitation Supabase (MVP).</p>
    </div>` : ""}

    <div class="card">
      <h3>Journal d'audit</h3>
      <div id="logs"><span class="spinner dark"></span></div>
    </div>

    <div class="center" style="margin-bottom:24px">
      <button id="btn-deconnexion" class="btn btn-danger">Se déconnecter</button>
    </div>
  `);

  // --- Export ---
  $("#ex-csv").onclick = (e) => lancerExport(e.currentTarget, "csv");
  $("#ex-xls").onclick = (e) => lancerExport(e.currentTarget, "xls");
  $("#ex-sap").onclick = (e) => lancerExport(e.currentTarget, "sap");

  // --- Paramètres comptables SAP ---
  const sap = getParamsSAP();
  $("#sap-societe").value = sap.societe;
  $("#sap-piece").value = sap.typePiece;
  $("#sap-charge").value = sap.compteCharge;
  $("#sap-tva").value = sap.compteTva;
  $("#sap-codetva").value = sap.codeTva;
  $("#sap-save").onclick = () => {
    setParamsSAP({
      societe: $("#sap-societe").value.trim(),
      typePiece: $("#sap-piece").value.trim() || "KR",
      compteCharge: $("#sap-charge").value.trim(),
      compteTva: $("#sap-tva").value.trim(),
      codeTva: $("#sap-codetva").value.trim(),
    });
    toast("Comptes SAP enregistrés.", "success");
  };

  // --- Utilisateurs (admin) ---
  if (estAdmin) chargerUsers();

  // --- Logs ---
  chargerLogs();

  $("#btn-deconnexion").onclick = async () => { await deconnexion(); location.reload(); };
}

async function lancerExport(btn, format) {
  const debut = $("#ex-debut").value;
  const fin = $("#ex-fin").value;
  busy(btn, true, "Préparation…");
  try {
    // On exporte les factures exploitables comptablement (validées/exportées).
    const toutes = await listerFactures({ debut, fin });
    const exportables = toutes.filter((f) => ["validee", "exportee"].includes(f.statut));
    if (!exportables.length) {
      busy(btn, false);
      $("#ex-info").textContent = "Aucune facture validée sur cette période.";
      return;
    }
    if (format === "csv") await exporterCSV(exportables);
    else if (format === "sap") await exporterSAP(exportables);
    else await exporterExcel(exportables);

    // Marquage optionnel "exportée".
    if ($("#ex-marquer").checked) {
      const aMarquer = exportables.filter((f) => f.statut === "validee");
      await Promise.all(aMarquer.map((f) => majStatutFacture(f.id, "exportee")));
      $("#ex-info").textContent = `${exportables.length} facture(s) exportée(s), ${aMarquer.length} marquée(s).`;
    } else {
      $("#ex-info").textContent = `${exportables.length} facture(s) exportée(s).`;
    }
    toast("Export généré.", "success");
  } catch (e) {
    toast(e.message || "Échec de l'export.", "error");
  } finally {
    busy(btn, false);
  }
}

async function chargerUsers() {
  const cible = $("#users");
  try {
    const { data, error } = await supabase.from("users").select("email, role, created_at").order("created_at");
    if (error) throw error;
    cible.innerHTML = (data || []).map((u) => `
      <div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)">
        <span>${esc(u.email || "—")}</span><span class="status status-validee">${esc(u.role)}</span>
      </div>`).join("") || `<p class="muted">Aucun utilisateur.</p>`;
  } catch (e) {
    cible.innerHTML = `<p class="muted">Indisponible : ${esc(e.message)}</p>`;
  }
}

async function chargerLogs() {
  const cible = $("#logs");
  try {
    const logs = await listerLogs(40);
    if (!logs.length) { cible.innerHTML = `<p class="muted">Aucune action enregistrée.</p>`; return; }
    cible.innerHTML = logs.map((l) => `
      <div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem">
        <span><strong>${esc(l.action)}</strong> <span class="muted">${esc(l.cible || "")}</span></span>
        <span class="muted">${dateFr(l.created_at)}</span>
      </div>`).join("");
  } catch (e) {
    cible.innerHTML = `<p class="muted">Indisponible : ${esc(e.message)}</p>`;
  }
}
