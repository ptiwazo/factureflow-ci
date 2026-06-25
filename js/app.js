/* =====================================================================
   FactureFlow CI — Bootstrap & routeur (hash-based)
   ---------------------------------------------------------------------
   - Enregistre le Service Worker (PWA).
   - Gère l'écran d'authentification ↔ application.
   - Route les vues vers les modules fonctionnels.
   Un "brouillon d'extraction" (résultat IA) transite de capture → vérification
   via le store mémoire `draft` (jamais persisté tant que l'utilisateur n'a pas validé).
===================================================================== */
import { $, $$, toast } from "./ui.js";
import {
  chargerProfil, getProfil, connexion, inscription,
  deconnexion, onAuthChange, creerOrganisation, rejoindreOrganisation,
} from "./auth.js";

import * as dashboard    from "./modules/dashboard.js";
import * as capture      from "./modules/capture.js";
import * as verification from "./modules/verification.js";
import * as factures     from "./modules/factures.js";
import * as fournisseurs from "./modules/fournisseurs.js";
import * as echeancier   from "./modules/echeancier.js";
import * as tva          from "./modules/tva.js";
import * as settings     from "./modules/settings.js";

// Brouillon d'extraction partagé entre capture et vérification.
// Brouillon courant + file d'attente pour l'import multiple.
//   data/fichier/apercu : facture en cours de vérification
//   queue : [{ file, kind }] préparés ; index : position courante ; total : nombre initial
export const draft = { data: null, fichier: null, apercu: null, queue: [], index: 0, total: 0 };

// Réinitialise complètement le brouillon (fin de cycle ou annulation globale).
export function resetDraft() {
  draft.data = null; draft.fichier = null; draft.apercu = null;
  draft.queue = []; draft.index = 0; draft.total = 0;
}

/* ----------------------------- Routeur ----------------------------- */
const routes = {
  dashboard:       (p) => dashboard.render(p),
  capture:         (p) => capture.render(p),
  verification:    (p) => verification.render(p),
  factures:        (p) => factures.renderListe(p),
  facture:         (p) => factures.renderDetail(p),
  fournisseurs:    (p) => fournisseurs.renderListe(p),
  fournisseur:     (p) => fournisseurs.renderDetail(p),
  echeancier:      (p) => echeancier.render(p),
  tva:             (p) => tva.render(p),
  settings:        (p) => settings.render(p),
};

function parseHash() {
  const raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
  const [name, param] = raw.split("/");
  return { name: name || "dashboard", param };
}

async function router() {
  // Routage uniquement si une session + org sont présentes.
  const profil = getProfil();
  if (!profil?.org_id) return;

  const { name, param } = parseHash();
  const handler = routes[name] || routes.dashboard;
  marquerOnglet(name);
  try {
    await handler(param);
  } catch (e) {
    console.error(e);
    toast(e.message || "Erreur d'affichage.", "error");
  }
}

function marquerOnglet(name) {
  $$(".tabbar-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name ||
      (name === "facture" && a.dataset.route === "factures") ||
      (name === "fournisseur" && a.dataset.route === "fournisseurs") ||
      (name === "verification" && a.dataset.route === "capture"));
  });
}

export function navigate(hash) {
  // Si le hash est déjà celui demandé (ex. vérification → vérification suivante
  // d'un lot), aucun 'hashchange' ne se déclenche : on relance le routeur manuellement.
  if (location.hash === hash) router();
  else location.hash = hash;
}

/* --------------------------- Écran Auth ---------------------------- */
let modeAuth = "login";

// Affiche les champs « Créer » ou « Rejoindre » selon le mode choisi.
function appliquerOrgMode() {
  const join = document.querySelector('input[name="org-mode"]:checked')?.value === "join";
  $$(".org-create").forEach((el) => el.classList.toggle("hidden", join));
  $$(".org-join").forEach((el) => el.classList.toggle("hidden", !join));
}

function initAuthUI() {
  $$("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modeAuth = btn.dataset.authTab;
      $$("[data-auth-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".signup-only").forEach((el) => el.classList.toggle("hidden", modeAuth !== "signup"));
      if (modeAuth === "signup") appliquerOrgMode();
      $("#auth-submit").textContent = modeAuth === "signup" ? "Créer mon compte" : "Se connecter";
      $("#auth-error").textContent = "";
    });
  });

  // Bascule Créer / Rejoindre.
  $$('input[name="org-mode"]').forEach((r) => r.addEventListener("change", appliquerOrgMode));

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const errBox = $("#auth-error");
    const submit = $("#auth-submit");
    errBox.textContent = "";
    submit.disabled = true;

    try {
      if (modeAuth === "signup") {
        const orgMode = document.querySelector('input[name="org-mode"]:checked')?.value || "create";
        let opts;
        if (orgMode === "join") {
          const code = $("#org-code").value.trim();
          if (!code) throw new Error("Saisissez le code d'invitation.");
          opts = { mode: "join", code };
        } else {
          const orgNom = $("#org-nom").value.trim();
          if (!orgNom) throw new Error("Indiquez le nom de votre entreprise.");
          opts = { mode: "create", orgNom, orgNcc: $("#org-ncc").value.trim() };
        }
        const res = await inscription(email, password, opts);
        if (res.needConfirmation) {
          // Pas de session : Supabase exige la confirmation par e-mail.
          modeAuth = "login";
          $$("[data-auth-tab]").forEach((b) => b.classList.toggle("active", b.dataset.authTab === "login"));
          $$(".signup-only").forEach((el) => el.classList.add("hidden"));
          $("#auth-submit").textContent = "Se connecter";
          errBox.textContent = "";
          toast("Compte créé. Confirmez votre e-mail (lien reçu), puis connectez-vous.", "success", 6000);
          return; // on ne tente pas d'ouvrir une session inexistante
        }
        toast("Compte créé. Bienvenue !", "success");
      } else {
        await connexion(email, password);
      }
      await demarrerSession();
    } catch (err) {
      errBox.textContent = err.message || "Échec.";
    } finally {
      submit.disabled = false;
    }
  });

  $("#btn-logout").addEventListener("click", async () => {
    await deconnexion();
    afficherAuth();
    toast("Déconnecté.", "info");
  });
}

/* ----------------------- Onboarding (org absente) ------------------ */
// Cas : utilisateur connecté mais pas encore rattaché à une organisation
// (ex. confirmation e-mail différée). On lui propose de la créer.
function afficherOnboarding() {
  basculer({ auth: false, app: true });
  $("#view").innerHTML = `
    <h1 class="page-title">Dernière étape</h1>
    <div class="card">
      <div class="row" style="gap:16px;margin-bottom:10px">
        <label class="row" style="gap:6px"><input type="radio" name="ob-mode" value="create" checked style="width:auto" /> Créer une entreprise</label>
        <label class="row" style="gap:6px"><input type="radio" name="ob-mode" value="join" style="width:auto" /> Rejoindre</label>
      </div>
      <div class="ob-create">
        <p class="muted mb">Créez votre entreprise (vous en serez l'administrateur). Un code d'invitation sera généré pour rattacher vos collègues.</p>
        <div class="field"><label for="ob-nom">Nom de l'entreprise</label>
          <input id="ob-nom" type="text" placeholder="Ex. Établissements Kouassi" /></div>
        <div class="field"><label for="ob-ncc">NCC <small>(facultatif)</small></label>
          <input id="ob-ncc" type="text" placeholder="Numéro de Compte Contribuable" /></div>
      </div>
      <div class="ob-join hidden">
        <p class="muted mb">Rejoignez une entreprise existante avec le <strong>code d'invitation</strong> fourni par son administrateur (rôle « Saisie »).</p>
        <div class="field"><label for="ob-code">Code d'invitation</label>
          <input id="ob-code" type="text" placeholder="Code reçu" style="text-transform:uppercase" autocomplete="off" /></div>
      </div>
      <button id="ob-submit" class="btn btn-primary btn-block">Valider</button>
    </div>`;

  const apply = () => {
    const join = document.querySelector('input[name="ob-mode"]:checked')?.value === "join";
    $(".ob-create").classList.toggle("hidden", join);
    $(".ob-join").classList.toggle("hidden", !join);
  };
  $$('input[name="ob-mode"]').forEach((r) => r.addEventListener("change", apply));

  $("#ob-submit").addEventListener("click", async () => {
    const join = document.querySelector('input[name="ob-mode"]:checked')?.value === "join";
    try {
      if (join) {
        const code = $("#ob-code").value.trim();
        if (!code) return toast("Saisissez le code d'invitation.", "warn");
        await rejoindreOrganisation(code);
      } else {
        const nom = $("#ob-nom").value.trim();
        if (!nom) return toast("Le nom est requis.", "warn");
        await creerOrganisation(nom, $("#ob-ncc").value.trim());
      }
      await demarrerSession();
    } catch (e) { toast(e.message, "error"); }
  });
}

/* ----------------------- Cycle de session -------------------------- */
function basculer({ auth, app }) {
  const a = $("#auth-screen"), s = $("#app-shell");
  a.classList.toggle("hidden", !auth); a.setAttribute("aria-hidden", String(!auth));
  s.classList.toggle("hidden", !app);  s.setAttribute("aria-hidden", String(!app));
}

function afficherAuth() {
  basculer({ auth: true, app: false });
}

async function demarrerSession() {
  const profil = await chargerProfil();
  if (!profil) { afficherAuth(); return; }
  if (!profil.org_id) { afficherOnboarding(); return; }

  // Session complète : on affiche l'app.
  basculer({ auth: false, app: true });
  $("#org-badge").textContent = profil.org_nom || "";
  if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
  router();
}

/* ----------------------------- Boot -------------------------------- */
async function boot() {
  initAuthUI();
  window.addEventListener("hashchange", router);

  // Le SW est facultatif : il améliore le démarrage mais ne doit pas bloquer.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  // Rafraîchit l'UI si la session disparaît ailleurs (déconnexion autre onglet,
  // expiration). On ne relance pas la session ici pour éviter les boucles.
  onAuthChange(() => {
    chargerProfil().then((p) => { if (!p) afficherAuth(); });
  });

  await demarrerSession();
}

boot();
