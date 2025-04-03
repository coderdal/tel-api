const express = require('express');
const router = express.Router();
const TurkTelekomService = require('../services/turkTelekom');
const TurkcellService = require('../services/turkcell');

router.get('/check', async (req, res, next) => {
  try {
    const { operator, tel } = req.query;

    if (!operator || !tel) {
      return res.status(400).json({
        status: 'error',
        message: 'Operator ve telefon numarası gerekli'
      });
    }

    const phoneRegex = /^5[0-9]{9}$/;
    if (!phoneRegex.test(tel)) {
      return res.status(400).json({
        status: 'error',
        message: 'Geçersiz telefon numarası formatı'
      });
    }

    let result;
    switch (operator.toLowerCase()) {
      case 'turktelekom':
        result = await TurkTelekomService.checkDebt(tel);
        break;
      case 'turkcell':
        result = await TurkcellService.checkPackagesAndDebt(tel);
        break;
      default:
        return res.status(400).json({
          status: 'error',
          message: 'Geçersiz operatör'
        });
    }

    res.json({
      status: 'success',
      data: result
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router; 