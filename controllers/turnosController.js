const turnosService = require('../services/turnosService');

function esFechaHoraValida(valor) {
  if (typeof valor !== 'string') return false;

  // Exigimos una zona horaria para que la cita represente un instante inequívoco.
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-](\d{2}):(\d{2}))$/.exec(valor);
  if (!partes) return false;

  const [, anioTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto] = partes;
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  const segundo = Number(segundoTexto || 0);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) return false;
  if (hora > 23 || minuto > 59 || segundo > 59) return false;
  if (partes[8] !== 'Z' && (Number(partes[9]) > 23 || Number(partes[10]) > 59)) return false;

  // Date.parse por sí solo normaliza algunas fechas imposibles, como el 30 de febrero.
  return Number.isFinite(Date.parse(valor));
}

function listarTurnos(req, res) {
  return res.status(200).json(turnosService.listarTurnos());
}

function obtenerTurno(req, res) {
  const idTexto = req.params.id;
  const id = Number(idTexto);
  if (!/^[1-9]\d*$/.test(idTexto) || !Number.isSafeInteger(id)) {
    return res.status(404).json({ mensaje: 'Turno no encontrado.' });
  }

  const turno = turnosService.obtenerTurnoPorId(id);
  if (!turno) return res.status(404).json({ mensaje: 'Turno no encontrado.' });
  return res.status(200).json(turno);
}

function validarTarifa(datos) {
  const errores = [];
  const precio = datos.precioBase;
  if (typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0 || precio > 1_000_000_000) {
    errores.push('precioBase debe ser un número mayor que cero y menor o igual a 1000000000.');
  } else if (Math.round(precio * 100) < 1 || Math.abs(precio * 100 - Math.round(precio * 100)) > 1e-6) {
    errores.push('precioBase debe tener como máximo dos decimales.');
  }
  if (datos.prioritario !== undefined && typeof datos.prioritario !== 'boolean') {
    errores.push('prioritario debe ser true o false.');
  }
  return errores;
}

function cotizarTurno(req, res) {
  const datos = req.body;
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return res.status(400).json({ mensaje: 'El cuerpo debe ser un objeto JSON.' });
  }
  const errores = validarTarifa(datos);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos de entrada inválidos.', errores });
  }
  return res.status(200).json(turnosService.cotizarTurno(datos));
}

function crearTurno(req, res) {
  const datos = req.body;
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    return res.status(400).json({ mensaje: 'El cuerpo debe ser un objeto JSON.' });
  }

  const errores = [];
  for (const campo of ['nombreCliente', 'nombreMascota', 'tipoServicio']) {
    if (typeof datos[campo] !== 'string' || datos[campo].trim() === '') {
      errores.push(`${campo} es obligatorio y debe ser un texto no vacío.`);
    }
  }

  if (!esFechaHoraValida(datos.fechaHora)) {
    errores.push('fechaHora debe ser una fecha y hora ISO válida con zona horaria, por ejemplo 2026-12-01T10:00:00-05:00.');
  }

  errores.push(...validarTarifa(datos));

  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos de entrada inválidos.', errores });
  }

  // Solo estos campos llegan al servicio; el cliente no controla id ni totalPagar.
  const turno = turnosService.crearTurno({
    nombreCliente: datos.nombreCliente.trim(),
    nombreMascota: datos.nombreMascota.trim(),
    tipoServicio: datos.tipoServicio.trim(),
    fechaHora: datos.fechaHora,
    precioBase: datos.precioBase,
    prioritario: datos.prioritario ?? false,
  });

  return res.location(`/api/turnos/${turno.id}`).status(201).json(turno);
}

module.exports = { listarTurnos, obtenerTurno, crearTurno, cotizarTurno };
