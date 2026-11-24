const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../index');
const { crearGestorTurnos } = require('../services/turnosService');

const datosTurno = {
  nombreCliente: 'Ana Torres',
  nombreMascota: 'Luna',
  tipoServicio: 'Consulta veterinaria',
  fechaHora: '2026-12-01T10:00:00-05:00',
  precioBase: 100000,
  prioritario: true,
};

test('La cotización del servicio usa N y no guarda turnos ni consume identificadores', () => {
  const gestor = crearGestorTurnos(7);
  const antes = gestor.listarTurnos();
  const cotizacion = gestor.cotizarTurno({ precioBase: 100000, prioritario: true });

  assert.equal(cotizacion.precioBase, 100000);
  assert.equal(cotizacion.prioritario, true);
  assert.equal(cotizacion.porcentajeRecargo, 14);
  assert.equal(cotizacion.valorRecargo, 14000);
  assert.equal(cotizacion.totalPagar, 114000);
  assert.equal(Object.hasOwn(cotizacion, 'id'), false);
  assert.deepEqual(gestor.listarTurnos(), antes);

  const primero = gestor.crearTurno(datosTurno);
  assert.equal(primero.id, 1);
  const conRegistro = gestor.listarTurnos();
  gestor.cotizarTurno({ precioBase: 100000 });
  assert.deepEqual(gestor.listarTurnos(), conRegistro);
  const segundo = gestor.crearTurno(datosTurno);
  assert.equal(segundo.id, 2);
});

test('La interfaz y la cotización HTTP funcionan sin alterar los registros', async (t) => {
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    servidor.close((error) => error ? reject(error) : resolve());
  }));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function consultarLista() {
    const respuesta = await fetch(`${base}/api/turnos`);
    assert.equal(respuesta.status, 200);
    return respuesta.json();
  }

  async function cotizar(datos, cuerpoCrudo) {
    const respuesta = await fetch(`${base}/api/turnos/cotizacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpoCrudo ?? JSON.stringify(datos),
    });
    assert.match(respuesta.headers.get('content-type') || '', /application\/json/);
    return { respuesta, cuerpo: await respuesta.json() };
  }

  const listaInicial = await consultarLista();

  await t.test('GET / entrega el formulario HTML con sus campos principales', async () => {
    const respuesta = await fetch(`${base}/`);
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('content-type') || '', /text\/html/);
    const html = await respuesta.text();
    assert.match(html, /<form\b[^>]*\bid=["']turno-form["']/i);
    assert.match(html, /<input\b[^>]*\bid=["']nombreCliente["']/i);
    assert.match(html, /<input\b[^>]*\bid=["']precioBase["']/i);
  });

  await t.test('Los recursos CSS y JavaScript están disponibles', async () => {
    for (const [ruta, tipo] of [['/styles.css', /text\/css/], ['/app.js', /javascript/]]) {
      const respuesta = await fetch(`${base}${ruta}`);
      assert.equal(respuesta.status, 200, ruta);
      assert.match(respuesta.headers.get('content-type') || '', tipo, ruta);
      assert.ok((await respuesta.text()).trim().length > 0, ruta);
    }
  });

  await t.test('Cotizar un turno prioritario devuelve 200 y el recargo del 2 %', async () => {
    const { respuesta, cuerpo } = await cotizar({ precioBase: 100000, prioritario: true });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo, {
      precioBase: 100000,
      prioritario: true,
      porcentajeRecargo: 2,
      valorRecargo: 2000,
      totalPagar: 102000,
    });
  });

  for (const prioritario of [false, undefined]) {
    await t.test(`Cotizar con prioridad ${String(prioritario)} devuelve el precio base`, async () => {
      const { respuesta, cuerpo } = await cotizar({ precioBase: 100000, prioritario });
      assert.equal(respuesta.status, 200);
      assert.deepEqual(cuerpo, {
        precioBase: 100000,
        prioritario: false,
        porcentajeRecargo: 0,
        valorRecargo: 0,
        totalPagar: 100000,
      });
    });
  }

  await t.test('La cotización monetaria redondea al centavo', async () => {
    const { respuesta, cuerpo } = await cotizar({ precioBase: 99.99, prioritario: true });
    assert.equal(respuesta.status, 200);
    assert.equal(cuerpo.totalPagar, 101.99);
    assert.equal(cuerpo.valorRecargo, 2);
  });

  const casosInvalidos = [
    { nombre: 'cuerpo null', datos: null },
    { nombre: 'cuerpo arreglo', datos: [] },
    { nombre: 'cuerpo texto', datos: 'texto' },
    { nombre: 'precio ausente', datos: {} },
    ...[0, -1, null, '100000', 1e-9, 1000000001, 1.001].map((precioBase) => ({
      nombre: `precioBase ${JSON.stringify(precioBase)}`,
      datos: { precioBase, prioritario: true },
    })),
    { nombre: 'precio no finito', crudo: '{"precioBase":1e309,"prioritario":true}' },
    { nombre: 'prioridad como texto', datos: { precioBase: 100000, prioritario: 'true' } },
    { nombre: 'prioridad null', datos: { precioBase: 100000, prioritario: null } },
  ];

  for (const caso of casosInvalidos) {
    await t.test(`La cotización rechaza con 400: ${caso.nombre}`, async () => {
      const { respuesta, cuerpo } = await cotizar(caso.datos, caso.crudo);
      assert.equal(respuesta.status, 400);
      assert.equal(typeof cuerpo.mensaje, 'string');
      assert.ok(cuerpo.mensaje.length > 0);
      if (cuerpo.errores !== undefined) {
        assert.ok(Array.isArray(cuerpo.errores) && cuerpo.errores.length > 0);
      }
    });
  }

  await t.test('Las cotizaciones válidas e inválidas conservan la lista original', async () => {
    assert.deepEqual(await consultarLista(), listaInicial);
  });

  await t.test('La API sigue creando turnos y cotizar no consume el siguiente ID', async () => {
    const respuesta = await fetch(`${base}/api/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosTurno),
    });
    assert.equal(respuesta.status, 201);
    const creado = await respuesta.json();
    const ultimoId = listaInicial.reduce((maximo, turno) => Math.max(maximo, turno.id), 0);
    assert.equal(creado.id, ultimoId + 1);
    assert.equal(creado.totalPagar, 102000);
    const listaConRegistro = await consultarLista();
    await cotizar({ precioBase: 100000, prioritario: true });
    assert.deepEqual(await consultarLista(), listaConRegistro);
  });
});
