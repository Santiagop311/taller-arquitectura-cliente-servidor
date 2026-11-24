const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const app = require('../index');
const { obtenerEquipo } = require('../services/equipoService');

async function demostrar() {
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const resultados = [];

  async function solicitar(caso, metodo, ruta, esperado, cuerpo) {
    const respuesta = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    });
    const recibido = await respuesta.json();
    assert.equal(respuesta.status, esperado, caso);
    resultados.push({ caso, metodo, ruta, estado: respuesta.status, ...(cuerpo ? { enviado: cuerpo } : {}), recibido });
    console.log(`${respuesta.status} ${metodo} ${ruta} - ${caso}`);
    console.log(JSON.stringify(recibido, null, 2));
    return recibido;
  }

  const datos = {
    nombreCliente: 'Ana Torres',
    nombreMascota: 'Luna',
    tipoServicio: 'Consulta veterinaria',
    fechaHora: '2026-12-01T10:00:00-05:00',
    precioBase: 100000,
    prioritario: true,
  };

  try {
    await solicitar('Lista vacía al iniciar', 'GET', '/api/turnos', 200);
    const creado = await solicitar('Turno prioritario con recargo del 2 %', 'POST', '/api/turnos', 201, datos);
    assert.equal(creado.totalPagar, 102000);
    await solicitar('Consulta de turno existente', 'GET', `/api/turnos/${creado.id}`, 200);
    await solicitar('Precio cero rechazado', 'POST', '/api/turnos', 400, { ...datos, precioBase: 0 });
    await solicitar('Identificador inexistente', 'GET', '/api/turnos/999', 404);
    const { prioritario, ...sinPrioridad } = datos;
    const normal = await solicitar('Prioridad omitida, sin recargo', 'POST', '/api/turnos', 201, sinPrioridad);
    assert.equal(normal.totalPagar, datos.precioBase);
    await solicitar('Lista final; la petición inválida no guardó datos', 'GET', '/api/turnos', 200);

    if (process.argv.includes('--guardar')) {
      const evidencia = { generadoEn: new Date().toISOString(), equipo: obtenerEquipo(), resultados };
      await writeFile(path.join(__dirname, '../docs/evidencia.json'), JSON.stringify(evidencia, null, 2) + '\n');
      console.log('Evidencia guardada en docs/evidencia.json.');
    }
  } finally {
    await new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
  }
}

demostrar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
