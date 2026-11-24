const configuracion = require('../config/equipo.json');

function obtenerEquipo() {
  // N es el número de lista del primer apellido, no la cantidad de integrantes.
  const integrantes = configuracion.integrantes
    .map((integrante) => ({ ...integrante }))
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));

  const N = integrantes[0].numeroLista;
  return {
    grupo: configuracion.grupo,
    integrantes,
    N,
    porcentajeRecargo: N * 2,
  };
}

module.exports = { obtenerEquipo };
