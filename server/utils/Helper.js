import fs from "fs";
import path from "path";
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import logger from "./Logger.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import solveTurnstileMin from "../turnstile/solveTurnstile.js";
const helper = {
    proxies: [],
    setupProxies() {
        try {
            const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../proxies.txt');
            const data = fs.readFileSync(filePath, 'utf-8');
            this.proxies = data.split('\n').filter(proxy => proxy.trim() !== '');
        }
        catch (error) {
            logger.warn(`Error reading proxies from file: ${error.message}`);
        }
    },
    getProxy() {
        const proxy = this.proxies.shift();
        this.proxies.push(proxy);
        return new HttpsProxyAgent(`http://${proxy}`);
    },
    async getCaptchaTicket(serverCode) {
        const response = await solveTurnstileMin().then(res => { return { result: res, code: 200 }; }).catch(logger.warn);
        if (!response) {
            if (!global.browserFinished)
                logger.warn('Failed to solve turnstile');
            return null;
        }
        const result = response.result;
        if (!result || !result.token || !result.cf_clearance) {
            if (!global.browserFinished)
                logger.warn('Invalid turnstile result');
            return null;
        }
        const payload = {
            'lang': 'EN',
            'turnstileToken': result.token,
        };
        try {
            const proxyAgent = this.getProxy();
            const response = await fetch(`https://agarcity.io/api/toServer/captchaJoinTicket/${serverCode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://agarcity.io',
                    'Referer': 'https://agarcity.io/',
                    'Cookie': `cf_clearance=${result.cf_clearance}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
                },
                body: JSON.stringify(payload),
                agent: proxyAgent,
            });
            if (!response.ok) {
                if (!global.browserFinished)
                    logger.warn(`Failed to get captcha ticket: ${response.status} ${response.statusText}`);
                return null;
            }
            const data = await response.json();
            return data.ticket;
        }
        catch (error) {
            if (!global.browserFinished)
                logger.warn(`Error getting captcha ticket: ${error.message}`);
            return null;
        }
    }
};
export default helper;
