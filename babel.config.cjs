// Babel pour Jest : transpile les modules ES (import/export) des sources en CJS
// le temps des tests. N'affecte ni le navigateur (qui charge les ES modules tels
// quels) ni les Netlify Functions (CommonJS d'origine).
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
