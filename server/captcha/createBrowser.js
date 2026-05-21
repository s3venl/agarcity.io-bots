import { connect } from "puppeteer-real-browser";
import { logger } from "../utils/Logger.js";
async function createBrowser() {
    try {
        if (global.finished == true)
            return;
        // console.log('Creating browser...');
        global.browser = null;
        const { browser } = await connect({
            args: [
                "--no-sandbox",
                // '--disable-setuid-sandbox',
                // '--disable-dev-shm-usage',
                // '--disable-accelerated-2d-canvas',
                // '--disable-gpu',
                // '--disable-blink-features=AutomationControlled',
            ],
            headless: true,
            turnstile: true,
            connectOption: { defaultViewport: null },
            disableXvfb: false,
            ignoreAllFlags: true,
        });
        global.browser = browser;
        browser.on('disconnected', async () => {
            if (global.finished == true)
                return;
            logger.warn('Browser disconnected. Recreating...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            await createBrowser();
        });
    }
    catch (e) {
        logger.warn(e.message);
        if (global.finished == true)
            return;
        await new Promise(resolve => setTimeout(resolve, 3000));
        await createBrowser();
    }
}
createBrowser();
