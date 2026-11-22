const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../mobile/node_modules/typescript');

function diferida() {
  let resolver, rechazar;
  const promesa = new Promise((r, j) => { resolver = r; rechazar = j; });
  return { promesa, resolver, rechazar };
}
function entorno({ permiso, envio } = {}) {
  const estado = { token: 'token-A', tarea: null, activa: false, inicios: 0, paradas: 0,
    permisos: 0, datos: new Map(), envios: [], cierres: [], recursos: [] };
  class ErrorGps extends Error { constructor(estado) { super('Rechazado'); this.estado = estado; } }
  const location = {
    Accuracy: { High: 5 },
    requestBackgroundPermissionsAsync: async () => { estado.permisos++; return permiso ? permiso() : { granted: true }; },
    hasStartedLocationUpdatesAsync: async () => estado.activa,
    startLocationUpdatesAsync: async (_t, opciones) => { estado.inicios++; estado.activa = true; estado.opciones = opciones; },
    stopLocationUpdatesAsync: async () => { estado.paradas++; estado.activa = false; },
  };
  const modulos = {
    'expo-task-manager': { isTaskDefined: () => false, defineTask: (_n, fn) => { estado.tarea = fn; }, isAvailableAsync: async () => true },
    'expo-location': location,
    'expo-secure-store': { getItemAsync: async k => estado.datos.get(k) ?? null,
      setItemAsync: async (k, v) => { estado.datos.set(k, v); }, deleteItemAsync: async k => { estado.datos.delete(k); } },
    '../storage/SecureTokenStorage': { SecureTokenStorage: class { async get() { return estado.token; } } },
    './gpsTransporte': { ErrorGps, enviarMuestraGps: async (...args) => { estado.envios.push(args); if (envio) await envio(...args); },
      cerrarSesionGps: async (...args) => { estado.cierres.push(args); } },
    '../../session/cierreRecursos': { registrarCierre: fn => { estado.recursos.push(fn); } },
  };
  const fuente = fs.readFileSync(path.join(__dirname, '../mobile/src/infrastructure/ubicacion/gpsSegundoPlano.ts'), 'utf8');
  const codigo = ts.transpileModule(fuente, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, { require: nombre => {
    assert(nombre in modulos, `Importación inesperada: ${nombre}`); return modulos[nombre];
  }, exports: modulo.exports, module: modulo, process: { env: { EXPO_PUBLIC_GPS_SEGUNDO_PLANO: 'true' } },
  Date, Promise, JSON, Number, console });
  return { estado, gps: modulo.exports, ErrorGps };
}
function sesion(id) { return { sesion: id, orden: 42, segundoPlano: true, expiraEn: new Date(Date.now() + 60000).toISOString() }; }
function muestra(timestamp = Date.now(), accuracy = 5) {
  return { timestamp, coords: { latitude: -16.5, longitude: -68.13, accuracy } };
}
test('registrar la tarea no activa GPS ni pide permisos', () => {
  const { estado } = entorno();
  assert.equal(typeof estado.tarea, 'function');
  assert.equal(estado.inicios, 0); assert.equal(estado.permisos, 0); assert.equal(estado.datos.size, 0);
});
test('inicio explícito configura indicador visible y no persiste coordenadas', async () => {
  const { estado, gps } = entorno();
  await gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => true);
  assert.equal(estado.inicios, 1);
  assert.equal(estado.opciones.showsBackgroundLocationIndicator, true);
  assert(estado.opciones.foregroundService.notificationTitle.includes('Fixly'));
  await estado.tarea({ data: { locations: [muestra()] }, error: null });
  assert.equal(estado.envios.length, 1);
  const persistido = [...estado.datos.values()][0];
  assert(!persistido.includes('latitud')); assert(!persistido.includes('longitude'));
});
test('descarta posiciones antiguas o imprecisas sin fabricar señal reciente', async () => {
  const { estado, gps } = entorno();
  await gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => true);
  await estado.tarea({ data: { locations: [muestra(Date.now() - 31000)] }, error: null });
  await estado.tarea({ data: { locations: [muestra(Date.now(), 201)] }, error: null });
  await estado.tarea({ data: { locations: [muestra(Date.now() + 10000)] }, error: null });
  assert.equal(estado.envios.length, 0);
});
test('cambiar de token detiene la captura antes de publicar con otra cuenta', async () => {
  const { estado, gps } = entorno();
  await gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => true);
  estado.token = 'token-B';
  await estado.tarea({ data: { locations: [muestra()] }, error: null });
  assert.equal(estado.envios.length, 0); assert.equal(estado.activa, false); assert.equal(estado.datos.size, 0);
});
test('cerrar sesión detiene la tarea y revoca el permiso de servidor', async () => {
  const { estado, gps } = entorno();
  await gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => true);
  await estado.recursos[0]();
  assert.equal(estado.activa, false); assert.equal(estado.datos.size, 0);
  assert.equal(estado.cierres[0][0].sesion, 'A');
});
test('un permiso concedido después de salir no inicia seguimiento', async () => {
  const permiso = diferida(), solicitado = diferida();
  const { estado, gps } = entorno({ permiso: () => { solicitado.resolver(); return permiso.promesa; } });
  let vigente = true;
  const inicio = gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => vigente);
  await solicitado.promesa;
  vigente = false; estado.token = 'token-B'; permiso.resolver({ granted: true });
  await assert.rejects(inicio, /sesión cambió/);
  assert.equal(estado.inicios, 0); assert.equal(estado.datos.size, 0);
});
test('un rechazo atrasado de una sesión anterior no detiene la nueva', async () => {
  const enviado = diferida(), respuesta = diferida();
  const { estado, gps, ErrorGps } = entorno({ envio: async () => { enviado.resolver(); await respuesta.promesa; } });
  await gps.iniciarSegundoPlano(sesion('A'), 4, 'Bearer token-A', () => true);
  const publicacion = estado.tarea({ data: { locations: [muestra()] }, error: null });
  await enviado.promesa;
  await gps.iniciarSegundoPlano(sesion('B'), 4, 'Bearer token-A', () => true);
  respuesta.rechazar(new ErrorGps(409));
  await publicacion;
  assert.equal(estado.activa, true);
  assert.equal(JSON.parse([...estado.datos.values()][0]).sesion.sesion, 'B');
});
