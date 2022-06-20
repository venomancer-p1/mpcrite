/**
 * npm module deps
 */
const express = require('express');
const delay = require('delay');
const axios = require('axios');
const unirest = require('unirest')
const recaptcha = require('./reCaptcha')

var crypto = require('crypto');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

const protonmail = require('mail-proton-api');
const cheerio = require('cheerio');

var randomWords = require('random-words');
const name_list = fs.readFileSync(path.join(__dirname, 'name_list.txt')).toString().replace(/\r\n/g, '\n').split('\n');
const proxies = fs.readFileSync(path.join(__dirname, 'proxies.txt')).toString().replace(/\r\n/g, '\n').split('\n');
var UA = require('user-agents');

var host = process.env.HOST || '0.0.0.0';
var port = process.env.PORT || 8000;


const puppeteer = require('puppeteer');
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const puppeteerS = addExtra(puppeteer);

const stealth = StealthPlugin();
puppeteerS.use(stealth);



//

/*
const start = require('./proxy-scraper.js');
var ALL_ALIVE = [];
var timeout;
async function update() {
  if (timeout) clearTimeout(timeout);
  const t1 = new Date();
  await start(ALL_ALIVE)
  await delay(300000)
  timeout = setTimeout(update, Math.max(0, 1000 - new Date + t1));
}
update();
*/

//setInterval(function () { console.log(ALL_ALIVE) }, 30000);
/**
 * helps
 */
function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
/**
 * local deps
 */
const { createError, log } = require('./helpers');
const middlewares = require('./middleware');
const { del } = require('express/lib/application');

/**
 * bootstrap express app
 */
const app = new express();

const extendTimeoutMiddleware = (req, res, next) => {
  const space = ' ';
  let isFinished = false;
  let isDataSent = false;

  // Only extend the timeout for API requests
  if (!req.url.includes('/p/create') && !req.url.includes('/p/access') && !req.url.includes('/p/dog') && !req.url.includes('/p/cookie')) {
    next();
    return;
  }

  res.once('finish', () => {
    isFinished = true;
  });

  res.once('end', () => {
    isFinished = true;
  });

  res.once('close', () => {
    isFinished = true;
  });

  res.on('data', (data) => {
    // Look for something other than our blank space to indicate that real
    // data is now being sent back to the client.
    if (data !== space) {
      isDataSent = true;
    }
  });

  const waitAndSend = () => {
    setTimeout(() => {
      // If the response hasn't finished and hasn't sent any data back....
      if (!isFinished && !isDataSent) {
        // Need to write the status code/headers if they haven't been sent yet.
        /*if (!res.headersSent) {
          res.writeHead(202, { 'Content-Type': 'text/html' });
        }*/

        res.write(space);

        // Wait another 15 seconds
        waitAndSend();
      }
    }, 15000);
  };

  waitAndSend();
  next();
};

const handleCloseBrowser = (req, res, browser) => {

  res.setTimeout(150000, function () {
    console.log('Browser Timedout');
    browser.close()
    res.sendStatus(408);
    return res.end();
  });
  req.on('close', () => {
    console.log('Browser Closed')
    browser.close()
    return res.end();
  });
  req.on('end', () => {
    console.log('Browser Ended');
    browser.close()
    return res.end();
  });

  return;

};

app.use(extendTimeoutMiddleware);
/*app.get('/wait', async (req, res) => {
  await delay(125000);
  let ip = await axios.get('https://api.my-ip.io/ip');
  console.log(ip.data)
  res.write('{"extendTimeoutMiddleware": "works"}');
  res.end();
})*/
app.get('/ip', async (req, res) => {
  try {
    let ip = await axios.get('https://api.my-ip.io/ip');
    res.status(200).send(ip.data);
  } catch (error) {
    console.log(error)
    res.status(500).send('server Error');
  }
})
app.get('/p/mail', async (req, res) => {
  /*if (!req.query.email || !req.query.pass) {
    res.set('Content-Type', 'text/html');
    return res.status(404).send('<h3>Not Found<h3><br><strong>Please use /p/mail?email=YOUR_EMAIL&pass=YOUR_PASS</strong>')
  }*/
  res.writeHead(202, { 'Content-Type': 'application/json' });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      //'--headless=chrome',
      '--no-sandbox'
    ],
    //ignoreDefaultArgs: ["--enable-automation"],//  ./myUserDataDir
  });
  console.log('Browser Opened');
  handleCloseBrowser(req, res, browser);

  try {

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    const blockedResourceTypes = [
      'image',
      'media',
      'font',
      'texttrack',
      'object',
      'beacon',
      'csp_report',
      'imageset',
      'iframe',
      'imgur'
    ];

    const skippedResources = [
      'quantserve',
      'adzerk',
      'doubleclick',
      'adition',
      'exelator',
      'sharethrough',
      'cdn.api.twitter',
      'google-analytics',
      'googletagmanager',
      'fontawesome',
      'facebook',
      'analytics',
      'optimizely',
      'clicktale',
      'mixpanel',
      'zedo',
      'clicksor',
      'tiqcdn',
      'iframe',
      'sharecool',
      'imgur',
      'script'
    ];

    await page.setRequestInterception(true);
    page.on('request', request => {
      const requestUrl = request._url.split('?')[0].split('#')[0];
      if (
        blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
        skippedResources.some(resource => requestUrl.indexOf(resource) !== -1)
      ) {
        console.log('BLOCADOOOO')
        request.abort();
      } else {
        request.continue();
      }
    });
    /*await page.setRequestInterception(true);
    page.on('request', request => {
      const requestUrl = request._url.split('?')[0].split('#')[0];
      if (
        blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
        skippedResources.some(resource => requestUrl.indexOf(resource) !== -1)
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });*/
    const userAgent = new UA();
    await page.setUserAgent(userAgent.toString())
    let start = Date.now();
    await page.goto(`https://account.proton.me/login`, { timeout: 25000, waitUntil: 'networkidle2' });
    await page.waitForSelector('#username', { visible: true });
    await page.type('#username', 'albissadavaydavay@proton.me', { delay: 10 });
    await page.type('#password', 'ahamilikeit*', { delay: 10 });
    await page.click('button[type="submit"]', { button: 'left' });
    await page.waitForSelector('div[data-shortcut-target="item-container"]', { visible: true, timeout: 40000 });
    //await page.click('div[data-shortcut-target="item-container"]', { button: 'left' });
    //await page.waitForSelector('.message-iframe > iframe', { visible: true, timeout: 40000 });
    let stop = Date.now();
    console.log(`DONE ${(stop - start) / 1000}s`)
    //let mail_body = await page.evaluate(() => { return document.querySelector('.message-iframe > iframe').contentWindow.document.querySelector('table').innerText })
    //console.log(mail_body);
    res.write(`DONE ${(stop - start) / 1000}s`);
    res.end();

  } catch (error) {
    console.log(error)
    res.write(`{"status": "failed", "reason":"Internal Error"}`);
    res.end();
  } finally {
    console.log('browser closed')
    browser.close()
  }


  await delay(5000);
  res.write(`{"status": "success"}`);
  return res.end();

})

app.get('/p/create', async (req, res) => {

  res.writeHead(202, { 'Content-Type': 'application/json' });
  if (!req.query.email || !req.query.pass) {
    res.set('Content-Type', 'text/html');
    return res.status(404).send('<h3>Not Found<h3><br><strong>Please use /p/create?email=YOUR_EMAIL&pass=YOUR_PASS</strong>')
  }

  const extension = path.join(__dirname, 'callbackHooker')
  /*const chrome = path.join(__dirname, 'GoogleChromePortable', 'App', 'Chrome-bin', 'chrome.exe').replaceAll('\\', '/')
  console.log('extension path')
  console.log(extension)
  console.log('chrome path', typeof chrome)
  console.log(chrome)*/
  const browser = await puppeteerS.launch({
    headless: true,
    slowMo: 10,
    args: [
      `--headless=chrome`,
      '--disable-web-security',
      '--ignore-certificate-errors',
      //`--proxy-server=http://104.200.18.76:3128`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--ignore-certifcate-errors-spki-list",
      "--disable-accelerated-2d-canvas",
      "--no-zygote",
      "--no-first-run",
      "--disable-dev-shm-usage",
      //'--disk-cache-size=0',
      //'--disable-web-security',
      //'--disable-features=IsolateOrigins,site-per-process',
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      //'--no-sandbox'
    ],
    ignoreDefaultArgs: ["--enable-automation"],//  ./myUserDataDir
    userDataDir: './myUserDataDir'//MUDARRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR <-------------------------------------------------------------------------mudar no deploy
  })
  console.log('Init');
  res.setTimeout(150000, function () {
    console.log('Request has timed out.');
    browser.close()
    res.sendStatus(408);
  });
  req.on('close', () => {
    console.log('browser closed')
    browser.close()
    return res.end();
  });
  req.on('end', () => {
    console.log('browser closed');
    browser.close()
    return res.end();
  });

  try {

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    const userAgent = new UA();
    await page.setUserAgent(userAgent.toString())

    //APPENDICE
    await page.setRequestInterception(true);
    var index = 0;
    let alive = await axios.get(`https://entrevidato.herokuapp.com/get`);
    let d = alive.data;
    var proxy_ = d.proxy
    page.on('request', async request => {
      console.log('ALL', index)
      if (request.url().includes('api/vpn/location')) {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: `{"Code":1000,"IP":"185.153.176.180","Lat":-23.5335,"Long":-46.635899999999999,"Country":"BR","ISP":"Tefincom S.A."}`
        })
      } else if (request.url().includes('api/v4/users')) {

        if (index != 0) {

          //useProxy(request, 'socks5://127.0.0.1:9052');


          let url_ = request.url();
          let data_ = request.postData();
          let headers_ = request.headers();
          request.abort()
          //62ae4f79883d62763d27004f
          //62ae5651883d62763d270050
          var resp = await unirest.post(url_).proxy(`http://scrapingdog:${proxies[Math.floor(Math.random() * proxies.length)]}-country=random@proxy.scrapingdog.com:8081`).headers(headers_).send(JSON.parse(data_))
          console.log(resp.body)
          /*var headers = headers_;
          var data = JSON.parse(data_);
          console.log('tentando')
          var resp = await unirest.post('https://api.scrapingdog.com/scrape?api_key=62ae1ad7327c777636c634e8&custom_headers=true&dynamic=false&url=' + url_).headers(headers).send(data)
          
          console.log('tentadu')
          console.log(resp.body)*/


          //console.log(headers_)
          //request.abort()
          /*console.log('Proxied')
          console.log(`https://api.webscrapingapi.com/v1?url=${url_}&api_key=ez6dZolJCzzW6gnWYkYQ7ZvXEbUaQZys&device=desktop&proxy_type=residential&timeout=200&wait_for=10000&keep_headers=1`)
          console.log(request.method())*/

          //request.continue({ url: `https://api.webscrapingapi.com/v1?url=${url_}&api_key=ez6dZolJCzzW6gnWYkYQ7ZvXEbUaQZys&device=desktop&proxy_type=residential&timeout=200&wait_for=10000&keep_headers=1`, method: 'POST' })
        } else {
          request.continue();
          index++;
        }
        console.log('a', index)
      }
      else if (request.url().includes('unsupported.')) {
        console.log('aborted');
        request.abort();
      }
      else {
        request.continue();
      }

    });









    /*await page.setCacheEnabled(false);
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');*/

    //#PART 1
    await page.goto(`https://account.proton.me/signup?plan=free&billing=12&currency=EUR&language=en`, { timeout: 45000, waitUntil: 'networkidle2' });

    /*await page.goto(`https://dashboard.hcaptcha.com/signup?type=accessibility`, { timeout: 45000, waitUntil: 'networkidle0' });
    await page.waitForSelector('#email', { visible: true });
    await page.type('#email', req.query.email, { delay: 233 });
    await page.mouse.move(randomIntFromInterval(10, 9999), randomIntFromInterval(10, 9999));
    await page.mouse.move(randomIntFromInterval(10, 9999), randomIntFromInterval(10, 9999));
    await delay(5000);
    await page.click('button', {
      button: 'left',
    });
    await delay(10000);
    const base64 = await page.screenshot({ encoding: "base64" });
    //res.status(200).send(base64);
    res.write(`<img src="data:image/png;base64,${base64}"></img>`);
    return res.end();
    await delay(20565600);*/
    // try {
    //   await page.waitForSelector('#onetrust-accept-btn-handler', { visible: true, timeout: 20000 });
    //   await page.click('#onetrust-accept-btn-handler', { button: 'left' });
    // } catch (error) { }

    // await autoScroll(page);


    // try {

    //   await page.waitForSelector('iframe[src*="https://www.google.com/recaptcha/api2/anchor"]', { visible: true, timeout: 30000 });
    //   const frames = await page.frames();
    //   const frame = frames.find(frame => frame.url().includes('/recaptcha/api2/anchor?'));
    //   const content_frame = frames.find(frame => frame.url().includes('/recaptcha/api2/bframe?'));

    //   await frame.waitForSelector('#recaptcha-anchor', { visible: true, timeout: 15000 });
    //   //await delay(2000);
    //   //const button = await frame.$('#recaptcha-anchor');
    //   await page.mouse.move(randomIntFromInterval(10, 9999), randomIntFromInterval(10, 9999));
    //   await delay(2000);
    //   await frame.click('#recaptcha-anchor', {
    //     button: 'left',
    //   });


    //   //SCREENSHOTA
    //   await delay(5000);
    //   const base64_1 = await page.screenshot({ encoding: "base64" });
    //   res.write(`<img src="data:image/png;base64,${base64_1}"></img><br>`);


    //   /* await content_frame.waitForSelector('#recaptcha-audio-button', { visible: true, timeout: 30000 });
    //    await content_frame.click('#recaptcha-audio-button', {
    //      button: 'left',
    //    });*/
    //   await content_frame.waitForSelector('.help-button-holder', { visible: true, timeout: 25000 });
    //   await page.mouse.move(randomIntFromInterval(10, 9999), randomIntFromInterval(10, 9999));
    //   await delay(15);
    //   await content_frame.click('.help-button-holder', {
    //     button: 'left',
    //   });
    //   console.log('solve button clicked');
    //   await frame.waitForSelector('#recaptcha-anchor[aria-checked*="true"]', { timeout: 25000, visible: true })

    // } catch (error) {
    //   console.log(error)
    // }

    // await delay(8000);
    // const base64 = await page.screenshot({ encoding: "base64" });
    // res.write(`<img src="data:image/png;base64,${base64}"></img><br>`);
    // return res.end();

    /*
    const base64 = await page.screenshot({ encoding: "base64" });
    //res.status(200).send(base64);
    res.write(`<img src="data:image/png;base64,${base64}"></img>`);
    return res.end();*/


    //fs.writeFileSync('puta.txt', `<img src="data:image/png;base64,${base64}"></img>`, { encoding: 'utf8' })

    //res.set('Content-Type', 'text/html');
    //return res.status(200).send(Buffer.from(`<img src="data:image/png;base64,${base64}"></img>`));


    let email = req.query.email;
    let pass = req.query.pass;
    await page.type('#email', email, { delay: 10 });
    await page.type('#password', pass, { delay: 10 });
    await page.type('#repeat-password', pass, { delay: 10 });
    await page.evaluate(() => { document.querySelector('#select-domain').click() });
    let domains = ['proton.me', 'protonmail.com'];
    let chosen_domain = domains[Math.floor(Math.random() * domains.length)];
    console.log(chosen_domain);
    await page.waitForSelector(`button[title='${chosen_domain}']`, { visible: true });
    console.log('waitForSelector button DONE');
    await page.click(`button[title='${chosen_domain}']`, { button: 'left' });
    console.log('click button DONE');
    await page.click(`button[type='submit']`, { button: 'left' });
    console.log('CLICKED SUBMIT');


    //temp_mail # PART 1
    /*task = randomIntFromInterval(0, 6);
    sid = randomIntFromInterval(100000, 999999);
    new_tempmail = await axios.post(`https://api.mytemp.email/1/inbox/create?sid=${sid}&task=${task}&tt=138`);
    hash = new_tempmail.data.hash;
    mail = new_tempmail.data.inbox;
    console.log(new_tempmail.data.inbox);*/

    //#PART 2
    //await page.waitForSelector('iframe[title="Captcha"]', { visible: true, timeout: 25000 });
    //await autoScroll(page);

    await page.waitForFrame(async (frame) => {
      return frame.url().includes('.hcaptcha.com');
    }, { timeout: 25000 }).catch(async () => {
      const base64_1 = await page.screenshot({ encoding: "base64" });
      res.write(`<img src="data:image/png;base64,${base64_1}"></img><br>`);
    });


    const frame = await page.frames().find(f => f.url().includes('captcha?Token'));
    await frame.waitForSelector('#anycaptchaSolveButton', { visible: true, timeout: 25000 });
    /*requ = await REQ_Data("account-api.proton.me", "f99ae21a-1f92-46a4-938e-da6a6afb72ec")
    requ["type"] = "hsl"
    n = N_Data(requ["req"])
    resu = await Get_Captcha("account-api.proton.me", "f99ae21a-1f92-46a4-938e-da6a6afb72ec", n, requ)

    let captcha;
    if (resu["generated_pass_UUID"]) {
      captcha = resu["generated_pass_UUID"]
    } else {
      throw Error('FAILED TO GET TOKEN')
    }*/
    let t = await axios.get('https://entrevidato.herokuapp.com/token');
    t = t.data;
    token = t.token;
    await frame.evaluate((token) => document.getElementById('anycaptchaSolveButton').onclick(token), token);

    await delay(10000);

    await page.goto(`https://account.proton.me/login`, { timeout: 25000, waitUntil: 'load' });
    await page.waitForSelector('button[type="submit"]', { visible: true });

    await page.type('#username', `${email}@${chosen_domain}`, { delay: 10 });
    await page.type('#password', pass, { delay: 10 });
    await page.click('button[type="submit"]', { button: 'left' })
    await page.waitForSelector('div[data-testid="mailbox"]', { visible: true, timeout: 35000 }).catch();
    //await delay(10000);
    /*
        if ((await page.evaluate(() => document.querySelector('.text-bold'))) !== null) {
          throw Error('FAILED TO LOGIN IN ACCOUNT')
        }
        
        const base64_1 = await page.screenshot({ encoding: "base64" });
        res.write(`<img src="data:image/png;base64,${base64_1}"></img><br>`);*/

    //await page.waitForSelector(`input[value*="${email}"]`, { visible: true, timeout: 40000 });
    //await page.waitForSelector('.flex-item-fluid.p0-5.on-tiny-mobile-text-left', { timeout: 10000 });
    //await page.click(`.button-large`, { button: 'left' });
    //await page.waitForSelector(`input[value*="${mail}"]`);
    //await page.click(`.button-large`, { button: 'left' });
    //await delay(5000);
    res.write(`{"status": "success", "proxy":"${proxy_}", "email":"${email}@${chosen_domain}", "pass":"${pass}"}`);
    return res.end();
    return
    await page.click('#label_1', { button: 'left' });
    await page.type('#email', mail, { delay: 10 });
    await page.click(`.button-large`, { button: 'left' });

    await delay(10000);
    //temp_mail # PART 2
    new_tempmail = await axios.get(`https://api.mytemp.email/1/inbox/check?inbox=${mail}&hash=${hash}&sid=${sid}&task=${task}&tt=138`);
    if (new_tempmail.data.emls[0].from_name === 'Proton') {
      eml = new_tempmail.data.emls[0].eml;
      hash2 = new_tempmail.data.emls[0].hash;
      tempmail_text = await axios.get(`https://api.mytemp.email/1/eml/get?eml=${eml}&hash=${hash2}&sid=${sid}&task=${task}&tt=429`);
      body = tempmail_text.data.body_text;
      confimation_number = body.match(/[^\n]+$/g)[0];
      console.log(confimation_number);
    }

    await page.type('#verification', confimation_number, { delay: 10 });
    await page.click(`.button-large`, { button: 'left' });
    await page.waitForSelector(`input[value*="${email}"]`);
    await page.click(`.button-large`, { button: 'left' });
    await page.waitForSelector(`input[value*="${mail}"]`);
    await page.click(`.button-large`, { button: 'left' });

    await delay(5000);
    res.write(`{"status": "success","email":"${email}@${chosen_domain}", "pass":"${pass}"}`);
    res.end();
    //res.set('Content-Type', 'application/json');
    //res.status(200).send(`{status: 'success', email:"${email}@${chosen_domain}", pass:"${pass}"}`);
    //await page.goto(`https://api.myip.com/`, { timeout: 35000, waitUntil: 'load' });


    /*await delay(15000);
    const base64 = await page.screenshot({ encoding: "base64" });
    //res.status(200).send(base64);
    res.set('Content-Type', 'text/html');
    res.status(200).send(Buffer.from(`<img src="data:image/png;base64,${base64}"></img>`));*/

  } catch (error) {
    console.log(error)
    res.write(`{"status": "failed", "reason":"Internal Error"}`);
    res.end();
  } finally {
    console.log('browser closed')
    browser.close()
  }


  /*
  if (!req.params.link) return res.status(404).send('Provide info please!');

  if (req.params.link.includes('&&&')) {



  } else {
    res.status(404).send('Not Found')
  }*/
})










app.get('/p/access', async (req, res) => {

  res.writeHead(202, { 'Content-Type': 'text/html' });
  if (!req.query.email || !req.query.pass) {
    res.set('Content-Type', 'text/html');
    return res.status(404).send('<h3>Not Found<h3><br><strong>Please use /p/access?email=YOUR_EMAIL&pass=YOUR_PASS</strong>')
  }
  const browser = await puppeteerS.launch({
    headless: true,
    //executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: [
      `--headless=chrome`,
      //'--disk-cache-size=0',
      //'--disable-web-security',
      //'--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox'
    ],
    ignoreDefaultArgs: ["--enable-automation"],//  ./myUserDataDir
    //userDataDir: './myUserDataDir'//MUDARRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR <-------------------------------------------------------------------------mudar no deploy
  })
  console.log('Init');
  res.setTimeout(150000, function () {
    console.log('Request has timed out.');
    browser.close()
    res.sendStatus(408);
  });
  req.on('close', () => {
    console.log('browser closed')
    browser.close()
    return res.end();
  });
  req.on('end', () => {
    console.log('browser closed');
    browser.close()
    return res.end();
  });

  try {

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    const userAgent = new UA();
    await page.setUserAgent(userAgent.toString())


    await page.goto(`https://dashboard.hcaptcha.com/signup?type=accessibility`, { timeout: 25000, waitUntil: 'networkidle2' });
    await page.type('#email', req.query.email, { delay: 10 });
    await delay(1000);
    await page.click('button[data-cy="button-submit"]', { button: 'left' })
    await delay(10000);
    if ((await page.evaluate(() => document.querySelector('.sc-cxxZvF.fSWoxt'))) !== null) throw Error('FAILED TO CREATE')
    let mail = await axios.get(`https://${process.env.app_name}.herokuapp.com/p/first?email=${req.query.email}&pass=${req.query.pass}`);
    let link = mail.data.message.match(/https\:\/\/accounts\.hcaptcha\.com\/verify_email\/[^\s]*/g)[0];
    res.write(`{"status": "success", "link":"${link}"}`);
    res.end();


    /*
    await page.goto(`https://accounts.hcaptcha.com/verify_email/050936a1-532c-460f-99eb-19999cbf050f`, { timeout: 25000, waitUntil: 'networkidle2' });
    await page.waitForSelector('button[data-cy="setAccessibilityCookie"]');
    await page.click('button[data-cy="setAccessibilityCookie"]', {
      button: 'left',
    });
    await delay(10000);
    const cookies = await page.cookies()
    console.log(cookies)
    const base64 = await page.screenshot({ encoding: "base64" });
    res.write(`<img src="data:image/png;base64,${base64}"></img><br>`);
*/
  } catch (error) {
    console.log(error)
    res.write(`{"status": "failed", "reason":"Internal Error"}`);
    res.end();
  } finally {
    console.log('browser closed')
    browser.close()
  }

})
app.get('/p/cookie', async (req, res) => {

  res.writeHead(202, { 'Content-Type': 'text/html' });
  if (!req.query.link) {
    res.set('Content-Type', 'text/html');
    return res.status(404).send('<h3>Not Found<h3><br><strong>Please use /p/access?link=YOUR_LINK</strong>')
  }
  const browser = await puppeteerS.launch({
    headless: true,
    //executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: [
      `--headless=chrome`,
      //'--disk-cache-size=0',
      //'--disable-web-security',
      //'--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox'
    ],
    ignoreDefaultArgs: ["--enable-automation"],//  ./myUserDataDir
    //userDataDir: './myUserDataDir'//MUDARRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR <-------------------------------------------------------------------------mudar no deploy
  })
  console.log('Init');
  res.setTimeout(150000, function () {
    console.log('Request has timed out.');
    browser.close()
    res.sendStatus(408);
  });
  req.on('close', () => {
    console.log('browser closed')
    browser.close()
    return res.end();
  });
  req.on('end', () => {
    console.log('browser closed');
    browser.close()
    return res.end();
  });

  try {

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    const userAgent = new UA();
    await page.setUserAgent(userAgent.toString())

    await page.goto(`${req.query.link}`, { timeout: 35000, waitUntil: 'networkidle2' });
    await page.waitForSelector('button[data-cy="setAccessibilityCookie"]');
    await page.click('button[data-cy="setAccessibilityCookie"]', {
      button: 'left',
    });

    await delay(10000);


    const cookies = await page.cookies()
    const cookie = cookies.find(element => element.name === 'hc_accessibility');
    res.write(`{"status": "success", "cookie":"${cookie.value}"}`);
    res.end();

  } catch (error) {
    console.log(error)
    res.write(`{"status": "failed", "reason":"Internal Error"}`);
    res.end();
  } finally {
    console.log('browser closed')
    browser.close()
  }

})


app.get('/p/dog', async (req, res) => {

  /*
    if (!req.query.email || !req.query.pass) {
      res.set('Content-Type', 'text/html');
      return res.status(404).send('<h3>Not Found<h3>')
    }*/

  res.writeHead(202, { 'Content-Type': 'application/json' });
  const extension = path.join(__dirname, '1.3.1_1')
  const browser = await puppeteerS.launch({
    headless: true,
    //executablePath: chromePaths.chrome,


    slowMo: 10,
    //devtools: true,
    args: [
      `--headless=chrome`,
      '--disable-web-security',
      '--ignore-certificate-errors',
      //`--proxy-server=http://104.200.18.76:3128`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--ignore-certifcate-errors-spki-list",
      "--disable-accelerated-2d-canvas",
      "--no-zygote",
      "--no-first-run",
      "--disable-dev-shm-usage",
      //'--disk-cache-size=0',
      //'--disable-web-security',
      //'--disable-features=IsolateOrigins,site-per-process',
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      //'--no-sandbox'
    ],
    ignoreDefaultArgs: ["--enable-automation"],//  ./myUserDataDir
    userDataDir: './myUserDataDir'//MUDARRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR <-------------------------------------------------------------------------mudar no deploy
  })

  console.log('Init');
  res.setTimeout(150000, function () {
    console.log('Request has timed out.');
    if (browser.isConnected()) browser.close()
    res.sendStatus(408);
  });
  req.on('close', () => {
    console.log('browser closed1')
    if (browser.isConnected()) browser.close()
    return res.end();
  });
  req.on('end', () => {
    console.log('browser closed2');
    if (browser.isConnected()) browser.close()
    return res.end();
  });

  try {

    //const context = await browser.createIncognitoBrowserContext();
    const context = browser.defaultBrowserContext();
    context.overridePermissions("https://api.scrapingdog.com/", ["clipboard-read"]);
    const pages = await browser.pages();
    const page = pages[0];
    await page.setDefaultNavigationTimeout(0);
    //const page = await context.newPage();
    const page2 = await context.newPage();
    //await page.emulateTimezone('America/Chicago');
    //await page2.emulateTimezone('America/Chicago');

    const userAgent = new UA();
    await page.setUserAgent(userAgent.toString())
    await page2.setUserAgent(userAgent.toString())
    await page.bringToFront();

    /*const client1 = await page.target().createCDPSession();
    await client1.send('Network.clearBrowserCookies');
    await client1.send('Network.clearBrowserCache');
*/


    // I always use this method to get the active page, and not to have to open a new tab
    //const page1 = (await context.pages())[0];
    // use this instead of the page, to get all the cloaking benefits
    // cloakedPage = puppeteerAfp(page);
    var index = 0;
    //let alive = await axios.get(`https://entrevidato.herokuapp.com/get`);
    //let d = alive.data;
    var api_k = ''

    await page.setRequestInterception(true);
    page.on('request', async request => {

      if (request.method() === "POST" && request.url().includes('/register')) {
        console.log('Intercepted');

        //useProxy(request, 'http://130.41.85.158:8080');
        request.abort()

        let url_ = request.url();
        let data_ = request.postData();
        let headers_ = request.headers();
        console.log(headers_)
        //62ae4f79883d62763d27004f
        //62ae5651883d62763d270050
        //62ae5984fd72c2764482cfea
        //62ae5bb0327c777636c634eb
        //62ae5c2d883d62763d270052
        //62ae5fb211d1ea764b2f264c
        //62ae5f6f883d62763d270054
        let c = proxies[Math.floor(Math.random() * proxies.length)]
        console.log(c)
        unirest.post(url_).proxy(`http://scrapingdog:${c}-country=random@proxy.scrapingdog.com:8081`).send(JSON.parse(data_)).then((response) => {
          console.log(response.body)
          api_k = response.body._id;
        })



      }
      else {
        request.continue();
      }

    });

    //await page.setUserAgent('Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0');
    //await page.goto('https://reqbin.com/', { timeout: 95000, waitUntil: 'networkidle0' });
    await page.goto('https://api.scrapingdog.com/register', { timeout: 95000, waitUntil: 'networkidle0' });

    //await delay(55555555)

    //--------------------------------------EMAIL
    task = randomIntFromInterval(0, 6)
    sid = randomIntFromInterval(100000, 999999)
    new_tempmail = await axios.post(`https://api.mytemp.email/1/inbox/create?sid=${sid}&task=${task}&tt=139`);
    //let new_tempmail = await unirest.post(`https://api.mytemp.email/1/inbox/create?sid=${sid}&task=${task}&tt=138`).proxy(`http://scrapingdog:${proxies[Math.floor(Math.random() * proxies.length)]}-country=random@proxy.scrapingdog.com:8081`).send()
    hash = new_tempmail.data.hash;
    mail = new_tempmail.data.inbox;
    console.log(new_tempmail.data.inbox)
    //--------------------------------------

    await delay(3000)
    let random_1 = name_list[Math.floor(Math.random() * name_list.length)] + randomWords({ exactly: 2, join: '' });
    let random_2 = name_list[Math.floor(Math.random() * name_list.length)] + randomWords({ exactly: 3, join: '' });
    await page.type('#defaultFormLoginEmailEx', random_1, { delay: 10 });
    await page.type('input[name="email"]', mail, { delay: 10 });
    await page.type('input[name="password"]', random_2, { delay: 10 });
    console.log(await recaptcha(page)); //Solve recaptcha on page;
    //await delay(40000)
    await page.click('button[type="submit"]', { button: 'left' })

    let seconds = 0;

    let checka = setInterval(async function () {

      //--------------------------------------EMAIL2
      new_tempmail = await axios.get(`https://api.mytemp.email/1/inbox/check?inbox=${mail}&hash=${hash}&sid=${sid}&task=${task}&tt=138`);
      if (new_tempmail.data.emls[0].from_name === 'Scrapingdog') {
        clearInterval(checka)
        eml = new_tempmail.data.emls[0].eml;
        hash2 = new_tempmail.data.emls[0].hash;
        tempmail_text = await axios.get(`https://api.mytemp.email/1/eml/get?eml=${eml}&hash=${hash2}&sid=${sid}&task=${task}&tt=429`);
        body = tempmail_text.data.body_html
        confimation_link = body.match(/https\:\/\/api\.scrapingdog\.com\/verify\/[^\<\/]*/g)
        console.log(confimation_link[0])
        /*}else {
          throw new Error('Timeout during resolve email confirmation link')
        }*/
        await page2.bringToFront();

        await page2.goto(confimation_link[0], { timeout: 35000, waitUntil: 'networkidle2' });
        // let mmama = await unirest.get(confimation_link[0]).proxy(`http://scrapingdog:${proxies[Math.floor(Math.random() * proxies.length)]}-country=random@proxy.scrapingdog.com:8081`).send()
        //console.log(mmama.body)
        await delay(5000)

        console.log('DONE!!!')
        //console.log(await page2.url())
        res.write(`{"status": "success", "api_key":"${api_k}"}`);
        res.end();
        //await context.close();
        await browser.close()
        //--------------------------------------
      }


      seconds++;

      if (seconds > 25) {
        clearInterval(checka)
        //throw new Error('Timeout during resolve')
      }

    }, 1000)

    await delay(30000);
    if (browser.isConnected()) browser.close()
    res.end();
    //throw new Error('Timeout during resolve')
    //const base64 = await page.screenshot({ encoding: "base64" });
    //res.write(`<img src="data:image/png;base64,${base64}"></img><br>`);
    //res.end();

  } catch (error) {
    //console.log(error)
    res.write(`{"status": "failed", "reason":"${error.message}"}`);
    res.end();
    if (browser.isConnected()) browser.close()
  }

})

app.get('/p/first', async (req, res) => {

  res.writeHead(202, { 'Content-Type': 'application/json' });
  if (!req.query.email || !req.query.pass) {
    res.set('Content-Type', 'text/html');
    return res.status(404).send('<h3>Not Found<h3><br><strong>Please use /p/first?email=YOUR_EMAIL&pass=YOUR_PASS</strong>')
  }
  res.setTimeout(150000, function () {
    console.log('Request has timed out.');
    res.sendStatus(408);
  });
  req.on('close', () => {
    return res.end();
  });
  req.on('end', () => {
    return res.end();
  });
  try {

    let start = Date.now();
    const client = new protonmail.ProtonmailClient();

    // login to the protonmail
    await client.login({
      username: req.query.email,
      loginPassword: req.query.pass,
    });

    // fetch private keys in order to decrypt messages
    await client.fetchKeys({
      password: req.query.pass,
    });

    // fetch the first 2 messages
    const messagesResponse = await client.messages.list({
      LabelID: protonmail.DefaultLabels.All,
      Limit: 2,
      Page: 0,
    });

    // take the first one
    const firstMessage = messagesResponse.Messages[0];
    // get the full message with body
    const m = await client.messages.get(firstMessage.ID);

    // decrypt message
    const m_decrypted = await client.decryptMessage(m.Message);

    let stop = Date.now();
    const $ = cheerio.load(m_decrypted, {
      xml: {
        normalizeWhitespace: true,
      },
    });
    let txt = $('body').text();
    message = txt.replaceAll(/(\r\n|\r|\n)/g, ' ').replaceAll(/\s\s+|\xA0|&nbsp;/g, ' ').replaceAll(/\"/g, '\\"');

    await client.logout();

    res.write(`{"status": "success", "duration":"${(stop - start) / 1000}s", "message":"${message}"}`);
    res.end();



  } catch (error) {
    console.log(error)
    res.write(`{"status": "failed", "reason":"Internal Error"}`);
    res.end();
  }

})

for (let middleware in middlewares) {
  app.use(middlewares[middleware]);
}

// TODO: allow server config
app.listen(port, host, function () {
  console.log('MEGA streaming on ' + host + ':' + port);
});
