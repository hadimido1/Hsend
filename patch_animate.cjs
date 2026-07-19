const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// find the chat messages map
const originalMap = `{chatMessages.map(msg => (
          <MessageItem 
            key={msg.id}
            msg={msg}
            currentUser={currentUser}
            partner={partner}
            lang={lang}
            isSelected={selectedMessages.includes(msg.id)}
            selectedMessages={selectedMessages}
            setSelectedMessages={setSelectedMessages}
            setSelectedImage={setSelectedImage}
            setReplyingTo={setReplyingTo}
            db={db}
            CustomAudioPlayer={CustomAudioPlayer}
            Markdown={Markdown}
            showMoreEmojis={showMoreEmojis}
            setShowMoreEmojis={setShowMoreEmojis}
            playingAudioId={playingAudioId}
            setPlayingAudioId={setPlayingAudioId}
            handleAudioEnded={handleAudioEnded}
          />
        ))}`;

const replacedMap = `<AnimatePresence initial={false}>
          ${originalMap}
        </AnimatePresence>`;

code = code.replace(originalMap, replacedMap);
fs.writeFileSync('src/components/ChatArea.tsx', code);
