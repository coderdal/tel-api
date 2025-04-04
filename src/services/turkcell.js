const puppeteer = require('puppeteer');
const CaptchaSolver = require('./captchaSolver');
const { sleep } = require('../utils/utils');
const { getProxyConfig } = require('../utils/proxy');

class TurkcellService {
  static async checkPackagesAndDebt(phoneNumber) {
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

    try {
      phoneNumber = phoneNumber.substring(1);
        
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

      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setDefaultTimeout(60000);
      await page.setDefaultNavigationTimeout(60000);

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      });

      await page.goto('https://www.turkcell.com.tr/yukle/tl-paket-yukle', {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 45000
      });

      try {
        await page.waitForSelector('efilli-layout-dynamic', { timeout: 3000 });
        
        await page.evaluate(() => {
          const shadowHost = document.querySelector('efilli-layout-dynamic');
          if (shadowHost) {
            const shadowRoot = shadowHost.shadowRoot;
            const acceptButton = shadowRoot.querySelector('[data-name="kabul et"]');
            if (acceptButton) {
              acceptButton.click();
            }
          }
        });
      } catch (error) {
        console.log('Cookie popup bulunamadı veya zaten kabul edilmiş olabilir:', error);
      }

      await sleep(250);

      await page.waitForSelector('input[class*="maskedInput__input"]', { timeout: 12000 });

      await page.type('input[class*="maskedInput__input"]', phoneNumber, { delay: 75 });
      await sleep(1500);

      let captchaElement = null;
      await page.waitForSelector("[alt='captcha']", {
        timeout: 10000
      });
      captchaElement = await page.$("[alt='captcha']");

      if (!captchaElement) {
        throw new Error("Captcha elementi bulunamadı");
      }

      const captchaBase64 = await captchaElement.screenshot({
        encoding: 'base64'
      });

      const captchaSolution = await CaptchaSolver.solveCaptcha(captchaBase64);

      await page.type('div[class*="AppCaptchaWrapper__captchaControl"] input', captchaSolution, { delay: 50 });
      await sleep(500);

      await page.waitForSelector('button[class*="captchaButton"]', { timeout: 8000 });
      await page.click('button[class*="captchaButton"]');

      await page.evaluate(() => {
        const button = document.querySelector('button[class*="captchaButton"]');
        if (button) {
          button.click();
        }
      });
      await sleep(1000);

      let result = {
        hasDebt: false,
        debtAmount: null,
        invalid: true
      };

      try {
          const packagesList = [];
          await page.waitForSelector('div[class*="package-card_colClassName"]', {
            timeout: 10000
          });

          try {
            await page.waitForSelector('button[class*="select-package-step"]', { timeout: 2000 });
            await page.click('button[class*="select-package-step"]');
          } catch (error) {}

          const packages = await page.$$('div[class*="package-card_colClassName"]');
          for (const pkg of packages) {
            const packageName = await pkg.$eval('div[class*="content-title"]', el => el.textContent);
            packagesList.push(packageName);
          }

          console.log(packagesList);
    
          await page.click('div[class*="package-card_colClassName"]');
          await sleep(500);
    
          await page.waitForSelector('button[class*="basket-amount-bar"]', { timeout: 4000 });
          await page.click('button[class*="basket-amount-bar"]');
          await sleep(500);
    
          const debtPopup = await page.waitForSelector('.ant-modal-content', { 
            timeout: 8000 
          }).then(() => page.$eval('.ant-modal-content', el => el.textContent))
            .catch(() => null);
    
          result = {
            hasDebt: false,
            debtAmount: null,
            packages: packagesList
          };
    
          if (debtPopup) {
            const debtMatch = debtPopup.match(/borcu (\d+) TL/);
            if (debtMatch) {
              result.hasDebt = true;
              result.debtAmount = parseInt(debtMatch[1]);
              result.currency = "TL";
            } else if (debtPopup.includes("Güvenlik kodu")) {
              console.log("Güvenlik kodu");
              
              result.hasDebt = false;
              result.debtAmount = null;
              result.invalid = true;
            }
          }
      } catch (error) {
      }

      await browser.close();
      return result;

    } catch (error) {
      await browser.close();
      console.error('Turkcell service error:', error);
      
      if (error.name === 'TimeoutError') {
        throw new Error('Sayfa yüklenme zaman aşımına uğradı. Lütfen tekrar deneyin.');
      }
      throw new Error('Sorgulama sırasında bir hata oluştu: ' + error.message);
    }
  }
}

module.exports = TurkcellService; 