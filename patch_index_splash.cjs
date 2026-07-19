const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const splash = `
    <div id="root">
      <style>
        body { margin: 0; background-color: #0b141a; }
        .native-splash { display: flex; flex-direction: column; height: 100vh; width: 100vw; align-items: center; justify-content: space-between; padding: 48px 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .native-splash-logo { flex: 1; display: flex; align-items: center; justify-content: center; }
        .native-splash-logo img { width: 96px; height: 96px; object-fit: contain; }
        .native-splash-footer { display: flex; flex-direction: column; align-items: center; margin-bottom: 24px; }
        .native-splash-footer-from { color: #8696a0; font-size: 14px; margin-bottom: 4px; font-weight: 500; }
        .native-splash-footer-name { color: #fff; font-size: 20px; font-weight: bold; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
        .native-splash-icon { width: 24px; height: 24px; background-color: #00a884; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 168, 132, 0.2); }
      </style>
      <div class="native-splash">
        <div class="native-splash-logo">
          <img src="/HSEND_LOGO.png" alt="HiSEND Logo" />
        </div>
        <div class="native-splash-footer">
          <div class="native-splash-footer-from">from</div>
          <div class="native-splash-footer-name">
            <div class="native-splash-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white; fill: white;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </div>
            HiSEND
          </div>
        </div>
      </div>
    </div>
`;

code = code.replace('<div id="root"></div>', splash);
fs.writeFileSync('index.html', code);
