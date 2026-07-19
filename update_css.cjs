const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace('--color-accent-primary: var(--accent-primary);', `--color-accent-primary: var(--accent-primary);\n  --color-bubble-me: var(--bubble-me);\n  --color-bubble-me-text: var(--bubble-me-text);\n  --color-bubble-other: var(--bubble-other);\n  --color-bubble-other-text: var(--bubble-other-text);`);

css = css.replace('--accent-primary: #00A884;\n}', `--accent-primary: #00A884;\n  --bubble-me: #d9fdd3;\n  --bubble-me-text: #111b21;\n  --bubble-other: #ffffff;\n  --bubble-other-text: #111b21;\n}`);

css = css.replace('--accent-primary: #00A884;\n}', `--accent-primary: #00A884;\n  --bubble-me: #005c4b;\n  --bubble-me-text: #e9edef;\n  --bubble-other: #202c33;\n  --bubble-other-text: #e9edef;\n}`);

fs.writeFileSync('src/index.css', css);
