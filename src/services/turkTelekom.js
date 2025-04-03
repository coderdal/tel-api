const puppeteer = require('puppeteer');
const CaptchaSolver = require('./captchaSolver');
const { sleep } = require('../utils/utils');
const { getProxyConfig } = require('../utils/proxy');

class TurkTelekomService {
  static async checkDebt(phoneNumber) {
    const proxyConfig = getProxyConfig();
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        `--proxy-server=${proxyConfig.server}`
      ],
      executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath()
    });

    const directBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath()
    });

    try {
      const page = await browser.newPage();
            
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        window.navigator.chrome = {
          runtime: {},
        };
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['tr-TR', 'tr', 'en-US', 'en'],
        });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      });

      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setDefaultTimeout(60000);
      await page.setDefaultNavigationTimeout(60000);

      await page.goto('https://onlineislemler.turktelekom.com.tr/mps/portal?cmd=kkliPaketSatisGuest3D', {
        waitUntil: ['domcontentloaded', 'networkidle2'],
        timeout: 60000
      });

      await page.waitForSelector('input#msisdn', { visible: true });

      await page.type('input#msisdn', phoneNumber, { delay: 100 });

      await page.waitForSelector('img#img_captcha', { visible: true });
      await sleep(250);

      const captchaElement = await page.$('img#img_captcha');
      const captchaBase64 = await captchaElement.screenshot({
        encoding: 'base64'
      });

      let captchaSolution = await CaptchaSolver.solveCaptcha(captchaBase64);
      captchaSolution = captchaSolution.replace(/[^0-9]/g, '');

      await page.type('input#authCode', captchaSolution, { delay: 100 });
      await sleep(500);

      await page.click('input#submit1');
      await sleep(3000);

      let result = {
        hasDebt: false,
        invalid: true
      };

      try {
        await page.waitForSelector('#modal-body-content p', { timeout: 3000 });
        const content = await page.$eval('#modal-body-content p', el => el.textContent).catch(() => "");
        if (content && (content.includes('faturasız hat sahipleri') || content.includes('gerçekleştirilemiyor') || content.includes('Güvenlik kodunu'))) {
          await browser.close();
          await directBrowser.close();
          return result;
        }
      } catch (error) {}
      
      await page.waitForSelector('#pgw-iframe', { timeout: 8000 });
      
      const iframeSrc = await page.$eval('#pgw-iframe', iframe => iframe.src);
      
      const paymentPage = await directBrowser.newPage();
      
      await paymentPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await paymentPage.goto(iframeSrc, { 
        waitUntil: 'networkidle0',
        timeout: 60000
      });
      
      await paymentPage.waitForSelector('body', { timeout: 10000 });
      
      await paymentPage.waitForSelector('.info-error p, #offer_0, #offer_1, #offer_2, #offer_3, #modal-body-content', { 
        timeout: 30000 
      }).catch(e => console.log("Seçici bulunamadı:", e.message));

      await sleep(1000);

      try {
        const errorContent = await paymentPage.$eval('.info-error p', el => el.textContent).catch(() => "");

        if (errorContent && errorContent.includes('Birikmiş telsiz kullanım ücreti borcu')) {
          result = {
            hasDebt: true,
            message: 'Vergi borcu bulunmaktadır'
          };
        }
      } catch (error) {
        console.log("Hata içeriği okuma hatası:", error.message);
      }

      try {
        const offerContent = await paymentPage.$eval('#offer_0, #offer_1, #offer_2, #offer_3', el => el.textContent).catch(() => "");
        
        if (offerContent) {
          result = {
            hasDebt: false,
            message: 'Vergi borcu bulunmamaktadır'
          };
        }
      } catch (error) {
        console.log("Teklif içeriği okuma hatası:", error.message);
      }

      await browser.close();
      await directBrowser.close();
      return result;
    } catch (error) {
      await browser.close();
      await directBrowser.close();
      console.error('TurkTelekom service error:', error);
      
      if (error.name === 'TimeoutError') {
        throw new Error('Sayfa yüklenme zaman aşımına uğradı. Lütfen tekrar deneyin.');
      }
      throw new Error('Sorgulama sırasında bir hata oluştu: ' + error.message);
    }
  }
}

module.exports = TurkTelekomService; 