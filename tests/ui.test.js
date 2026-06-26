/* Tests unitaires de la logique métier pure (js/ui.js).
   Couvre : calculs TVA/totaux, cohérence, validation NCC (format FNE),
   conversion numérique, état de paiement. */
import {
  calculerTotaux, ecartCoherence, nccValide, toNumber, fcfa,
  infoPaiement, paiementBadge, statutBadge,
} from "../js/ui.js";

describe("calculerTotaux", () => {
  test("taux unique 18 %", () => {
    const t = calculerTotaux([{ montant_ht: 1000, taux_tva: 18 }], 18);
    expect(t.total_ht).toBe(1000);
    expect(t.montant_tva).toBe(180);
    expect(t.total_ttc).toBe(1180);
  });

  test("taux par défaut appliqué aux lignes sans taux", () => {
    const t = calculerTotaux([{ montant_ht: 2000, taux_tva: "" }], 18);
    expect(t.montant_tva).toBe(360);
    expect(t.total_ttc).toBe(2360);
  });

  test("taux mixtes (18 % + exonéré 0 %)", () => {
    const t = calculerTotaux([
      { montant_ht: 1000, taux_tva: 18 },
      { montant_ht: 500, taux_tva: 0 },
    ], 18);
    expect(t.total_ht).toBe(1500);
    expect(t.montant_tva).toBe(180);
    expect(t.total_ttc).toBe(1680);
  });

  test("liste vide → tout à zéro", () => {
    expect(calculerTotaux([], 18)).toEqual({ total_ht: 0, montant_tva: 0, total_ttc: 0 });
  });
});

describe("ecartCoherence", () => {
  test("cohérent → écart nul", () => {
    expect(ecartCoherence({ total_ht: 1000, montant_tva: 180, total_ttc: 1180 })).toBe(0);
  });
  test("incohérent → écart positif", () => {
    expect(ecartCoherence({ total_ht: 1000, montant_tva: 180, total_ttc: 1200 })).toBe(20);
  });
});

describe("nccValide (format FNE : 7 chiffres + 1 lettre)", () => {
  test.each(["9502363N", "1234567A", "0000000Z", "CC1234567A"])("valide : %s", (v) => {
    expect(nccValide(v)).toBe(true);
  });
  test.each(["950236N", "95023633", "ABCDEFGH", "", null, undefined])("invalide : %s", (v) => {
    expect(nccValide(v)).toBe(false);
  });
  // Avertissement de saisie volontairement tolérant : casse et espaces normalisés
  // (un NCC valide saisi en minuscules ne doit pas être signalé comme suspect).
  test("tolère la casse et les espaces", () => {
    expect(nccValide("9502363n")).toBe(true);
    expect(nccValide(" 9502363N ")).toBe(true);
  });
});

describe("toNumber", () => {
  test("séparateur d'espace + virgule décimale", () => {
    expect(toNumber("1 250,50")).toBeCloseTo(1250.5);
  });
  test("déjà un nombre", () => {
    expect(toNumber(42)).toBe(42);
  });
  test("vide → 0", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBe(0);
  });
});

describe("fcfa", () => {
  test("formate en FCFA", () => {
    const s = fcfa(1250000);
    expect(s.endsWith("FCFA")).toBe(true);
    expect(s.replace(/\D/g, "")).toBe("1250000");
  });
  test("autre devise", () => {
    expect(fcfa(1000, "EUR").endsWith("EUR")).toBe(true);
  });
});

describe("infoPaiement", () => {
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  test("non payée", () => {
    const ip = infoPaiement({ total_ttc: 1000, montant_paye: 0 });
    expect(ip.statut).toBe("a_payer");
    expect(ip.restant).toBe(1000);
  });
  test("payée intégralement", () => {
    const ip = infoPaiement({ total_ttc: 1000, montant_paye: 1000, statut_paiement: "paye" });
    expect(ip.statut).toBe("paye");
    expect(ip.restant).toBe(0);
  });
  test("partielle → reste dû", () => {
    const ip = infoPaiement({ total_ttc: 1000, montant_paye: 400, statut_paiement: "partiel" });
    expect(ip.statut).toBe("partiel");
    expect(ip.restant).toBe(600);
  });
  test("en retard si échéance passée et non payée", () => {
    expect(infoPaiement({ total_ttc: 1000, echeance: hier }).enRetard).toBe(true);
    expect(infoPaiement({ total_ttc: 1000, echeance: demain }).enRetard).toBe(false);
  });
  test("payée n'est jamais en retard", () => {
    expect(infoPaiement({ total_ttc: 1000, montant_paye: 1000, statut_paiement: "paye", echeance: hier }).enRetard).toBe(false);
  });
  test("tolère les champs absents (migration non appliquée)", () => {
    expect(infoPaiement({ total_ttc: 1000 }).statut).toBe("a_payer");
  });
});

describe("badges", () => {
  test("paiementBadge contient le libellé", () => {
    expect(paiementBadge("paye")).toContain("Payée");
    expect(paiementBadge("a_payer")).toContain("À payer");
  });
  test("statutBadge contient le libellé", () => {
    expect(statutBadge("a_controler")).toContain("À contrôler");
    expect(statutBadge("validee")).toContain("Validée");
  });
});
