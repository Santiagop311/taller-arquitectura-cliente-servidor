function rutaNoEncontrada(req, res) {
  return res.status(404).json({ mensaje: 'Ruta no encontrada.' });
}

// Los cuatro argumentos identifican este controlador como middleware de errores.
function manejarError(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo contiene JSON mal formado.' });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'El cuerpo JSON supera el límite permitido de 16 KB.' });
  }

  // Los detalles internos se registran en el servidor y no se exponen al cliente.
  console.error('Error interno de la API:', error);
  return res.status(500).json({ mensaje: 'Ocurrió un error interno en el servidor.' });
}

module.exports = { rutaNoEncontrada, manejarError };
