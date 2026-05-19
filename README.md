# AgarCity.io Bots

A simple AgarCity.io bot system built with Puppeteer, WebSocket, and Cloudflare's Turnstile breaker support. Because playing the game normally seems too generic and boring :v.

## Features

- Proxy support
- Cloudflare Turnstile token solver
- WebSocket bot connection
- Automatic asset loading
- Queue system for controlled concurrency
- Extra Zoom
- Show All Player Mass

---

## Project Structure

```txt
extension/
├── css/
├── icons/
├── js/
├── content.js
└── manifest.json

server/
├── captcha/
│   ├── createBrowser.js
│   └── solveTurnstile.js
│
├── data/
│   └── fakePage.html
│
├── utils/
│   ├── Helper.js
│   ├── Logger.js
│   ├── Reader.js
│   └── Writer.js
│
├── AgarBot.js
├── Entity.js
├── index.js
├── install.bat
├── package.json
├── proxies.txt
└── start.bat
```

---

## Requirements

- Node.js 18+
- Google Chrome / Chromium
- Stable proxies
- Windows/Linux

---

## Installation

Clone repository:

```bash
git clone https://github.com/s3venl/agarcity.io-bots.git
cd agarcity.io-bots/server
```

Install dependencies:

```bash
npm install
```

Or simply run:

```bat
install.bat
```

---

## Start

Run bots:

```bash
node index.js
```

Or use:

```bat
start.bat
```

---

## Proxy Configuration

Edit:

```txt
proxies.txt
```

Supported formats:

```txt
# With authentication
username:password@host:port

# Without authentication
host:port
```

Example:

```txt
john123:mypassword@127.0.0.1:8080
192.168.1.1:3128
```

One proxy per line.

---

## Turnstile Solver

The project uses Puppeteer + fake page injection for solving Cloudflare Turnstile challenges.

Main files:

```txt
server/captcha/createBrowser.js
server/captcha/solveTurnstile.js
```

Important:
- Cloudflare protection may change anytime
- Some proxies may fail
- `cf_clearance` cookies are not guaranteed
- Browser fingerprinting may affect success rate

Modern anti-bot systems are basically an arms race powered by caffeine and mutual hostility.

---

## Extension

Chrome extension files are located inside:

```txt
extension/
```

To load extension manually:

1. Open Chrome
2. Go to:

```txt
chrome://extensions
```

3. Enable:

```txt
Developer Mode
```

4. Click:

```txt
Load unpacked
```

5. Select `extension` folder

---

## Credits

Special thanks to:

- https://github.com/ZFC-Digital/cf-clearance-scraper

---

## Notes

If build/version suddenly stops working:

- Cloudflare likely updated protection
- AgarCity changed protocol
- Proxy provider got flagged
- Browser fingerprint became detected

This is normal behavior in browser automation projects. Stable today, broken tomorrow. Nature is healing.

---

## Disclaimer

This project is for educational and research purposes only.

Use responsibly.

---

## README Notice

This README was paraphrased, refined, and improved with assistance from ChatGPT.

---

## License

MIT