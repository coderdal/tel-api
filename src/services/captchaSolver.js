const axios = require('axios');

class CaptchaSolver {
  static async solveCaptcha(imageBase64) {
    const formData = new URLSearchParams();
    formData.append('base64_content', imageBase64);
    try {
      const response = await axios.post('https://image-captcha-solver.p.rapidapi.com/recognizeBase64', formData, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
        }
      });

      if (response.data && response.data.status === 'success') {
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