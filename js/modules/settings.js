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
import { exporterCSV, exporterExcel, exporterSAP, exporterSAPJournalUpload, exporterSageEcritures, getParamsSAP, setParamsSAP, getParamsSage, setParamsSage } from "./export.js";
import { PLAN_COMPTABLE_IFRS, PLAN_PAR_SECTION, REGLES_CONTROLE } from "../comptes-charge-ifrs.js";

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
        <button id="ex-csv" class="btn btn-primary grow">⬇ CSV (tableur)</button>
        <button id="ex-xls" class="btn btn-secondary grow">⬇ Excel</button>
        <button id="ex-sage" class="btn btn-secondary grow">⬇ Sage (écritures)</button>
        <button id="ex-sap" class="btn btn-secondary grow">⬇ SAP (écritures FI)</button>
        <button id="ex-sap-ju" class="btn btn-secondary grow">⬇ SAP Journal Upload (.xlsx)</button>
      </div>
      <label class="row" style="gap:8px;margin-top:12px;font-size:.85rem">
        <input id="ex-marquer" type="checkbox" style="width:auto" />
        Marquer les factures exportées comme « exportée »
      </label>
      <p id="ex-info" class="muted" style="font-size:.82rem"></p>
    </div>

    <div class="card">
      <h3>Paramètres comptables Sage</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Pour l'export d'écritures Sage (partie double). Le compte de charge par
        ligne provient du mapping IFRS ci-dessous (repli sur le compte par défaut).
        ⚠️ Comptes (SYSCOHADA) et journal à valider avec votre expert-comptable.
      </p>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="sg-journal">Journal des achats</label><input id="sg-journal" placeholder="Ex. ACH" /></div>
        <div class="grow field"><label for="sg-charge">Compte de charge par défaut</label><input id="sg-charge" placeholder="Ex. 601000" /></div>
      </div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="sg-tva">Compte TVA déductible</label><input id="sg-tva" placeholder="Ex. 445200" /></div>
        <div class="grow field"><label for="sg-fourn">Compte fournisseur collectif</label><input id="sg-fourn" placeholder="Ex. 401000" /></div>
      </div>
      <button id="sg-save" class="btn btn-primary btn-sm">Enregistrer les comptes Sage</button>
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

    <div class="card">
      <h3>Plan comptable de référence (IFRS / OHADA)</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Référentiel officiel interne (contexte logistique / transport / transit, environnement SAP FI)
        utilisé pour classer les lignes de facture — le compte est proposé par l'IA d'après ce plan,
        puis ajustable à l'écran de vérification. ${PLAN_COMPTABLE_IFRS.length} comptes, regroupés par
        section. ⚠️ Imputations à valider par votre expert-comptable.
      </p>
      <input id="plan-search" type="search" placeholder="Rechercher (n° compte, libellé, nature…)" style="width:100%;margin-bottom:8px" autocomplete="off" />
      <div id="plan-liste">${renderPlan("")}</div>
      <details style="margin-top:14px">
        <summary style="cursor:pointer;font-weight:600;font-size:.9rem">Règles de contrôle interne SAP (${REGLES_CONTROLE.length})</summary>
        <div style="margin-top:8px">
          ${REGLES_CONTROLE.map((r) => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.82rem">
              <strong>${esc(r.regle)}</strong><br><span class="muted">${esc(r.description)}</span>
            </div>`).join("")}
        </div>
      </details>
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
  $("#ex-sage").onclick = (e) => lancerExport(e.currentTarget, "sage");
  $("#ex-sap").onclick = (e) => lancerExport(e.currentTarget, "sap");
  $("#ex-sap-ju").onclick = (e) => lancerExport(e.currentTarget, "sap_ju");

  // --- Paramètres comptables Sage ---
  const sage = getParamsSage();
  $("#sg-journal").value = sage.journalAchats;
  $("#sg-charge").value = sage.compteChargeDefaut;
  $("#sg-tva").value = sage.compteTva;
  $("#sg-fourn").value = sage.compteFournisseur;
  $("#sg-save").onclick = () => {
    setParamsSage({
      journalAchats: $("#sg-journal").value.trim() || "ACH",
      compteChargeDefaut: $("#sg-charge").value.trim(),
      compteTva: $("#sg-tva").value.trim(),
      compteFournisseur: $("#sg-fourn").value.trim(),
    });
    toast("Comptes Sage enregistrés.", "success");
  };

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

  // --- Recherche dans le plan comptable de référence ---
  $("#plan-search").addEventListener("input", (e) => {
    $("#plan-liste").innerHTML = renderPlan(e.target.value);
  });

  // --- Utilisateurs (admin) ---
  if (estAdmin) chargerUsers();

  // --- Logs ---
  chargerLogs();

  $("#btn-deconnexion").onclick = async () => { await deconnexion(); location.reload(); };
}

// Rendu (filtrable) du plan comptable de référence, groupé par section.
function renderPlan(filtre) {
  const q = (filtre || "").trim().toLowerCase();
  const match = (c) =>
    !q ||
    [c.compte, c.labelFr, c.labelEn, c.nature, c.ohada, c.centreCout]
      .some((v) => (v || "").toLowerCase().includes(q));

  const sections = PLAN_PAR_SECTION
    .map((s) => ({ ...s, comptes: s.comptes.filter(match) }))
    .filter((s) => s.comptes.length);

  if (!sections.length) return `<p class="muted" style="font-size:.85rem">Aucun compte ne correspond à « ${esc(filtre)} ».</p>`;

  return sections.map((s) => `
    <details ${q ? "open" : ""} style="margin-bottom:6px">
      <summary style="cursor:pointer;font-weight:600;font-size:.88rem">
        ${esc(s.prefixe)}xxxx — ${esc(s.label)} <span class="muted">(${s.comptes.length})</span>
      </summary>
      <div style="margin:6px 0 10px">
        ${s.comptes.map((c) => `
          <details style="padding:6px 0;border-bottom:1px solid var(--border)">
            <summary style="cursor:pointer;font-size:.85rem;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap">
              <strong style="font-variant-numeric:tabular-nums">${esc(c.compte)}</strong>
              <span>${esc(c.labelFr)}</span>
              <span class="muted" style="font-size:.72rem">${esc(c.traitement)}</span>
            </summary>
            <div style="font-size:.8rem;margin:6px 0 4px;display:grid;gap:4px">
              <div><span class="muted">Nature : </span>${esc(c.nature)}</div>
              ${c.exemples ? `<div><span class="muted">Exemples : </span>${esc(c.exemples)}</div>` : ""}
              ${c.exclusions ? `<div><span class="muted">${esc(c.exclusions)}</span></div>` : ""}
              <div><span class="muted">Équivalent OHADA : </span>${esc(c.ohada)}</div>
              <div><span class="muted">Centre de coût : </span>${esc(c.centreCout)} &nbsp;·&nbsp; <span class="muted">Libellé EN : </span>${esc(c.labelEn)}</div>
            </div>
          </details>`).join("")}
      </div>
    </details>`).join("");
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
    else if (format === "sap_ju") await exporterSAPJournalUpload(exportables);
    else if (format === "sage") await exporterSageEcritures(exportables);
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
