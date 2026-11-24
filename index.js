const express = require('express');
const path = require('node:path');
const turnosRoutes = require('./routes/turnosRoutes');
const { rutaNoEncontrada, manejarError } = require('./controllers/errorController');

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use('/api/turnos', turnosRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.use(rutaNoEncontrada);
app.use(manejarError);

if (require.main === module) {
  const puerto = process.env.PORT || 3000;
  const servidor = app.listen(puerto, (error) => {
    if (!error) console.log(`VetTurnos disponible en http://localhost:${puerto}`);
  });

  servidor.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`El puerto ${puerto} está ocupado. Cierra el otro servidor o configura PORT con otro puerto.`);
    } else {
      console.error(`No se pudo iniciar el servidor: ${error.message}`);
    }
    process.exitCode = 1;
  });
}

module.exports = app;
