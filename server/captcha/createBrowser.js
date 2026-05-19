import { connect } from "puppeteer-real-browser";
import { logger } from "../utils/Logger.js";
async function createBrowser() {
    try {
        if (global.finished == true)
            return;
        // console.log('Creating browser...');
        global.browser = null;
        const { browser } = await connect({
            headless: false,
            turnstile: true,
            connectOption: { defaultViewport: null },
            disableXvfb: false,
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
