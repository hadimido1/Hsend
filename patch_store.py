import re

with open('src/lib/store.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("  last_seen?: number;", "  last_seen?: number;\n  contacts?: string[];")

with open('src/lib/store.ts', 'w', encoding='utf-8') as f:
    f.write(code)
