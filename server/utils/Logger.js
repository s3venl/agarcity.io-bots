import chalk from 'chalk';
import boxen from 'boxen';
import helper from './Helper.js';
import createBrowser from "../turnstile/createBrowser.js";
let printedBoxen = false;
const logger = {
    initialize: async () => {
        if (printedBoxen)
            return;
        await createBrowser();
        helper.setupProxies();
        const info = boxen(`${chalk.greenBright.bold("Version          :")} 1.2\n` +
            `${chalk.greenBright.bold("Browser          :")} ${global.browser ? 'Ready' : 'Not Ready'}\n` +
            `${chalk.greenBright.bold("Proxies          :")} Loaded ${helper.proxies.length} proxies\n` +
            `${chalk.greenBright.bold("Developed by     :")} S3venL`, {
            width: 65,
            padding: .50,
            title: "AGARCITY.IO BOTS",
            borderStyle: "bold",
            titleAlignment: 'center',
            borderColor: "greenBright",
        });
        console.log(info);
        printedBoxen = true;
    },
    info: (message, prefix = null) => {
        console.log(`${chalk.greenBright(prefix ? `[${prefix}]` : '[INFO]')} ${message}`);
    },
    warn: (message, prefix = null) => {
        console.log(`${chalk.yellowBright(prefix ? `[${prefix}]` : '[WARN]')} ${message}`);
    },
    process: (tried, length) => {
        logger.initialize();
        let percent = Math.floor((tried / length) * 100);
        if (tried === length)
            percent = 100;
        const msg = `${chalk.yellowBright('[TokenManager]')} Checking your tokens... ${percent}% (${tried} out of ${length} tokens checked)`;
        process.stdout.write('\r' + msg.padEnd(process.stdout.columns));
        if (tried === length) {
            process.stdout.write('\n');
        }
    }
};
export default logger;
