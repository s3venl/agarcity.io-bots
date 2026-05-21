import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PQueue from "p-queue";
import helper from "../utils/Helper.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.join(__dirname, "../data/fakePage.html"), "utf8");
const queue = new PQueue({ concurrency: 3 });
function safeErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function safeClose(context) {
    try {
        if (context) {
            await context.close();
        }
    }
    catch (err) {
        const msg = safeErrorMessage(err);
        if (msg.includes("Failed to find context") ||
            msg.includes("Target.disposeBrowserContext")) {
            return;
        }
        console.warn("Failed to close context:", msg);
    }
}
async function solveTurnstileMin() {
    const proxyAgent = helper.getProxy();
    const port = proxyAgent.proxy.port;
    const hostname = proxyAgent.proxy.hostname;
    const username = proxyAgent.proxy.username;
    const password = proxyAgent.proxy.password;
    return queue.add(async () => {
        const url = "https://agarcity.io/";
        const siteKey = "0x4AAAAAABAjfOqh5bvd6-cV";
        let context = null;
        let timeout = null;
        let settled = false;
        try {
            context = await global.browser.createBrowserContext({
                proxyServer: `http://${hostname}:${port}`,
            });
            timeout = setTimeout(async () => {
                if (settled)
                    return;
                settled = true;
                await safeClose(context);
            }, 60000);
            const page = await context.newPage();
            if (username && password) {
                await page.authenticate({
                    username,
                    password,
                });
            }
            await page.setRequestInterception(true);
            page.on("request", async (request) => {
                try {
                    if ([url, url + "/"].includes(request.url()) &&
                        request.resourceType() === "document") {
                        await request.respond({
                            status: 200,
                            contentType: "text/html",
                            body: html.replace(/<site-key>/g, siteKey),
                        });
                    }
                    else {
                        await request.continue();
                    }
                }
                catch {
                    // ignore errors from requests after timeout
                }
            });
            const userAgent = await page.evaluate(() => navigator.userAgent);
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"); // avoid detection, if headless true
            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            await page.waitForSelector('[name="cf-response"]', {
                timeout: 60000,
            });
            const token = await page.evaluate(() => {
                const el = document.querySelector('[name="cf-response"]');
                return el?.value || null;
            });
            if (!token || token.length < 10) {
                throw new Error("Failed to get token");
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const cookies = await page.cookies(url);
            const cf_clearance = cookies.find((cookie) => cookie.name === "cf_clearance");
            if (!cf_clearance) {
                throw new Error("Failed to get cf_clearance cookie. maybe proxy is blocked. change proxy or try again later.");
            }
            return {
                token,
                cookies,
                userAgent,
                cf_clearance: cf_clearance?.value ?? null,
            };
        }
        catch (error) {
            console.error("Error solving turnstile:", safeErrorMessage(error));
            return null;
        }
        finally {
            settled = true;
            if (timeout) {
                clearTimeout(timeout);
            }
            await safeClose(context);
        }
    });
}
export default solveTurnstileMin;
