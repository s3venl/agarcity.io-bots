import logger from "../utils/Logger.js";
import { connect } from "puppeteer-real-browser";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export default async function createBrowser() {
    if (global.browserFinished)
        return;
    if (global.recreatingBrowser)
        return;
    global.recreatingBrowser = true;
    try {
        global.browser = null;
        const { browser } = await connect({
            args: [
                "--no-sandbox",
            ],
            headless: true,
            turnstile: true,
            connectOption: { defaultViewport: null },
            disableXvfb: false,
            ignoreAllFlags: true,
        });
        global.browser = browser;
        browser.on("disconnected", async () => {
            if (global.browserFinished)
                return;
            logger.warn("Browser disconnected. Recreating...");
            await delay(3000);
            global.recreatingBrowser = false;
            await createBrowser();
        });
    }
    catch (e) {
        logger.warn(e.message);
        if (!global.browserFinished) {
            await delay(3000);
            global.recreatingBrowser = false;
            await createBrowser();
        }
    }
    finally {
        if (global.browser) {
            global.recreatingBrowser = false;
        }
    }
}
