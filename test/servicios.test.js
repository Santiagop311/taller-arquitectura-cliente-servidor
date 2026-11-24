const test = require('node:test');
const assert = require('node:assert/strict');
const { crearGestorTurnos } = require('../services/turnosService');
const { obtenerEquipo } = require('../services/equipoService');

const datos = {
  nombreCliente: 'Ana Torres',
  nombreMascota: 'Luna',
  tipoServicio: 'Consulta veterinaria',
  fechaHora: '2026-12-01T09:00:00-05:00',
  precioBase: 100000,
};

test('El equipo oficial determina N = 1 y un recargo del 2 %', () => {
  const equipo = obtenerEquipo();
  assert.equal(equipo.grupo, 'jueves');
  assert.equal(equipo.N, 1);
  assert.equal(equipo.porcentajeRecargo, 2);
  assert.deepEqual(equipo.integrantes.map(({ numeroLista }) => numeroLista), [1, 10, 18, 24]);
});

test('La fórmula usa el parámetro N, incluso si cambia entre equipos', () => {
  const equipoUno = crearGestorTurnos(1);
  const equipoSiete = crearGestorTurnos(7);
  assert.equal(equipoUno.crearTurno({ ...datos, prioritario: true }).totalPagar, 102000);
  const turno = equipoSiete.crearTurno({ ...datos, prioritario: true });
  assert.equal(turno.porcentajeRecargo, 14);
  assert.equal(turno.valorRecargo, 14000);
  assert.equal(turno.totalPagar, 114000);
});

test('Sin prioridad, false u omitida, se conserva el precio base', () => {
  const gestor = crearGestorTurnos(7);
  for (const prioridad of [{ prioritario: false }, {}]) {
    const turno = gestor.crearTurno({ ...datos, ...prioridad });
    assert.equal(turno.prioritario, false);
    assert.equal(turno.porcentajeRecargo, 0);
    assert.equal(turno.valorRecargo, 0);
    assert.equal(turno.totalPagar, 100000);
  }
});

test('Los montos monetarios se redondean a dos decimales', () => {
  const gestor = crearGestorTurnos(1);
  const turno = gestor.crearTurno({ ...datos, precioBase: 99.99, prioritario: true });
  assert.equal(turno.totalPagar, 101.99);
});

test('El servicio almacena turnos y asigna identificadores únicos', () => {
  const gestor = crearGestorTurnos(1);
  assert.deepEqual(gestor.listarTurnos(), []);
  const primero = gestor.crearTurno(datos);
  const segundo = gestor.crearTurno({ ...datos, nombreMascota: 'Toby' });
  assert.notEqual(primero.id, segundo.id);
  assert.equal(gestor.listarTurnos().length, 2);
  assert.deepEqual(gestor.obtenerTurnoPorId(primero.id), primero);
  assert.ok(gestor.obtenerTurnoPorId(999999) == null);
});
