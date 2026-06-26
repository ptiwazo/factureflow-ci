/* =====================================================================
   Module 6.7 — Administration & réglages
   ---------------------------------------------------------------------
   - Profil / organisation / rôle
   - Export comptable (période → CSV / Excel) + marquage "exportée"
   - Utilisateurs de l'organisation (lecture ; gestion via Supabase pour le MVP)
   - Journal d'audit (logs)
===================================================================== */
import { $, $$, setView, toast, dateFr, esc, busy, emptyState } from "../ui.js";
import { getProfil, deconnexion, chargerProfil } from "../auth.js";
import { listerFactures, listerLogs, majStatutFacture, listerUtilisateurs, majRoleUtilisateur, majActifUtilisateur, majErpOrganisation, majLogoOrganisation, getOrganisationCourante, listerClotures, cloturerPeriode, rouvrirPeriode } from "../store.js";

// Rôles assignables (du plus au moins privilégié). Doit refléter l'enum
// `user_role` de la base (cf. supabase/schema.sql + migration_workflow.sql).
const ROLES = [
  { key: "admin", label: "Administrateur" },
  { key: "controle_gestion", label: "Contrôle de Gestion" },
  { key: "saisie", label: "Saisie" },
  { key: "lecture", label: "Lecture seule" },
];
import { exporterCSV, exporterExcel, exporterSAP, exporterSAPJournalUpload, exporterSageEcritures, getParamsSAP, setParamsSAP, getParamsSage, setParamsSage } from "./export.js";
import { PLAN_COMPTABLE_IFRS, PLAN_PAR_SECTION, REGLES_CONTROLE } from "../comptes-charge-ifrs.js";
import { libelleAction } from "./audit.js";

export async function render() {
  // Rafraîchit le profil (rôle) depuis la base : évite d'afficher la gestion des
  // rôles avec un rôle 'admin' périmé (ex. après une fusion d'organisations).
  await chargerProfil().catch(() => {});
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
        <div><div class="dt">ERP comptable</div><div class="dd">${(p?.erp || "sap") === "sage" ? "Sage (OHADA)" : "SAP"}</div></div>
      </div>
    </div>

    ${estAdmin ? `<div class="card">
      <h3>ERP comptable</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Indiquez l'ERP de votre organisation. En mode <strong>Sage</strong>, l'app affiche
        l'équivalent <strong>OHADA / SYSCOHADA</strong> à côté du compte de charge interne, à
        l'extraction comme au détail de la facture. Les comptes proposés par l'IA et les exports
        ne sont pas modifiés. Réglage valable pour toute l'organisation.
      </p>
      <div class="field" style="max-width:280px">
        <label for="erp-select">ERP utilisé</label>
        <select id="erp-select">
          <option value="sap">SAP</option>
          <option value="sage">Sage (OHADA / SYSCOHADA)</option>
        </select>
      </div>
      <button id="erp-save" class="btn btn-primary btn-sm">Enregistrer l'ERP</button>
    </div>` : ""}

    ${estAdmin ? `<div class="card">
      <h3>Logo de l'organisation</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Affiché en en-tête des <strong>relevés fournisseurs (PDF)</strong>. L'image est redimensionnée automatiquement.
      </p>
      <div class="row" style="gap:12px;align-items:center">
        <img id="logo-apercu" alt="" style="max-height:60px;max-width:160px;border:1px solid var(--border);border-radius:8px;background:#fff;padding:4px;display:none" />
        <span id="logo-vide" class="muted">Aucun logo</span>
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button id="logo-choisir" class="btn btn-secondary btn-sm">Choisir une image</button>
        <button id="logo-retirer" class="btn btn-ghost btn-sm">Retirer</button>
      </div>
      <input id="logo-file" type="file" accept="image/*" class="hidden" />
    </div>` : ""}

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
      <h3>Inviter des membres</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Partagez ce <strong>code d'invitation</strong> avec vos collègues. À l'inscription, ils choisissent
        « Rejoindre une entreprise » et saisissent ce code pour accéder aux mêmes factures (rôle « Saisie »
        par défaut, ajustable ci-dessous). Le code est délivré et géré par l'administrateur de la plateforme.
      </p>
      <div class="row" style="gap:8px;align-items:flex-end">
        <div class="grow field"><label for="inv-code">Code d'invitation</label>
          <input id="inv-code" readonly value="…" style="font-weight:700;letter-spacing:2px;text-transform:uppercase" /></div>
        <button id="inv-copy" class="btn btn-secondary btn-sm">Copier</button>
      </div>
    </div>` : ""}

    ${p?.superAdmin ? `<div class="card">
      <h3>Console super admin</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Gérez les <strong>codes d'invitation de toutes les entreprises</strong> de la plateforme.
      </p>
      <a href="#/superadmin" class="btn btn-primary btn-sm">Ouvrir la console</a>
    </div>` : ""}

    ${estAdmin ? `<div class="card">
      <h3>Utilisateurs &amp; rôles</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Attribuez un rôle à chaque membre. <strong>Contrôle de Gestion</strong> = contrôle des
        comptes de charge puis validation des factures ; <strong>Saisie</strong> = scan + vérification ;
        <strong>Lecture seule</strong> = consultation. Vous ne pouvez pas modifier votre propre rôle.
      </p>
      <div id="users"><span class="spinner dark"></span></div>
      <p class="muted" style="font-size:.8rem">L'ajout d'un nouvel utilisateur se fait via l'invitation Supabase (MVP) ; son rôle se règle ensuite ici.</p>
    </div>` : ""}

    ${estAdmin ? `<div class="card">
      <h3>Clôture des périodes</h3>
      <p class="muted" style="font-size:.85rem;margin-top:-6px">
        Verrouillez un mois après déclaration/export : les factures de ce mois ne pourront plus être
        modifiées, supprimées ni payées. Réversible (réouverture).
      </p>
      <div class="row" style="gap:12px;align-items:flex-end">
        <div class="field" style="max-width:170px"><label for="clo-mois">Mois</label>
          <input id="clo-mois" type="month" value="${new Date().toISOString().slice(0, 7)}" /></div>
        <button id="clo-fermer" class="btn btn-primary btn-sm">Clôturer</button>
      </div>
      <div id="clo-liste" style="margin-top:10px"><span class="spinner dark"></span></div>
    </div>` : ""}

    ${estAdmin ? `<div class="card">
      <div class="row between"><h3 style="margin:0">Journal d'audit</h3>
        <a href="#/audit" class="btn btn-ghost btn-sm">Journal complet →</a></div>
      <div id="logs" style="margin-top:8px"><span class="spinner dark"></span></div>
    </div>` : ""}

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

  // --- ERP comptable (admin) ---
  const erpSel = $("#erp-select");
  if (erpSel) {
    erpSel.value = p?.erp || "sap";
    $("#erp-save").onclick = async (e) => {
      busy(e.currentTarget, true, "Enregistrement…");
      try {
        await majErpOrganisation(erpSel.value);
        await chargerProfil().catch(() => {});
        toast("ERP enregistré pour l'organisation.", "success");
      } catch (err) {
        toast(err.message || "Échec de l'enregistrement.", "error");
      } finally {
        busy(e.currentTarget, false);
      }
    };
  }

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

  // --- Invitation (admin) ---
  if (estAdmin) chargerInvitation();

  // --- Logo (admin) ---
  if (estAdmin) chargerLogo();

  // --- Clôtures (admin) ---
  if (estAdmin) chargerClotures();

  // --- Utilisateurs (admin) ---
  if (estAdmin) chargerUsers();

  // --- Logs (admin uniquement) ---
  if (estAdmin) chargerLogs();

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

// Redimensionne une image (max largeur) et renvoie un data URL PNG.
function lireImageRedim(file, maxW = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function chargerClotures() {
  const liste = $("#clo-liste");
  if (!liste) return;
  const dessiner = async () => {
    try {
      const cl = await listerClotures();
      liste.innerHTML = cl.length ? cl.map((c) => `
        <div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.9rem">
          <span>🔒 <strong>${esc(c.periode)}</strong> <span class="muted">clôturé</span></span>
          <button class="btn btn-ghost btn-sm clo-open" data-p="${esc(c.periode)}">Rouvrir</button>
        </div>`).join("")
        : `<p class="muted" style="font-size:.85rem">Aucune période clôturée.</p>`;
      $$(".clo-open", liste).forEach((b) => b.onclick = async () => {
        if (!confirm(`Rouvrir la période ${b.dataset.p} ? Les factures de ce mois redeviennent modifiables.`)) return;
        try { await rouvrirPeriode(b.dataset.p); toast("Période rouverte.", "info"); dessiner(); }
        catch (e) { toast(e.message, "error"); }
      });
    } catch (e) { liste.innerHTML = `<p class="muted">Indisponible : ${esc(e.message)}</p>`; }
  };
  $("#clo-fermer").onclick = async (e) => {
    const p = $("#clo-mois").value;
    if (!p) return toast("Choisissez un mois.", "warn");
    if (!confirm(`Clôturer ${p} ? Les factures de ce mois seront verrouillées.`)) return;
    busy(e.currentTarget, true, "…");
    try { await cloturerPeriode(p); toast(`Période ${p} clôturée.`, "success"); dessiner(); }
    catch (err) { toast(err.message || "Échec.", "error"); }
    finally { busy(e.currentTarget, false); }
  };
  dessiner();
}

async function chargerLogo() {
  const apercu = $("#logo-apercu"), vide = $("#logo-vide"), input = $("#logo-file");
  if (!apercu) return;
  const afficher = (url) => {
    if (url) { apercu.src = url; apercu.style.display = ""; vide.style.display = "none"; }
    else { apercu.removeAttribute("src"); apercu.style.display = "none"; vide.style.display = ""; }
  };
  try { afficher((await getOrganisationCourante())?.logo || ""); } catch { /* ignore */ }

  $("#logo-choisir").onclick = () => input.click();
  input.addEventListener("change", async () => {
    const file = input.files[0]; input.value = "";
    if (!file) return;
    try {
      const dataUrl = await lireImageRedim(file);
      await majLogoOrganisation(dataUrl);
      afficher(dataUrl);
      toast("Logo enregistré.", "success");
    } catch (e) { toast(e.message || "Échec de l'enregistrement du logo.", "error"); }
  });
  $("#logo-retirer").onclick = async () => {
    try { await majLogoOrganisation(null); afficher(""); toast("Logo retiré.", "info"); }
    catch (e) { toast(e.message || "Échec.", "error"); }
  };
}

async function chargerInvitation() {
  const input = $("#inv-code");
  if (!input) return;
  try {
    const org = await getOrganisationCourante();
    input.value = org?.code_invitation || "(migration requise)";
  } catch { input.value = "(indisponible)"; }

  $("#inv-copy").onclick = async () => {
    try { await navigator.clipboard.writeText($("#inv-code").value); toast("Code copié.", "success"); }
    catch { toast("Copie impossible — sélectionnez le code à la main.", "warn"); }
  };
}

async function chargerUsers() {
  const cible = $("#users");
  const moi = getProfil()?.user?.id;
  try {
    const users = await listerUtilisateurs();
    if (!users.length) { cible.innerHTML = `<p class="muted">Aucun utilisateur.</p>`; return; }

    cible.innerHTML = users.map((u) => {
      const estMoi = u.id === moi;
      const actif = u.actif !== false;
      const options = ROLES.map((r) =>
        `<option value="${r.key}"${r.key === u.role ? " selected" : ""}>${esc(r.label)}</option>`).join("");
      return `
        <div class="row between wrap" style="gap:8px;padding:8px 0;border-bottom:1px solid var(--border);${actif ? "" : "opacity:.6"}">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email || "—")}${estMoi ? " <span class=\"muted\">(vous)</span>" : ""}${actif ? "" : " <span style=\"color:var(--danger)\">désactivé</span>"}</span>
          <div class="row" style="gap:8px">
            <select class="role-select" data-id="${esc(u.id)}" data-prev="${esc(u.role)}" ${estMoi || !actif ? "disabled" : ""} style="min-width:150px">
              ${options}
            </select>
            ${estMoi ? "" : `<button class="btn ${actif ? "btn-ghost" : "btn-secondary"} btn-sm actif-toggle" data-id="${esc(u.id)}" data-actif="${actif}">${actif ? "Désactiver" : "Réactiver"}</button>`}
          </div>
        </div>`;
    }).join("");

    // Changement de rôle (réservé admin par la RLS ; on bloque l'auto-modification).
    $$(".role-select", cible).forEach((sel) => {
      sel.addEventListener("change", async () => {
        const id = sel.dataset.id;
        const nouveau = sel.value;
        const precedent = sel.dataset.prev;
        sel.disabled = true;
        try {
          await majRoleUtilisateur(id, nouveau);
          sel.dataset.prev = nouveau;
          toast("Rôle mis à jour.", "success");
        } catch (e) {
          sel.value = precedent; // rollback visuel
          toast(e.message || "Échec de la mise à jour du rôle.", "error");
        } finally {
          sel.disabled = false;
        }
      });
    });

    // Activation / désactivation (admin ; impossible sur soi-même).
    $$(".actif-toggle", cible).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const nouvelEtat = btn.dataset.actif !== "true"; // bascule
        if (!nouvelEtat && !confirm("Désactiver ce compte ? L'utilisateur perdra immédiatement l'accès.")) return;
        busy(btn, true, "…");
        try {
          await majActifUtilisateur(id, nouvelEtat);
          toast(nouvelEtat ? "Compte réactivé." : "Compte désactivé.", "success");
          chargerUsers();
        } catch (e) { busy(btn, false); toast(e.message || "Échec.", "error"); }
      });
    });
  } catch (e) {
    cible.innerHTML = `<p class="muted">Indisponible : ${esc(e.message)}</p>`;
  }
}

async function chargerLogs() {
  const cible = $("#logs");
  try {
    const [logs, users] = await Promise.all([listerLogs({ limite: 8 }), listerUtilisateurs().catch(() => [])]);
    if (!logs.length) { cible.innerHTML = `<p class="muted">Aucune action enregistrée.</p>`; return; }
    const emails = new Map(users.map((u) => [u.id, u.email]));
    cible.innerHTML = logs.map((l) => `
      <div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem">
        <span><strong>${esc(libelleAction(l.action))}</strong> <span class="muted">${esc(emails.get(l.user_id) || "")}</span></span>
        <span class="muted">${dateFr(l.created_at)}</span>
      </div>`).join("");
  } catch (e) {
    cible.innerHTML = `<p class="muted">Indisponible : ${esc(e.message)}</p>`;
  }
}
