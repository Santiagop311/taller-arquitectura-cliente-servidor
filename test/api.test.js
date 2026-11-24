const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../index');

const datosValidos = {
  nombreCliente: 'Ana Torres',
  nombreMascota: 'Luna',
  tipoServicio: 'Consulta veterinaria',
  fechaHora: '2026-12-01T09:00:00-05:00',
  precioBase: 100000,
  prioritario: true,
};

test('La API cumple el contrato HTTP y permanece disponible ante entradas inválidas', async (t) => {
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    servidor.close((error) => error ? reject(error) : resolve());
  }));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  let cantidadCreada = 0;
  let primerTurno;

  async function peticion(ruta, opciones = {}) {
    const respuesta = await fetch(`${base}${ruta}`, opciones);
    assert.match(respuesta.headers.get('content-type') || '', /application\/json/);
    return { respuesta, cuerpo: await respuesta.json() };
  }

  function post(datos) {
    return peticion('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  }

  async function comprobarRechazo(datos) {
    const { respuesta, cuerpo } = await post(datos);
    assert.equal(respuesta.status, 400);
    assert.equal(typeof cuerpo.mensaje, 'string');
    assert.ok(cuerpo.mensaje.length > 0);
  }

  await t.test('GET /api/turnos devuelve 200 y una lista vacía inicialmente', async () => {
    const { respuesta, cuerpo } = await peticion('/api/turnos');
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo, []);
  });

  await t.test('POST prioritario devuelve 201, el turno y el recargo real del equipo', async () => {
    const { respuesta, cuerpo } = await post(datosValidos);
    assert.equal(respuesta.status, 201);
    assert.ok(Number.isSafeInteger(cuerpo.id) && cuerpo.id > 0);
    assert.equal(respuesta.headers.get('location'), `/api/turnos/${cuerpo.id}`);
    assert.equal(cuerpo.porcentajeRecargo, 2);
    assert.equal(cuerpo.valorRecargo, 2000);
    assert.equal(cuerpo.totalPagar, 102000);
    assert.equal(cuerpo.nombreMascota, 'Luna');
    primerTurno = cuerpo;
    cantidadCreada += 1;
  });

  await t.test('GET /api/turnos/:id devuelve 200 y el mismo objeto creado', async () => {
    const { respuesta, cuerpo } = await peticion(`/api/turnos/${primerTurno.id}`);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(cuerpo, primerTurno);
  });

  for (const prioritario of [false, undefined]) {
    await t.test(`POST con prioritario ${String(prioritario)} conserva el precio base`, async () => {
      const datos = { ...datosValidos, prioritario };
      const { respuesta, cuerpo } = await post(datos);
      assert.equal(respuesta.status, 201);
      assert.equal(cuerpo.prioritario, false);
      assert.equal(cuerpo.totalPagar, datos.precioBase);
      assert.equal(cuerpo.porcentajeRecargo, 0);
      assert.equal(cuerpo.valorRecargo, 0);
      assert.notEqual(cuerpo.id, primerTurno.id);
      cantidadCreada += 1;
    });
  }

  await t.test('El cliente no puede asignar el identificador ni el precio calculado', async () => {
    const { respuesta, cuerpo } = await post({
      ...datosValidos,
      id: 999999,
      porcentajeRecargo: 99,
      valorRecargo: 1,
      totalPagar: 1,
    });
    assert.equal(respuesta.status, 201);
    assert.notEqual(cuerpo.id, 999999);
    assert.equal(cuerpo.porcentajeRecargo, 2);
    assert.equal(cuerpo.valorRecargo, 2000);
    assert.equal(cuerpo.totalPagar, 102000);
    cantidadCreada += 1;
  });

  await t.test('Los textos se guardan sin espacios sobrantes', async () => {
    const { respuesta, cuerpo } = await post({
      ...datosValidos,
      nombreCliente: '  Ana Torres  ',
      nombreMascota: '  Luna  ',
      tipoServicio: '  Consulta veterinaria  ',
    });
    assert.equal(respuesta.status, 201);
    assert.equal(cuerpo.nombreCliente, 'Ana Torres');
    assert.equal(cuerpo.nombreMascota, 'Luna');
    assert.equal(cuerpo.tipoServicio, 'Consulta veterinaria');
    cantidadCreada += 1;
  });

  for (const campo of ['nombreCliente', 'nombreMascota', 'tipoServicio', 'fechaHora', 'precioBase']) {
    await t.test(`POST sin el campo obligatorio ${campo} devuelve 400 descriptivo`, async () => {
      const datos = { ...datosValidos };
      delete datos[campo];
      const { respuesta, cuerpo } = await post(datos);
      assert.equal(respuesta.status, 400);
      assert.equal(typeof cuerpo.mensaje, 'string');
      assert.ok(Array.isArray(cuerpo.errores) && cuerpo.errores.length > 0);
    });
  }

  for (const campo of ['nombreCliente', 'nombreMascota', 'tipoServicio']) {
    for (const valor of ['', '   ', null, 123]) {
      await t.test(`POST rechaza ${campo} = ${JSON.stringify(valor)}`, async () => {
        await comprobarRechazo({ ...datosValidos, [campo]: valor });
      });
    }
  }

  for (const precioBase of [0, -10, null, '100000', true, [], {}, 1.001, 0.000000001, 1000000001]) {
    await t.test(`POST rechaza precioBase = ${JSON.stringify(precioBase)}`, async () => {
      await comprobarRechazo({ ...datosValidos, precioBase });
    });
  }

  for (const prioritario of ['true', 'false', 1, null]) {
    await t.test(`POST rechaza prioritario = ${JSON.stringify(prioritario)}`, async () => {
      await comprobarRechazo({ ...datosValidos, prioritario });
    });
  }

  for (const fechaHora of ['no es una fecha', '2026-02-30T09:00:00Z', '2026-12-01T25:00:00Z', '2026-12-01', null]) {
    await t.test(`POST rechaza fechaHora = ${JSON.stringify(fechaHora)}`, async () => {
      await comprobarRechazo({ ...datosValidos, fechaHora });
    });
  }

  for (const cuerpo of [null, [], 'texto']) {
    await t.test(`POST rechaza un cuerpo JSON que no sea objeto: ${JSON.stringify(cuerpo)}`, async () => {
      await comprobarRechazo(cuerpo);
    });
  }

  await t.test('POST sin cuerpo devuelve 400 JSON', async () => {
    const { respuesta, cuerpo } = await peticion('/api/turnos', { method: 'POST' });
    assert.equal(respuesta.status, 400);
    assert.equal(typeof cuerpo.mensaje, 'string');
  });

  await t.test('JSON mal formado devuelve 400 JSON', async () => {
    const { respuesta, cuerpo } = await peticion('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"nombreCliente":',
    });
    assert.equal(respuesta.status, 400);
    assert.equal(typeof cuerpo.mensaje, 'string');
  });

  await t.test('Un cuerpo que supera el límite devuelve 413 JSON', async () => {
    const { respuesta, cuerpo } = await post({ ...datosValidos, nombreCliente: 'a'.repeat(20000) });
    assert.equal(respuesta.status, 413);
    assert.equal(typeof cuerpo.mensaje, 'string');
  });

  for (const id of ['999999', 'abc', '1abc', '0', '-1']) {
    await t.test(`GET de identificador inexistente o ambiguo ${id} devuelve 404`, async () => {
      const { respuesta, cuerpo } = await peticion(`/api/turnos/${id}`);
      assert.equal(respuesta.status, 404);
      assert.equal(typeof cuerpo.mensaje, 'string');
    });
  }

  await t.test('Una ruta desconocida devuelve 404 JSON', async () => {
    const { respuesta, cuerpo } = await peticion('/api/ruta-inexistente');
    assert.equal(respuesta.status, 404);
    assert.equal(typeof cuerpo.mensaje, 'string');
  });

  await t.test('Los errores no guardan registros parciales ni detienen el servidor', async () => {
    const { respuesta, cuerpo } = await peticion('/api/turnos');
    assert.equal(respuesta.status, 200);
    assert.equal(cuerpo.length, cantidadCreada);
    assert.equal(new Set(cuerpo.map(({ id }) => id)).size, cantidadCreada);
    assert.deepEqual(cuerpo[0], primerTurno);
  });
});
