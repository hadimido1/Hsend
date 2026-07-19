const fs = require('fs');
let code = fs.readFileSync('src/components/CallOverlay.tsx', 'utf8');

// Add `addMessage` to store extraction if not present
if (!code.includes('addMessage')) {
  code = code.replace(/const \{ callStatus/g, "const { addMessage, callStatus");
}

const rejectCallMatch = "  const rejectCall = async () => {\n    if (incomingCallData && currentUser) {\n      if (incomingCallData.callerInfo?.id) {\n        // Notify caller that call was rejected\n        socket.emit(\"end_call\", {\n          to: incomingCallData.from,\n          receiver_id: incomingCallData.from,\n          signal: 'rejected'\n        });\n      } else {\n        socket.emit(\"end_call\", { to: incomingCallData.from });\n      }\n      setCallStatus('idle');\n      setIncomingCallData(null);\n    }\n  };";

const endCallMatch = "  const endCall = async () => {\n    const targetId = callTo?.id || incomingCallData?.from;\n    if (targetId) {\n      socket.emit(\"end_call\", { to: targetId });\n    }\n    setCallStatus('idle');\n    setCallTo(null);\n    setIncomingCallData(null);\n  };";

// We'll replace the socket.on("call_ended") in CallOverlay.tsx
// wait, the easiest way is to add it in `CallOverlay.tsx` where call ends and duration is 0
