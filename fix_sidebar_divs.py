import re

with open("src/components/Sidebar.tsx", "r") as f:
    content = f.read()

# Let's remove the extra `</div>` at line 483 if it exists and is unbalanced.
# The easiest way is to use a linter or just manually fix it.
