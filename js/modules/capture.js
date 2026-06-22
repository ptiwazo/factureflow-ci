/* =====================================================================
   Module 6.1 — Capture & extraction
   ---------------------------------------------------------------------
   Caméra/upload (mono ou MULTIPLE) → compression client-side (clé réseau CI)
   → file d'analyse → écran de vérification (obligatoire) entre chaque facture.
   Pour un lot, on analyse une facture à la fois : l'utilisateur vérifie et
   enregistre, puis la suivante est analysée automatiquement (cf. verification.js).
===================================================================== */
import { $, toast, setView, busy, esc } from "../ui.js";
import { extraireFacture } from "../ai.js";
import { draft, navigate, resetDraft } from "../app.js";

// Taille max du grand côté après compression + qualité JPEG cible.
const MAX_DIM = 1500;
const QUALITE = 0.72;
const TAILLE_CIBLE = 1.5 * 1024 * 1024; // 1,5 Mo

// Fichiers sélectionnés en attente de préparation (avant clic "Analyser").
let selection = [];

export function render() {
  selection = [];
  resetDraft(); // repart d'un état propre (un lot interrompu ne laisse pas de résidu)
  setView(`
    <h1 class="page-title">Nouvelle(s) facture(s)</h1>

    <div class="alert alert-info">
      📸 Photographiez ou importez une ou <strong>plusieurs</strong> factures (images ou PDF).
      Chaque facture sera <strong>vérifiée</strong> avant enregistrement.
    </div>

    <div id="dz" class="dropzone">
      <div class="big">🧾</div>
      <p>Touchez pour <strong>prendre une photo</strong> ou importer des images / PDF.</p>
      <p class="muted" style="font-size:.8rem">Sélection multiple possible. Les images sont compressées sur votre téléphone.</p>
    </div>

    <div id="liste-zone" class="hidden mt">
      <div class="row between">
        <strong id="liste-titre"></strong>
        <button id="btn-vider" class="btn btn-ghost btn-sm">Tout retirer</button>
      </div>
      <div id="liste-fichiers" class="list mt"></div>
      <div class="capture-actions">
        <button id="btn-ajouter" class="btn btn-secondary">+ Ajouter</button>
        <button id="btn-extraire" class="btn btn-primary">Analyser</button>
      </div>
    </div>

    <!-- 'capture=environment' ouvre la caméra arrière sur mobile ; 'multiple' = lot -->
    <input id="file-input" type="file" accept="image/*,application/pdf" capture="environment" multiple class="hidden" />
  `);

  const dz = $("#dz");
  const input = $("#file-input");
  dz.addEventListener("click", () => input.click());
  $("#btn-ajouter")?.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { ajouterFichiers(input.files); input.value = ""; });

  $("#btn-vider").addEventListener("click", () => { selection = []; majListe(); });
  $("#btn-extraire").addEventListener("click", (e) => demarrerAnalyse(e.currentTarget));

  // Glisser-déposer (desktop).
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.borderColor = "var(--teal)"; });
  dz.addEventListener("dragleave", () => { dz.style.borderColor = ""; });
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.style.borderColor = "";
    ajouterFichiers(e.dataTransfer.files);
  });
}

function ajouterFichiers(fileList) {
  for (const f of Array.from(fileList || [])) {
    const estPdf = f.type.includes("pdf");
    const estImage = f.type.startsWith("image/");
    if (!estPdf && !estImage) { toast(`Format ignoré : ${f.name}`, "warn"); continue; }
    if (estPdf && f.size > 8 * 1024 * 1024) { toast(`PDF trop volumineux : ${f.name}`, "warn"); continue; }
    selection.push(f);
  }
  majListe();
}

function majListe() {
  const zone = $("#liste-zone");
  if (!selection.length) {
    zone.classList.add("hidden");
    $("#dz").classList.remove("hidden");
    return;
  }
  $("#dz").classList.add("hidden");
  zone.classList.remove("hidden");
  $("#liste-titre").textContent = `${selection.length} facture(s) à analyser`;
  $("#btn-extraire").textContent = selection.length > 1 ? `Analyser ${selection.length} factures` : "Analyser la facture";

  $("#liste-fichiers").innerHTML = selection.map((f, i) => `
    <div class="list-item" style="cursor:default">
      <div class="li-main">
        <div class="li-title">${f.type.includes("pdf") ? "📄" : "🖼️"} ${esc(f.name)}</div>
        <div class="li-sub">${(f.size / 1024).toFixed(0)} Ko</div>
      </div>
      <button class="icon-btn" style="color:var(--danger)" data-rm="${i}" title="Retirer">✕</button>
    </div>`).join("");

  $("#liste-fichiers").querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => { selection.splice(Number(b.dataset.rm), 1); majListe(); }));
}

// Prépare la file (compression des images) puis lance l'analyse de la 1re facture.
async function demarrerAnalyse(btn) {
  if (!selection.length) return;
  busy(btn, true, "Préparation…");
  try {
    const queue = [];
    for (const f of selection) {
      if (f.type.startsWith("image/")) {
        queue.push({ file: await compresserImage(f), kind: "image" });
      } else {
        queue.push({ file: f, kind: "pdf" }); // PDF envoyé tel quel
      }
    }
    resetDraft();
    draft.queue = queue;
    draft.index = 0;
    draft.total = queue.length;
    await analyserCourant(); // analyse l'élément courant et bascule en vérification
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Préparation impossible.", "error");
  }
}

/* Analyse l'élément courant de la file (draft.queue[draft.index]) :
   appelle l'IA, renseigne le brouillon et bascule sur l'écran de vérification.
   Exporté pour être réutilisé par verification.js (passage à la facture suivante). */
export async function analyserCourant() {
  const item = draft.queue[draft.index];
  if (!item) { resetDraft(); navigate("#/factures"); return; }

  // Vue de chargement avec progression pour les lots.
  const prog = draft.total > 1 ? ` (facture ${draft.index + 1}/${draft.total})` : "";
  setView(`<div class="loading-block"><span class="spinner dark"></span>
    <p>Analyse de la facture${prog}…</p></div>`);

  try {
    const base64 = await toBase64(item.file);
    const data = await extraireFacture({ base64, mediaType: item.file.type, kind: item.kind });

    draft.data = data;
    draft.fichier = item.file;
    draft.apercu = item.kind === "image" ? URL.createObjectURL(item.file) : null;

    navigate("#/verification");
  } catch (e) {
    // Échec sur une facture du lot : on propose de réessayer ou de passer.
    const prog2 = draft.total > 1 ? ` (facture ${draft.index + 1}/${draft.total})` : "";
    setView(`
      <h1 class="page-title">Analyse impossible${prog2}</h1>
      <div class="alert alert-danger">⚠️ ${esc(e.message || "Échec de l'analyse.")}</div>
      <div class="row" style="gap:10px">
        <button id="btn-retry" class="btn btn-primary grow">Réessayer</button>
        ${draft.total > 1 ? `<button id="btn-skip" class="btn btn-secondary grow">Passer cette facture</button>` : ""}
        <a href="#/capture" class="btn btn-ghost">Annuler</a>
      </div>`);
    $("#btn-retry").onclick = () => analyserCourant();
    const skip = $("#btn-skip");
    if (skip) skip.onclick = () => { draft.index++; analyserCourant(); };
  }
}

// Compression via canvas : redimensionne à MAX_DIM et baisse la qualité
// jusqu'à passer sous TAILLE_CIBLE (sans descendre trop bas).
async function compresserImage(file) {
  const bitmap = await chargerImage(file);
  let { width, height } = bitmap;
  if (Math.max(width, height) > MAX_DIM) {
    const ratio = MAX_DIM / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); // fond blanc (PNG transparents)
  ctx.drawImage(bitmap, 0, 0, width, height);

  let q = QUALITE;
  let blob = await toBlob(canvas, q);
  while (blob.size > TAILLE_CIBLE && q > 0.4) {
    q -= 0.1;
    blob = await toBlob(canvas, q);
  }
  return new File([blob], (file.name || "facture").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function chargerImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function toBlob(canvas, q) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", q));
}

// Convertit un File en base64 pur (sans préfixe "data:...;base64,").
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
