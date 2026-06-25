/* =====================================================================
   Module — Console super admin (plateforme)
   ---------------------------------------------------------------------
   Réservé au propriétaire de la plateforme. Liste toutes les entreprises et
   permet de générer / régénérer leur CODE D'INVITATION (à transmettre à
   l'entreprise pour rattacher ses membres). Accès protégé côté client ET par
   la RLS (org_superadmin_all + is_super_admin).
===================================================================== */
import { $, $$, setView, toast, esc, dateFr, emptyState, busy } from "../ui.js";
import { listerOrganisations, superadminGenererCode } from "../store.js";
import { getProfil } from "../auth.js";
import { navigate } from "../app.js";

export async function render() {
  if (!getProfil()?.superAdmin) {
    setView(emptyState("⛔", "Accès réservé", "Cette console est réservée au super administrateur de la plateforme."));
    return;
  }

  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Chargement des entreprises…</p></div>`);
  let orgs;
  try { orgs = await listerOrganisations(); }
  catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  setView(`
    <div class="row between">
      <a href="#/settings" class="btn btn-ghost btn-sm">← Réglages</a>
    </div>
    <h1 class="page-title">Console super admin</h1>
    <p class="muted" style="margin-top:-10px;font-size:.85rem">
      Générez le <strong>code d'invitation</strong> de chaque entreprise et transmettez-le à son
      administrateur. Régénérer un code invalide l'ancien.
    </p>

    ${orgs.length ? `<div class="list">${orgs.map(carte).join("")}</div>`
      : emptyState("🏢", "Aucune entreprise", "Aucune organisation enregistrée.")}
    <div style="height:24px"></div>
  `);

  $$("[data-gen]").forEach((btn) => {
    btn.onclick = (e) => genererCode(e.currentTarget.dataset.gen, e.currentTarget);
  });
  $$("[data-copy]").forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.copy;
      try { await navigator.clipboard.writeText(code); toast("Code copié.", "success"); }
      catch { toast("Copie impossible — sélectionnez le code à la main.", "warn"); }
    };
  });
}

function carte(o) {
  const code = o.code_invitation || "";
  return `
    <div class="list-item">
      <div class="li-main">
        <div class="li-title">${esc(o.nom)}</div>
        <div class="li-sub">${o.ncc ? "NCC " + esc(o.ncc) + " · " : ""}créée le ${dateFr(o.created_at)}</div>
        <div class="li-sub" style="margin-top:4px">Code : ${code
          ? `<strong style="letter-spacing:2px">${esc(code)}</strong>`
          : `<span style="color:var(--danger)">aucun</span>`}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${code ? `<button class="btn btn-secondary btn-sm" data-copy="${esc(code)}">Copier</button>` : ""}
        <button class="btn btn-primary btn-sm" data-gen="${o.id}">${code ? "Régénérer" : "Générer"}</button>
      </div>
    </div>`;
}

async function genererCode(orgId, btn) {
  if (!confirm("Générer un nouveau code pour cette entreprise ? L'ancien cessera de fonctionner.")) return;
  busy(btn, true, "…");
  try {
    await superadminGenererCode(orgId);
    toast("Nouveau code généré.", "success");
    render();
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Échec de la génération.", "error");
  }
}
