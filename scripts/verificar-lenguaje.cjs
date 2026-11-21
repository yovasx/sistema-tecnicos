const fs = require('node:fs');
const path = require('node:path');

// Regla editorial: español neutral con tuteo. No alterar nombres, identificadores
// ni datos de usuarios. Las migraciones históricas son inmutables: sus mensajes
// vigentes se verifican contra PostgreSQL en MensajesNeutralesTest.
const formasRegionales = [
  'iniciá', 'ingresá', 'revisá', 'completá', 'podés', 'tenés', 'elegí', 'confirmá',
  'guardá', 'volvé', 'cerrá', 'actualizá', 'consultá', 'seleccioná', 'escribí',
  'agregá', 'contá', 'usá', 'buscá', 'recargá', 'enviá', 'solicitá', 'resolvé',
  'resolvelas', 'necesitás', 'querés', 'preferís', 'seguí', 'verificá', 'probá',
  'intentá', 'explicá', 'contanos', 'sumate', 'registrate', 'dejalo', 'cancelá',
  'descartá', 'reintentá', 'ingresás', 'continuás', 'cerrás', 'perdés', 'elegís',
  'contás', 'vos', 'sos', 'hacé', 'cargá', 'subí', 'creá', 'definí', 'marcá',
  'pedí', 'continuá', 'accedé', 'repetí', 'encontrá', 'conocé', 'tocá', 'prepará',
  'leé', 'creés', 'contactá', 'empezá', 'gestioná', 'registrá', 'editá', 'aplicá',
  'ampliá', 'limpiá', 'quitá', 'abrí', 'ignorá', 'recuperá', 'activá', 'reconocés',
  'actualizala', 'descartalos', 'acá', 'compará',
  'entrás', 'debés',
];
const patron = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${formasRegionales.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
function coincidencias(texto) { return [...texto.matchAll(patron)].map(m => m[0]); }
function archivos(directorio) {
  return fs.readdirSync(directorio, { withFileTypes: true }).flatMap(entrada => {
    const ruta = path.join(directorio, entrada.name);
    return entrada.isDirectory() ? archivos(ruta) : /\.(tsx?|java)$/.test(ruta) ? [ruta] : [];
  });
}
function verificar(raiz = path.resolve(__dirname, '..')) {
  const rutas = ['mobile/src', 'backend/src/main/java'].flatMap(r => archivos(path.join(raiz, r)));
  const errores = [];
  for (const ruta of rutas) {
    fs.readFileSync(ruta, 'utf8').split(/\r?\n/).forEach((linea, indice) => {
      const formas = coincidencias(linea);
      if (formas.length) errores.push(`${path.relative(raiz, ruta)}:${indice + 1}: ${formas.join(', ')}`);
    });
  }
  if (errores.length) {
    console.error('Usa español neutral en los textos del sistema:\n' + errores.join('\n'));
    return false;
  }
  console.log(`Lenguaje neutral: ${rutas.length} archivos revisados, sin formas regionales detectadas.`);
  return true;
}
module.exports = { coincidencias, verificar };
if (require.main === module) process.exitCode = verificar() ? 0 : 1;
