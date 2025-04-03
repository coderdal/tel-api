const axios = require('axios');

class CaptchaSolver {
  static async solveCaptcha(imageBase64, isTurkTelekom = false) {
    try {
      const response = await axios.post('https://captcha-image-solver.p.rapidapi.com/gettext', {
        data: imageBase64,
        case: 'mixed',
        numeric: isTurkTelekom ? true : false,
        len_str: 6
      }, {
        headers: {
          'content-type': 'application/json',
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
        }
      });

      if (response.data && response.data.success == true) {
        return response.data.result;
      }

      throw new Error('Captcha çözülemedi');
    } catch (error) {
      console.error('Captcha çözme hatası:', error);
      throw error;
    }
  }
}

module.exports = CaptchaSolver; 