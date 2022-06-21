const delay = require('delay');

async function isVisible(page, element) {
    return new Promise(async (resolve, reject) => {
        let isVis = await page.evaluate((element) => {
            const e = document.querySelector(element);
            if (!e)
                return false;
            const style = e.style;
            return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, element);
        resolve(isVis);
    });
}
async function handler(page, frame, content_frame) {
    return new Promise(async (resolve, reject) => {
        let seconds = 0;
        let check = setInterval(async function () {
            //.rc-anchor-error-msg-container
            // console.log('anchor-error', await isVisible(frame, '.rc-anchor-error-msg-container'));
            // console.log('content-frame-error', await isVisible(content_frame, '.rc-doscaptcha-body-text'));


            if (await isVisible(content_frame, '.rc-doscaptcha-body-text')) {
                console.log('error');
                //await delay(1500);
                clearInterval(check)
                const error_text = await content_frame.$eval('.rc-doscaptcha-body-text', element => element.innerText);
                if (error_text.includes('Your computer or network may be sending automated queries')) reject(new Error('Could not resolve captcha'))
            }
            else if (await isVisible(content_frame, '.rc-defaultchallenge-incorrect-response')) {
                await content_frame.click('#recaptcha-reload-button', { button: 'left' });
            }
            else if (await frame.$('#recaptcha-anchor[aria-checked*="true"]')) {
                console.log('solved');
                clearInterval(check);
                resolve(true);
            }
            else if (await content_frame.$('.help-button-holder')) {
                console.log('solving');
                //await delay(1500);
                await content_frame.click('.help-button-holder', { button: 'left' });
            }
            else {
                console.log('not Found');
            }

            seconds++;

            if (seconds > 15) {
                clearInterval(check)
                reject(new Error('Timeout during resolve'))
            }

        }, 1000)

    });
}

async function solve_recaptcha(page) {
    return new Promise(async (resolve, reject) => {

        try {

            await page.waitForSelector('iframe[src*="https://www.google.com/recaptcha/api2/anchor"]', { visible: true, timeout: 45000 });
            const frames = await page.frames();
            const frame = frames.find(frame => frame.url().includes('/recaptcha/api2/anchor?'));
            const content_frame = frames.find(frame => frame.url().includes('/recaptcha/api2/bframe?'));

            await frame.waitForSelector('#recaptcha-anchor', { visible: true, timeout: 15000 });
            await delay(1500);
            await frame.click('#recaptcha-anchor', { button: 'left' });

            await handler(page, frame, content_frame);

            /*await content_frame.waitForSelector('.help-button-holder', { visible: true, timeout: 25000 });
            await delay(1500);
            await content_frame.click('.help-button-holder', { button: 'left' });

            console.log('[RECAPTCHA] Solve Button Clicked');

            await frame.waitForSelector('#recaptcha-anchor[aria-checked*="true"]', { timeout: 25000, visible: true })*/

            resolve(true)

        } catch (error) {
            reject(error)
        }

    });
}

module.exports = solve_recaptcha;