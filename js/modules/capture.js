/* =====================================================================
   Module 6.1 — Capture & extraction
   ---------------------------------------------------------------------
   Caméra/upload → compression client-side (clé réseau CI) → appel IA →
   bascule vers l'écran de vérification. Gestion d'erreur réseau + retry
   est portée par ai.js ; ici on gère l'UX (états, aperçu, échecs).
===================================================================== */
import { $, toast, setView, busy } from "../ui.js";
import { extraireFacture } from "../ai.js";
import { draft, navigate } from "../app.js";

// Taille max du grand côté après compression + qualité JPEG cible.
const MAX_DIM = 1500;
const QUALITE = 0.72;
const TAILLE_CIBLE = 1.5 * 1024 * 1024; // 1,5 Mo

export function render() {
  setView(`
    <h1 class="page-title">Nouvelle facture</h1>

    <div class="alert alert-info">
      📸 Photographiez ou importez la facture. Les données extraites devront
      <strong>toujours être vérifiées</strong> avant enregistrement.
    </div>

    <div id="dz" class="dropzone">
      <div class="big">🧾</div>
      <p>Touchez pour <strong>prendre une photo</strong> ou importer une image / PDF.</p>
      <p class="muted" style="font-size:.8rem">L'image est compressée sur votre téléphone pour économiser les données.</p>
    </div>

    <div id="apercu-zone" class="hidden mt">
      <img id="apercu-img" class="preview-img" alt="Aperçu de la facture" />
      <div id="apercu-pdf" class="hidden card center">📄 <span id="pdf-nom"></span></div>
      <div class="capture-actions">
        <button id="btn-refaire" class="btn btn-secondary">Reprendre</button>
        <button id="btn-extraire" class="btn btn-primary">Analyser la facture</button>
      </div>
    </div>

    <!-- 'capture=environment' ouvre la caméra arrière sur mobile -->
    <input id="file-input" type="file" accept="image/*,application/pdf" capture="environment" class="hidden" />
  `);

  const dz = $("#dz");
  const input = $("#file-input");
  dz.addEventListener("click", () => input.click());
  input.addEventListener("change", () => onFichier(input.files[0]));

  // Glisser-déposer (desktop).
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.borderColor = "var(--teal)"; });
  dz.addEventListener("dragleave", () => { dz.style.borderColor = ""; });
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.style.borderColor = "";
    if (e.dataTransfer.files[0]) onFichier(e.dataTransfer.files[0]);
  });
}

let fichierCourant = null;

async function onFichier(file) {
  if (!file) return;
  const estPdf = file.type.includes("pdf");
  const estImage = file.type.startsWith("image/");
  if (!estPdf && !estImage) return toast("Format non supporté (image ou PDF).", "warn");

  try {
    if (estImage) {
      fichierCourant = await compresserImage(file);
      const url = URL.createObjectURL(fichierCourant);
      $("#apercu-img").src = url;
      $("#apercu-img").classList.remove("hidden");
      $("#apercu-pdf").classList.add("hidden");
    } else {
      // PDF : pas de compression côté client (resterait un PDF) ; on l'envoie tel quel.
      if (file.size > 8 * 1024 * 1024) return toast("PDF trop volumineux (> 8 Mo).", "warn");
      fichierCourant = file;
      $("#apercu-img").classList.add("hidden");
      $("#pdf-nom").textContent = file.name;
      $("#apercu-pdf").classList.remove("hidden");
    }
    $("#dz").classList.add("hidden");
    $("#apercu-zone").classList.remove("hidden");

    $("#btn-refaire").onclick = reset;
    $("#btn-extraire").onclick = (e) => lancerExtraction(e.currentTarget);
  } catch (e) {
    toast("Impossible de lire le fichier.", "error");
  }
}

function reset() {
  fichierCourant = null;
  $("#file-input").value = "";
  $("#apercu-zone").classList.add("hidden");
  $("#dz").classList.remove("hidden");
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
  return new File([blob], "facture.jpg", { type: "image/jpeg" });
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

async function lancerExtraction(btn) {
  if (!fichierCourant) return;
  busy(btn, true, "Analyse IA…");
  try {
    const base64 = await toBase64(fichierCourant);
    const kind = fichierCourant.type.includes("pdf") ? "pdf" : "image";
    const data = await extraireFacture({ base64, mediaType: fichierCourant.type, kind });

    // Stocke le brouillon et l'original pour l'écran de vérification (étape §5).
    draft.data = data;
    draft.fichier = fichierCourant;
    draft.apercu = kind === "image" ? URL.createObjectURL(fichierCourant) : null;

    navigate("#/verification");
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Échec de l'analyse. Réessayez.", "error", 5000);
  }
}
