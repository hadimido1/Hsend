import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useStore, User } from '../lib/store';
import { socket } from '../lib/socket';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { startRingtone, startDialTone, stopRingtone, playSound } from '../lib/sounds';
import { encryptMessage, importPublicKey } from '../lib/crypto';


export default function CallOverlay() {
  const { t, lang } = useTranslation();
  const { callStatus, callType, callTo, incomingCallData, setCallStatus, setIncomingCallData, currentUser, users } = useStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [proximityClose, setProximityClose] = useState(false);
  const [swapPiP, setSwapPiP] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [callDuration, setCallDuration] = useState(0);
  const callDurationRef = useRef(0);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);
  
  // Dragging states
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pipStartPos = useRef({ x: 0, y: 0 });

  const myVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const incomingCallUnsubRef = useRef<(() => void) | null>(null);
  const outgoingCallUnsubRef = useRef<(() => void) | null>(null);

  const callStatusRef = useRef(callStatus);
  const callTypeRef = useRef(callType);
  const incomingCallDataRef = useRef(incomingCallData);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    callStatusRef.current = callStatus;
    callTypeRef.current = callType;
    incomingCallDataRef.current = incomingCallData;
    currentUserRef.current = currentUser;
  });

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      stopRingtone();
      if (callStatusRef.current !== 'connected') {
         playSound('call_connected');
      }
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (callStatus === 'calling') {
      stopRingtone();
      startDialTone();
      setCallDuration(0);
    } else if (callStatus === 'incoming') {
      stopRingtone();
      const prefs = useStore.getState().friendPreferences[incomingCallData?.callerInfo?.id] || {};
      startRingtone(prefs.ringtoneSound);
      setCallDuration(0);
    } else {
      if (callStatusRef.current !== 'idle') {
        playSound('end');
      }
      stopRingtone();
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus, incomingCallData]);

  const cleanup = async () => {
    if (callTo && currentUserRef.current) {
       try {
         const partnerPubKey = await importPublicKey(callTo.public_key);
         const myPubKey = await importPublicKey(currentUserRef.current.public_key);
         const duration = callDurationRef.current || 0;
         const status = duration > 0 ? 'answered' : 'missed';
         
         const callLogStr = `call_log:${status}:${duration}:${callTypeRef.current}`;
         
         const encryptedContentReceiver = await encryptMessage(partnerPubKey, callLogStr);
         const encryptedContentSender = await encryptMessage(myPubKey, callLogStr);
         const content = JSON.stringify({ forReceiver: encryptedContentReceiver, forSender: encryptedContentSender });
         
         const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
         const chatId = currentUserRef.current.id < callTo.id ? `${currentUserRef.current.id}_${callTo.id}` : `${callTo.id}_${currentUserRef.current.id}`;
         
         await setDoc(doc(db, 'messages', msgId), {
           id: msgId,
           chatId,
           sender_id: currentUserRef.current.id,
           receiver_id: callTo.id,
           content,
           type: 'call_log',
           timestamp: Date.now(),
           status: 'sent'
         });
       } catch(e) {
         console.error('Failed to save call log', e);
       }
    }

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (incomingCallUnsubRef.current) {
      incomingCallUnsubRef.current();
      incomingCallUnsubRef.current = null;
    }
    if (outgoingCallUnsubRef.current) {
      outgoingCallUnsubRef.current();
      outgoingCallUnsubRef.current = null;
    }
    setStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingCallData(null);
    setSwapPiP(false);
    setPipPos({ x: 0, y: 0 });
  };

  // 1. Unified Firestore Incoming Call and Signalling listener
  useEffect(() => {
    if (!currentUser?.id) return;

    const handleSignal = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;

      const { signalType, sender_id, signalData, callerInfo } = data;

      // Double safety check
      if (data.receiver_id !== currentUser.id) return;

      console.log("Firestore Signal Received:", signalType, "from:", sender_id);

      if (signalType === 'offer') {
        if (callStatusRef.current === 'idle') {
          setIncomingCallData({
            signal: signalData,
            from: sender_id,
            callerInfo: callerInfo
          });
          setCallStatus('incoming');
        }
      } else if (signalType === 'answer') {
        if (peerRef.current && peerRef.current.signalingState !== 'closed') {
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
            setCallStatus('connected');
          } catch (e) {
            console.error("Error setting remote description from answer", e);
          }
        }
      } else if (signalType === 'rejected') {
        cleanup();
        alert(lang === 'ar' ? "تم رفض المكالمة." : "Call declined.");
      } else if (signalType === 'ended') {
        cleanup();
      } else if (signalType === 'candidate') {
        if (peerRef.current && signalData && peerRef.current.signalingState !== 'closed') {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(signalData));
          } catch (e) {
            // Silence candidates issues to prevent UI spam
          }
        }
      }
    };

    window.addEventListener('call_signal_received', handleSignal);

    return () => {
      window.removeEventListener('call_signal_received', handleSignal);
    };
  }, [currentUser?.id]);

  // 2. Keep the socket events as fallback
  useEffect(() => {
    socket.on("call_incoming", async ({ signal, from, callerInfo }) => {
      if (callStatusRef.current === 'idle') {
        setIncomingCallData({ signal, from, callerInfo });
        setCallStatus('incoming');
      }
    });

    socket.on("call_accepted", async (signal) => {
      if (peerRef.current && peerRef.current.signalingState !== 'closed') {
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } catch(e) {}
      }
      setCallStatus('connected');
    });

    socket.on("ice_candidate", async ({ candidate }) => {
       if (peerRef.current && candidate && peerRef.current.signalingState !== 'closed') {
         try {
           await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
         } catch(e) {}
       }
    });

    socket.on("call_ended", () => {
      cleanup();
    });

    return () => {
      socket.off("call_incoming");
      socket.off("call_accepted");
      socket.off("ice_candidate");
      socket.off("call_ended");
    };
  }, []);

  const createPeer = (s: MediaStream, targetId: string) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current = peer;
    s.getTracks().forEach(t => peer.addTrack(t, s));

    peer.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
    };

    peer.onicecandidate = async (e) => {
      if (e.candidate) {
        // Send candidate via socket as backup
        socket.emit("ice_candidate", { to: targetId, candidate: e.candidate });
        
        // Send candidate via Firestore
        if (currentUserRef.current) {
          const msgId = `call_cand_${currentUserRef.current.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          await setDoc(doc(db, 'messages', msgId), {
            id: msgId,
            sender_id: currentUserRef.current.id,
            receiver_id: targetId,
            type: 'call_signal',
            signalType: 'candidate',
            signalData: {
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex
            },
            timestamp: Date.now()
          }).catch(err => console.error("Error writing candidate", err));
        }
      }
    };
    return peer;
  };

  const getMediaStream = async (requestedType: 'audio' | 'video' | null, currentFacingMode: 'user' | 'environment'): Promise<MediaStream> => {
    if (requestedType === 'audio') {
      const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setIsVideo(false);
      return s;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode }, audio: true });
      setIsVideo(true);
      return s;
    } catch (err) {
      console.warn("Could not access both camera and microphone, trying audio-only...", err);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setIsVideo(false);
        return s;
      } catch (err2) {
        console.error("Audio-only access also denied or failed:", err2);
        throw err2;
      }
    }
  };

  const flipCamera = async () => {
    if (!isVideo || !stream || !peerRef.current) return;
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    try {
      // Request only video to flip
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: newFacingMode } } 
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;
      
      // Stop ONLY the old video track
      const oldVideoTrack = stream.getVideoTracks()[0];
      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      
      // Add the new track to the existing stream to keep audio intact
      stream.addTrack(newVideoTrack);
      
      // Force update video element
      if (myVideo.current) {
        myVideo.current.srcObject = null;
        myVideo.current.srcObject = stream;
      }
      
      // Replace video track in peer connection
      const senders = peerRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newVideoTrack).catch(e => console.error("replaceTrack failed", e));
      }
    } catch (err) {
      console.error("Error flipping camera", err);
    }
  };

  const startCall = async () => {
    if (!callTo || !currentUser) return;
    try {
      const s = await getMediaStream(callTypeRef.current, facingMode);
      setStream(s);
      const peer = createPeer(s, callTo.id);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const callerInfo = {
        id: currentUser.id,
        name: currentUser.name || currentUser.username,
        username: currentUser.username,
        avatar_url: currentUser.avatar_url || null,
        call_type: callTypeRef.current
      };

      // Write signaling message to Firestore messages collection (ringing)
      const msgId = `call_sig_${currentUser.id}_${Date.now()}`;
      await setDoc(doc(db, 'messages', msgId), {
        id: msgId,
        sender_id: currentUser.id,
        receiver_id: callTo.id,
        type: 'call_signal',
        signalType: 'offer',
        signalData: {
          type: offer.type,
          sdp: offer.sdp
        },
        callerInfo,
        timestamp: Date.now()
      });

      // Emit call_user via Socket as backup
      socket.emit("call_user", { 
        userToCall: callTo.id, 
        signalData: offer, 
        from: currentUser.id,
        callerInfo
      }, (response: any) => {});

    } catch (e) {
      console.error(e);
      alert("Microphone/Camera access denied. Please allow permissions or open the app in a new tab to make calls.");
      setCallStatus('idle');
    }
  };

  useEffect(() => {
    if (callStatus === 'calling' && callTo) {
      startCall();
    }
  }, [callStatus, callTo]);

  const answerCall = async () => {
    if (!incomingCallData || !currentUser) return;
    try {
      const incomingCallType = incomingCallData.callerInfo?.call_type || 'video';
      const s = await getMediaStream(incomingCallType, facingMode);
      setStream(s);
      const peer = createPeer(s, incomingCallData.from);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCallData.signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // Send answer via Firestore messages collection
      const msgId = `call_sig_${currentUser.id}_${Date.now()}`;
      await setDoc(doc(db, 'messages', msgId), {
        id: msgId,
        sender_id: currentUser.id,
        receiver_id: incomingCallData.from,
        type: 'call_signal',
        signalType: 'answer',
        signalData: {
          type: answer.type,
          sdp: answer.sdp
        },
        timestamp: Date.now()
      });

      // Answer backup via socket
      socket.emit("answer_call", { to: incomingCallData.from, signal: answer });

      setCallStatus('connected');

    } catch(e) {
      console.error(e);
      alert("Microphone/Camera access denied. Please allow permissions or open the app in a new tab to answer calls.");
      rejectCall();
    }
  };

  const rejectCall = async () => {
    if (incomingCallData && currentUser) {
      // Send rejected signal via Firestore
      const msgId = `call_sig_${currentUser.id}_${Date.now()}`;
      await setDoc(doc(db, 'messages', msgId), {
        id: msgId,
        sender_id: currentUser.id,
        receiver_id: incomingCallData.from,
        type: 'call_signal',
        signalType: 'rejected',
        timestamp: Date.now()
      }).catch(console.error);

      socket.emit("end_call", { to: incomingCallData.from });
    }
    cleanup();
  };

  const endCall = async () => {
    const targetId = callTo?.id || incomingCallData?.from;
    if (targetId && currentUser) {
      // Send ended signal via Firestore
      const msgId = `call_sig_${currentUser.id}_${Date.now()}`;
      await setDoc(doc(db, 'messages', msgId), {
        id: msgId,
        sender_id: currentUser.id,
        receiver_id: targetId,
        type: 'call_signal',
        signalType: 'ended',
        timestamp: Date.now()
      }).catch(console.error);

      socket.emit("end_call", { to: targetId });
    }
    cleanup();
  };

  const toggleMic = () => {
    if (stream) {
      const isMuting = !micMuted;
      stream.getAudioTracks().forEach(t => t.enabled = !isMuting);
      setMicMuted(isMuting);
      if (isMuting) playSound('mic_muted');
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideo(!isVideo);
      playSound('click');
    }
  };

  const toggleSpeaker = () => {
    setSpeakerOn(!speakerOn);
    playSound('speaker_toggle');
  };

  useEffect(() => {
    if (isVideo) setSpeakerOn(true);
  }, [isVideo]);

  useEffect(() => {
    if (callStatus === 'idle') {
      setProximityClose(false);
      return;
    }

    let sensor: any;
    if ('ProximitySensor' in window) {
      try {
        // @ts-ignore
        sensor = new (window as any).ProximitySensor({ frequency: 5 });
        sensor.addEventListener('reading', () => {
          setProximityClose(sensor.distance < 3);
        });
        sensor.start();
      } catch(e) {
        console.log('Proximity API not supported or no permission.');
      }
    }
    
    const handleProximity = (e: any) => {
       setProximityClose(e.near);
    };
    window.addEventListener('userproximity', handleProximity);
    
    return () => {
      if (sensor && typeof sensor.stop === 'function') sensor.stop();
      window.removeEventListener('userproximity', handleProximity);
    }
  }, [callStatus]);

  useEffect(() => {
    if (myVideo.current && stream) myVideo.current.srcObject = stream;
  }, [stream, callStatus]);

  useEffect(() => {
    if (remoteVideo.current && remoteStream) remoteVideo.current.srcObject = remoteStream;
  }, [remoteStream, callStatus]);
  
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(false);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    pipStartPos.current = { ...pipPos };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setIsDragging(true);
      setPipPos({
        x: pipStartPos.current.x + dx,
        y: pipStartPos.current.y + dy
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const parent = e.currentTarget.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const pipRect = e.currentTarget.getBoundingClientRect();
      
      const pipW = pipRect.width;
      const pipH = pipRect.height;
      
      const centerX = pipRect.left - parentRect.left + pipW / 2;
      const centerY = pipRect.top - parentRect.top + pipH / 2;
      
      const targetX1 = 24 + pipW / 2;
      const targetX2 = parentRect.width - 24 - pipW / 2;
      
      const targetY1 = 24 + pipH / 2;
      const targetY2 = parentRect.height / 2;
      const targetY3 = parentRect.height - 24 - pipH / 2;
      
      const snapXs = [targetX1, targetX2];
      const snapYs = [targetY1, targetY2, targetY3];
      
      let closestX = snapXs[0];
      if (Math.abs(centerX - snapXs[1]) < Math.abs(centerX - closestX)) closestX = snapXs[1];
      
      let closestY = snapYs[0];
      if (Math.abs(centerY - snapYs[1]) < Math.abs(centerY - closestY)) closestY = snapYs[1];
      if (Math.abs(centerY - snapYs[2]) < Math.abs(centerY - closestY)) closestY = snapYs[2];
      
      const deltaX = closestX - centerX;
      const deltaY = closestY - centerY;
      
      setIsDragging(false); // Set false immediately to enable transition
      
      // small delay to let react apply the transition class before changing pos
      setTimeout(() => {
        setPipPos(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
      }, 10);
    } else {
      setIsDragging(false);
    }
  };

  if (callStatus === 'idle') return null;

  return (
    <div className="absolute inset-0 z-[100] bg-[var(--bg-primary)] flex flex-col items-center justify-between transition-colors duration-300" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      {/* Background dark overlay for better text readability */}
      <div className="absolute inset-0 bg-[var(--bg-primary)]/60 pointer-events-none" />
      
      {callStatus === 'calling' && callTo && (
        <div className="w-full flex-1 flex flex-col items-center relative z-10 pt-10 pb-8">
          <div className="w-full flex justify-between items-start px-4">
             <button onClick={endCall} className="text-white hover:bg-white/10 p-2 rounded-full transition-colors">
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
             </button>
             <div className="flex flex-col items-center mt-2">
                <h2 className="text-2xl text-white font-bold" dir="auto">{callTo.name || callTo.username}</h2>
                <p className="text-gray-300 text-sm mt-1">{t('chat.ringing') || 'Ringing ...'}</p>
             </div>
             <div className="flex items-center text-white">
                <button className="hover:bg-white/10 p-2 rounded-full transition-colors">
                   <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                </button>
                <button className="hover:bg-white/10 p-2 rounded-full transition-colors">
                   <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </button>
             </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center w-full mt-4 mb-8">
             <div className="w-56 h-56 rounded-full bg-accent-primary flex items-center justify-center text-6xl text-white font-bold uppercase shadow-2xl overflow-hidden border-4 border-[#1f2c34]">
               {callTo.avatar_url ? (
                  <img src={callTo.avatar_url} alt="" className="w-full h-full object-cover" />
               ) : (
                  callTo.username.charAt(0)
               )}
             </div>
          </div>
          
          <div className="w-full px-4 pb-4">
            <div className="bg-[#1f2c34] rounded-[40px] px-2 py-3 flex items-center justify-between">
              <button className="w-14 h-14 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                 <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
              </button>
              <button onClick={toggleVideo} className={`w-14 h-14 rounded-full ${!isVideo ? 'bg-transparent text-white opacity-50' : 'bg-transparent text-white'} flex items-center justify-center hover:bg-white/10 transition-colors`}>
                 <Video size={26} fill={isVideo ? "none" : "currentColor"} />
              </button>
              <button onClick={toggleSpeaker} className={`w-14 h-14 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition-colors ${!speakerOn ? 'opacity-50' : ''}`}>
                 {speakerOn ? <Volume2 size={26} /> : <VolumeX size={26} />}
              </button>
              <button onClick={toggleMic} className={`w-14 h-14 rounded-full bg-transparent ${micMuted ? 'text-white opacity-50' : 'text-white'} flex items-center justify-center hover:bg-white/10 transition-colors`}>
                 {micMuted ? <MicOff size={26} /> : <Mic size={26} fill={micMuted ? "none" : "currentColor"} />}
              </button>
              <button onClick={endCall} className="w-14 h-14 bg-[#f15c6d] rounded-full flex items-center justify-center text-white hover:bg-[#e04c5c] transition-colors shadow-lg">
                 <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-[135deg]"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {callStatus === 'incoming' && incomingCallData && (() => {
        const callerUser = incomingCallData.callerInfo || (incomingCallData.from ? users[incomingCallData.from] : null);
        const callerName = callerUser?.name || callerUser?.username || 'Unknown Caller';
        const callerAvatar = callerUser?.avatar_url;
        const callerInitial = (callerUser?.name || callerUser?.username || '?').charAt(0).toUpperCase();

        return (
          <div className="w-full flex-1 flex flex-col items-center justify-between relative z-10 pt-16 pb-12 bg-[#0b141a]">
            {/* WhatsApp-style doodle background */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://i.ibb.co/6H9nB39/whatsapp-bg.png')] bg-repeat mix-blend-overlay pointer-events-none" />
            
            <div className="flex flex-col items-center mt-4 z-10">
               <h2 className="text-4xl text-white font-bold text-center px-6 tracking-wide drop-shadow-md" dir="auto">
                 {callerName}
               </h2>
               <p className="text-gray-400 text-sm mt-2 flex items-center justify-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#00a884] animate-pulse shadow-[0_0_8px_#00a884]" />
                  HiSEND {incomingCallData.callerInfo?.call_type === 'video' ? 'Video' : 'Audio'} Call
               </p>
            </div>
            
            <div className="flex-1 flex items-center justify-center w-full my-8 z-10">
               <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-[#128c7e]/20 flex items-center justify-center text-7xl text-white font-bold uppercase shadow-2xl overflow-hidden relative">
                 {callerAvatar ? (
                    <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                 ) : (
                    <span className="text-white drop-shadow-md">{callerInitial}</span>
                 )}
               </div>
            </div>
            
            <div className="w-full px-8 flex justify-between items-end pb-8 max-w-sm z-10">
              <div className="flex flex-col items-center gap-2.5">
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 bg-[#eb5545] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#d44032] transition-colors active:scale-95"
                >
                  <PhoneDown size={30} fill="currentColor" />
                </button>
                <span className="text-gray-300 text-[13px] font-medium mt-1 tracking-wide">{lang === 'ar' ? 'رفض' : 'Decline'}</span>
              </div>

              <div className="flex flex-col items-center gap-1 relative -top-6">
                <motion.div 
                  animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }} 
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="flex flex-col items-center mb-1 text-gray-300"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="-mt-4"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </motion.div>
                <motion.div 
                  drag="y"
                  dragConstraints={{ top: -120, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                     if (info.offset.y < -50) answerCall();
                  }}
                  className="w-18 h-18 bg-[#4cd964] text-white rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing relative p-4"
                  title={lang === 'ar' ? 'اسحب للأعلى للرد' : 'Swipe up to accept'}
                >
                  {incomingCallData.callerInfo?.call_type === 'video' ? <Video size={32} fill="currentColor" /> : <Phone size={32} fill="currentColor" />}
                </motion.div>
                <span className="text-gray-300 text-[13px] font-medium mt-3 tracking-wide">{lang === 'ar' ? 'اسحب للقبول' : 'Swipe up to accept'}</span>
              </div>
              
              <div className="flex flex-col items-center gap-2.5">
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 bg-[#ffffff20] backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#ffffff30] transition-colors active:scale-95"
                >
                  <MessageSquare size={26} fill="currentColor" />
                </button>
                <span className="text-gray-300 text-[13px] font-medium mt-1 tracking-wide">{lang === 'ar' ? 'رسالة' : 'Message'}</span>
              </div>
            </div>
          </div>
        );
      })()}
      
      {callStatus === 'connected' && (
        <div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-300 z-10">
          <div className="flex-1 relative bg-[var(--bg-primary)] overflow-hidden flex items-center justify-center">
            
            {/* Always mount video elements for streams */}
            <div className={isVideo ? (swapPiP 
              ? `absolute w-32 md:w-48 h-48 md:h-64 rounded-xl overflow-hidden shadow-2xl z-10 cursor-move touch-none border-2 border-[var(--bg-tertiary)] ${!isDragging ? 'transition-transform duration-300' : ''}` 
              : `absolute inset-0 w-full h-full`) : 'hidden'
            }
            style={isVideo && swapPiP ? { transform: `translate(${pipPos.x}px, ${pipPos.y}px)`, bottom: '24px', [lang === 'ar' ? 'left' : 'right']: '24px' } : {}}
            onPointerDown={isVideo && swapPiP ? handlePointerDown : undefined}
            onPointerMove={isVideo && swapPiP ? handlePointerMove : undefined}
            onPointerUp={isVideo && swapPiP ? handlePointerUp : undefined}
            onPointerCancel={isVideo && swapPiP ? handlePointerUp : undefined}
            onClick={() => { if (isVideo && swapPiP && !isDragging) setSwapPiP(false); }}
            >
              <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
            </div>

            <div className={isVideo ? (!swapPiP 
              ? `absolute w-32 md:w-48 h-48 md:h-64 rounded-xl overflow-hidden shadow-2xl z-10 cursor-move touch-none border-2 border-[var(--bg-tertiary)] ${!isDragging ? 'transition-transform duration-300' : ''}` 
              : `absolute inset-0 w-full h-full`) : 'hidden'
            }
            style={isVideo && !swapPiP ? { transform: `translate(${pipPos.x}px, ${pipPos.y}px)`, bottom: '24px', [lang === 'ar' ? 'left' : 'right']: '24px' } : {}}
            onPointerDown={isVideo && !swapPiP ? handlePointerDown : undefined}
            onPointerMove={isVideo && !swapPiP ? handlePointerMove : undefined}
            onPointerUp={isVideo && !swapPiP ? handlePointerUp : undefined}
            onPointerCancel={isVideo && !swapPiP ? handlePointerUp : undefined}
            onClick={() => { if (isVideo && !swapPiP && !isDragging) setSwapPiP(true); }}
            >
              <video ref={myVideo} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              {isVideo && !swapPiP && (
                <button 
                  onClick={(e) => { e.stopPropagation(); flipCamera(); }} 
                  className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-20 shadow-md"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                </button>
              )}
            </div>

            {!isVideo && (
              <div className="flex flex-col items-center justify-center animate-in fade-in duration-500 z-0">
                <div className="w-48 h-48 rounded-full bg-[#128c7e]/20 flex items-center justify-center text-5xl text-white font-bold uppercase shadow-2xl border-4 border-[#00a884]/30 overflow-hidden relative mb-8">
                   {(() => {
                     const partnerInfo = incomingCallData ? incomingCallData.callerInfo : callTo;
                     if (partnerInfo?.avatar_url) {
                       return <img src={partnerInfo.avatar_url} alt={partnerInfo.name || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                     }
                     return <span className="text-white drop-shadow-md">{(partnerInfo?.name || partnerInfo?.username || '?')[0]}</span>;
                   })()}
                   <div className="absolute inset-0 bg-[#00a884]/20 animate-pulse pointer-events-none" />
                </div>
                <h2 className="text-3xl text-white font-bold" dir="auto">{incomingCallData?.callerInfo?.name || callTo?.name || incomingCallData?.callerInfo?.username || callTo?.username}</h2>
                <p className="text-[#00a884] font-medium mt-2">
                  {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-[var(--bg-primary)] px-4 pb-4 pt-4">
            <div className="bg-[#1f2c34] rounded-[40px] px-2 py-3 flex items-center justify-between">
              <button className="w-14 h-14 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                 <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
              </button>
              <button onClick={toggleVideo} className={`w-14 h-14 rounded-full ${!isVideo ? 'bg-transparent text-white opacity-50' : 'bg-transparent text-white'} flex items-center justify-center hover:bg-white/10 transition-colors`}>
                 <Video size={26} fill={isVideo ? "none" : "currentColor"} />
              </button>
              <button onClick={toggleSpeaker} className={`w-14 h-14 rounded-full bg-transparent flex items-center justify-center text-white hover:bg-white/10 transition-colors ${!speakerOn ? 'opacity-50' : ''}`}>
                 {speakerOn ? <Volume2 size={26} /> : <VolumeX size={26} />}
              </button>
              <button onClick={toggleMic} className={`w-14 h-14 rounded-full bg-transparent ${micMuted ? 'text-white opacity-50' : 'text-white'} flex items-center justify-center hover:bg-white/10 transition-colors`}>
                 {micMuted ? <MicOff size={26} /> : <Mic size={26} fill={micMuted ? "none" : "currentColor"} />}
              </button>
              <button onClick={endCall} className="w-14 h-14 bg-[#f15c6d] rounded-full flex items-center justify-center text-white hover:bg-[#e04c5c] transition-colors shadow-lg">
                 <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-[135deg]"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Proximity Black Screen */}
      {!isVideo && !speakerOn && proximityClose && (
        <div className="absolute inset-0 bg-black z-[200]" />
      )}
    </div>
  );
}
