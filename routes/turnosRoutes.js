const express = require('express');
const turnosController = require('../controllers/turnosController');

const router = express.Router();

router.get('/', turnosController.listarTurnos);
router.get('/:id', turnosController.obtenerTurno);
router.post('/', turnosController.crearTurno);
router.post('/cotizacion', turnosController.cotizarTurno);

module.exports = router;
