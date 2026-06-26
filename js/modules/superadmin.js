/* =====================================================================
   Module — Console super admin (plateforme)
   ---------------------------------------------------------------------
   Réservé au propriétaire de la plateforme. Liste toutes les entreprises et
   permet de générer / régénérer leur CODE D'INVITATION (à transmettre à
   l'entreprise pour rattacher ses membres). Accès protégé côté client ET par
   la RLS (org_superadmin_all + is_super_admin).
===================================================================== */
import { $, $$, setView, toast, esc, dateFr, emptyState, busy } from "../ui.js";
import { listerOrganisations, superadminGenererCode, superadminCreerOrganisation } from "../store.js";
import { getProfil } from "../auth.js";

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
      Créez les entreprises et transmettez leur <strong>code d'invitation</strong>. La 1ʳᵉ personne
      qui rejoint avec le code en devient l'<strong>administrateur</strong> ; les suivantes sont en « saisie ».
      Régénérer un code invalide l'ancien.
    </p>

    <div class="card">
      <h3>Créer une entreprise</h3>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="sa-nom">Nom de l'entreprise</label>
          <input id="sa-nom" type="text" placeholder="Ex. Établissements Kouassi" /></div>
        <div class="grow field"><label for="sa-ncc">NCC <small>(facultatif)</small></label>
          <input id="sa-ncc" type="text" placeholder="Numéro de Compte Contribuable" /></div>
      </div>
      <button id="sa-creer" class="btn btn-primary btn-sm">Créer l'entreprise</button>
    </div>

    <h2 class="section-title">Entreprises (${orgs.length})</h2>
    ${orgs.length ? `<div class="list">${orgs.map(carte).join("")}</div>`
      : emptyState("🏢", "Aucune entreprise", "Créez-en une ci-dessus.")}
    <div style="height:24px"></div>
  `);

  $("#sa-creer").onclick = (e) => creerEntreprise(e.currentTarget);

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

async function creerEntreprise(btn) {
  const nom = $("#sa-nom").value.trim();
  if (!nom) return toast("Indiquez le nom de l'entreprise.", "warn");
  busy(btn, true, "Création…");
  try {
    const res = await superadminCreerOrganisation(nom, $("#sa-ncc").value.trim());
    toast(`Entreprise créée. Code : ${res?.code_invitation || "—"}`, "success", 6000);
    render();
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Échec de la création.", "error");
  }
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
