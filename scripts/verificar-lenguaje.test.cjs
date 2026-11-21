const { test } = require('node:test');
const assert = require('node:assert/strict');
const { coincidencias } = require('./verificar-lenguaje.cjs');

test('detecta formas regionales con mayúsculas y signos', () => {
  assert.deepEqual(coincidencias('¿Tenés cuenta? Iniciá sesión; solo vos podés entrar.'),
    ['Tenés', 'Iniciá', 'vos', 'podés']);
});
test('acepta español neutral y acentos correctos', () => {
  assert.deepEqual(coincidencias('¿Tienes cuenta? Inicia sesión. Así está bien; tú puedes continuar.'), []);
});
test('no confunde fragmentos de palabras ni identificadores', () => {
  assert.deepEqual(coincidencias('archivos pasos motivos objetivos usuariosActivos identificámetro'), []);
});
test('detecta todas las coincidencias en llamadas sucesivas', () => {
  assert.deepEqual(coincidencias('Revisá'), ['Revisá']);
  assert.deepEqual(coincidencias('Revisá'), ['Revisá']);
});
