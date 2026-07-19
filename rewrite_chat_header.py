import re

with open('src/components/ChatArea.tsx', 'r') as f:
    content = f.read()

# Make the chat background explicitly dark doodle-like, but for now we'll stick to bg-[#0b141a] and keep the texture.
content = content.replace('bg-bg-primary w-full"', 'bg-[#0b141a] w-full"')

# Fix the header
content = re.sub(
    r'<div className={`h-16 flex items-center justify-between px-3 sm:px-4 py-2 shrink-0 z-10 shadow-sm border-b border-border-primary \$\{partner.id === \'hbot-ai\' \? \'[^\']+\' : \'[^\']+\'\}`}>',
    r'<div className={`h-16 flex items-center justify-between px-2 sm:px-4 py-2 shrink-0 z-10 shadow-sm bg-[#0b141a]`}>',
    content
)

# And inside the input, replace the wrapper:
content = content.replace('<div className="bg-[#0b141a] px-2 py-2 flex items-end gap-2 shrink-0">', '<div className="bg-[#0b141a] px-2 py-2 flex items-end gap-2 shrink-0 z-10 relative">')

with open('src/components/ChatArea.tsx', 'w') as f:
    f.write(content)

