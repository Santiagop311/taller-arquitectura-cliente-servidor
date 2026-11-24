const { obtenerEquipo } = require('./equipoService');

function crearGestorTurnos(N) {
  if (!Number.isSafeInteger(N) || N <= 0) {
    throw new Error('N debe ser un número de lista entero y positivo.');
  }

  const turnos = [];
  let siguienteId = 1;
  const porcentajeEquipo = N * 2;

  function listarTurnos() {
    return turnos.map((turno) => ({ ...turno }));
  }

  function obtenerTurnoPorId(id) {
    const turno = turnos.find((registro) => registro.id === id);
    return turno ? { ...turno } : undefined;
  }

  function cotizarTurno(datos) {
    const prioritario = datos.prioritario === true;
    const porcentajeRecargo = prioritario ? porcentajeEquipo : 0;
    // Trabajamos con centavos enteros y redondeamos el recargo al centavo.
    const precioEnCentavos = Math.round(datos.precioBase * 100);
    const recargoEnCentavos = Math.round(precioEnCentavos * porcentajeRecargo / 100);
    return {
      precioBase: datos.precioBase,
      prioritario,
      porcentajeRecargo,
      valorRecargo: recargoEnCentavos / 100,
      totalPagar: (precioEnCentavos + recargoEnCentavos) / 100,
    };
  }

  function crearTurno(datos) {
    const turno = {
      id: siguienteId++,
      nombreCliente: datos.nombreCliente,
      nombreMascota: datos.nombreMascota,
      tipoServicio: datos.tipoServicio,
      fechaHora: datos.fechaHora,
      ...cotizarTurno(datos),
    };

    turnos.push(turno);
    return { ...turno };
  }

  return { listarTurnos, obtenerTurnoPorId, crearTurno, cotizarTurno };
}

// El arreglo vive durante la ejecución; reiniciar el servidor lo vacía.
const gestor = crearGestorTurnos(obtenerEquipo().N);
module.exports = { ...gestor, crearGestorTurnos };
