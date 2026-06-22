# FactureFlow CI

PWA d'automatisation des **factures fournisseurs** pour les **PME ivoiriennes** :
capture (photo/PDF) → extraction IA (vision) → **vérification obligatoire** →
stockage + audit → export comptable (CSV/Excel/PDF).

> ⚠️ FactureFlow CI aide à la saisie comptable mais **n'établit aucune règle
> fiscale**. La conformité (NCC, TVA, format DGI/Sage) doit être validée par un
> expert-comptable ou la DGI.

## Stack

- **Front** : HTML/CSS/JS vanilla (modules ES), PWA installable, mobile-first.
- **Données/Auth/Storage** : Supabase (Postgres + RLS, Auth JWT, Storage privé).
- **IA** : proxy serverless Netlify (`ai-proxy`) → Claude (vision + `tool_use`).
  Modèle par défaut `claude-sonnet-4-6`, repli `claude-opus-4-8`.

## Structure

```
index.html · manifest.json · service-worker.js · netlify.toml
css/styles.css
icons/
js/
  app.js auth.js store.js ai.js config.js ui.js
  modules/ capture.js verification.js factures.js fournisseurs.js dashboard.js export.js settings.js
netlify/functions/ai-proxy.js
supabase/schema.sql
```

## Mise en route

### 1. Supabase
1. Créer un projet sur [supabase.com](https://supabase.com).
2. SQL Editor → coller/exécuter `supabase/schema.sql`
   (tables, RLS, triggers, bucket privé `factures`, RPC `creer_organisation`).
3. Récupérer **Project URL** et **clé `anon`** (Settings → API).

### 2. Configuration front
Dans `js/config.js`, renseigner :
```js
SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",
SUPABASE_ANON_KEY: "VOTRE_CLE_ANON_PUBLIQUE",
```
(Aucun secret ici : la clé `anon` est publique, la sécurité vient des RLS.)

### 3. Proxy IA (Netlify)
Variables d'environnement Netlify (Site settings → Environment) :
```
ANTHROPIC_API_KEY = sk-ant-...
SUPABASE_URL      = https://VOTRE-PROJET.supabase.co
SUPABASE_ANON_KEY = VOTRE_CLE_ANON_PUBLIQUE
ALLOWED_ORIGINS   = https://VOTRE-SITE.netlify.app,http://localhost:8888
```
Le proxy **vérifie le JWT Supabase** de l'appelant et **filtre l'origine** :
tout appel non authentifié est rejeté (protection de la clé Anthropic).

### 4. Lancer en local
```bash
npm i -g netlify-cli
netlify dev          # sert le front + la fonction sur http://localhost:8888
```
> `netlify dev` est nécessaire pour que `/.netlify/functions/ai-proxy` réponde.

### 5. Déployer
```bash
netlify deploy --prod
```

## Parcours produit (Phase 1 — MVP)

1. **Inscription** → crée l'organisation (1er utilisateur = `admin`).
2. **Capture** (onglet ＋) : photo/upload, compression client (~1500 px, < 1,5 Mo).
3. **Extraction IA** → JSON structuré (schéma strict via `tool_use`).
4. **Vérification** (obligatoire) : champs éditables, incertains surlignés (orange),
   recalcul TVA/totaux en direct, détection **NCC manquant → non conforme**.
5. **Validation** → écriture Supabase + stockage de l'original (URL signées).
6. **Export** : CSV (Sage générique), Excel, PDF récapitulatif ; journal d'audit.

## Sécurité

- RLS Postgres : isolation stricte par `org_id`, rôles `admin`/`saisie`/`lecture`.
- Storage privé `factures`, accès par URL **signées temporaires**.
- Proxy IA : origine + JWT vérifiés ; clé Anthropic jamais exposée au navigateur.
- Journal d'audit (`logs`) sur validation, export, suppression.

## Limites connues / suites (Phases 2-3)

- Offline complet (PWA) et abonnement Mobile Money : Phase 3.
- Invitation d'utilisateurs : via Supabase pour le MVP.
- Export Sage : format générique à mapper sur le plan comptable réel.
- Validation du format **NCC** : heuristique souple — à confirmer auprès de la DGI.
