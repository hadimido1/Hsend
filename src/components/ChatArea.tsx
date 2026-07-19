/// <reference types="vite/client" />
import CustomAudioPlayer from './CustomAudioPlayer';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import GifPicker from './GifPicker';
import React, { useState, useEffect, useRef } from 'react';
import { useStore, Message } from '../lib/store';
import { playSound, NOTIFICATION_SOUNDS, RINGTONE_SOUNDS } from '../lib/sounds';
import { Send, PhoneMissed, Phone, Video, Info, Lock, Timer, ArrowRight, Mic, Smile, Paperclip, Camera as CameraIcon, Check, CheckCheck, Trash2, Reply, Forward, X, Copy, Sticker, Heart, Pencil, ChevronDown, ChevronUp, Keyboard, Search, MoreVertical, Image as ImageIcon, Ban, Download, Crop, Palette, Type, RotateCw, RotateCcw, Bell, Users } from 'lucide-react';
import { deleteDoc, collection, query, where, orderBy, onSnapshot, setDoc, doc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { socket } from '../lib/socket';
import { db } from '../lib/firebase';
import { encryptMessage, importPublicKey, importPrivateKey, decryptMessage } from '../lib/crypto';
import { format } from 'date-fns';
import { useTranslation } from '../lib/i18n';
import Markdown from 'react-markdown';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { saveRecentSticker, toggleFavoriteSticker } from '../lib/giphy';

const getChatId = (user1: string, user2: string) => {
    return user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;
};

const getRelativeCoords = (element: HTMLElement, container: HTMLElement, imgElement: HTMLImageElement, rotation: number) => {
  const rect = element.getBoundingClientRect();
  const px = rect.left + rect.width / 2;
  const py = rect.top + rect.height / 2;

  const containerRect = container.getBoundingClientRect();
  const cx = containerRect.left + containerRect.width / 2;
  const cy = containerRect.top + containerRect.height / 2;

  // Rotate (px, py) around (cx, cy) by -rotation degrees
  const rad = (-rotation * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const ux = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
  const uy = cy + dx * Math.sin(rad) + dy * Math.cos(rad);

  const w = imgElement.clientWidth;
  const h = imgElement.clientHeight;

  const rx = ux - (cx - w / 2);
  const ry = uy - (cy - h / 2);

  return { x: rx, y: ry };
};

const rotateBase64Image = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = base64Str;
  });
};

const MessageItem = React.memo(({ 
  msg, 
  currentUser, 
  partner, 
  lang, 
  isSelected, 
  selectedMessages, 
  setSelectedMessages, 
  setSelectedImage, 
  setReplyingTo, 
  db,
  CustomAudioPlayer,
  Markdown,
  showMoreEmojis,
  setShowMoreEmojis,
  playingAudioId,
  setPlayingAudioId,
  handleAudioEnded
}: any) => {
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [15, 60], [0, 1]);
  const iconScale = useTransform(x, [15, 60], [0.5, 1]);
  const iconX = useTransform(x, [15, 60], [lang === 'ar' ? 20 : -20, 0]);

  const isMe = msg.sender_id === currentUser?.id;
  const isAI = msg.sender_id === 'hbot-ai';
    // If parent has dir="rtl", justify-start is right. If dir="ltr", justify-end is right.
  const justifyClass = isMe ? (lang === 'ar' ? 'justify-start' : 'justify-end') : (lang === 'ar' ? 'justify-end' : 'justify-start');
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const allEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💔', '🤔', '💯', '✨', '👀', '🚀', '🙌'];

  const handleReaction = async (emoji: string) => {
    try {
       const docRef = doc(db, 'messages', msg.id);
       const newReactions = { ...(msg.reactions || {}) };
       if (!newReactions[emoji]) newReactions[emoji] = [];
       
       const userIndex = newReactions[emoji].indexOf(currentUser.id);
       if (userIndex > -1) {
           // Remove reaction if already exists
           newReactions[emoji].splice(userIndex, 1);
           if (newReactions[emoji].length === 0) delete newReactions[emoji];
       } else {
           // Add reaction
           newReactions[emoji].push(currentUser.id);
       }
       await updateDoc(docRef, { reactions: newReactions });
    } catch(err) { console.error(err); }
    setSelectedMessages([]);
  };

  return (
    <motion.div 
      
      id={`msg-${msg.id}`}
      className={`w-full flex relative transition-colors duration-300 ${isSelected ? 'bg-[#005c4b]/40' : ''} ${justifyClass} py-0.5 px-3 sm:px-6 group`}
      onClick={() => {
         if (selectedMessages.length > 0) {
            playSound('click');
            setSelectedMessages((prev: string[]) => prev.includes(msg.id) ? prev.filter((id: string) => id !== msg.id) : [...prev, msg.id]);
         }
      }}
    >
      <AnimatePresence>
        {isSelected && (
           <motion.div
             key="check"
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             exit={{ scale: 0, opacity: 0 }}
             transition={{ type: 'spring', stiffness: 400, damping: 25 }}
             className={`absolute top-1/2 -translate-y-1/2 ${lang === 'ar' ? 'right-2 sm:right-6' : 'left-2 sm:left-6'} w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-md z-20 pointer-events-none`}
           >
             <Check size={16} strokeWidth={3} />
           </motion.div>
        )}
      </AnimatePresence>
      {/* Swipe Background Icon */}
      <motion.div 
        style={{ opacity: iconOpacity, scale: iconScale, x: iconX }}
        className={`absolute top-1/2 -translate-y-1/2 ${lang === 'ar' ? 'right-8' : 'left-8'}`}
      >
        <div className="bg-[var(--bg-hover)] p-2 rounded-full shadow-lg">
          <Reply size={20} className="text-[#00a884]" />
        </div>
      </motion.div>

      {isSelected && selectedMessages.length === 1 && (
        <div className={`absolute bottom-full mb-2 z-50 bg-[var(--bg-tertiary)] rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl border border-[var(--bg-secondary)] ${isMe ? 'right-4' : 'left-4'}`}>
          {reactionEmojis.map(emoji => (
             <button 
               key={emoji} 
               className={`text-2xl hover:scale-125 transition-transform ${(msg.reactions?.[emoji] || []).includes(currentUser.id) ? 'grayscale-0 scale-110' : 'grayscale hover:grayscale-0'}`} 
               onClick={(e) => {
                e.stopPropagation();
                handleReaction(emoji);
             }}>
               {emoji}
             </button>
          ))}
          <div className="relative">
            <button 
              className="w-8 h-8 rounded-full bg-[var(--border-primary)] flex items-center justify-center text-white text-xl ml-2 hover:bg-[#465258]"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setShowMoreEmojis({ msgId: msg.id, x: rect.left, y: rect.top });
              }}
            >+</button>
            
            {showMoreEmojis?.msgId === msg.id && (
              <div 
                className="fixed z-[100] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl p-2 grid grid-cols-4 gap-1 animate-in fade-in zoom-in duration-200"
                style={{ 
                  left: Math.min(window.innerWidth - 180, Math.max(10, showMoreEmojis.x - 70)), 
                  top: showMoreEmojis.y - 180 
                }}
              >
                {allEmojis.map(emoji => (
                  <button 
                    key={emoji} 
                    className={`p-2 text-xl hover:bg-[var(--bg-hover)] rounded-lg transition-colors ${(msg.reactions?.[emoji] || []).includes(currentUser.id) ? 'bg-[var(--bg-hover)]' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReaction(emoji);
                      setShowMoreEmojis(null);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <motion.div 
        style={{ x, touchAction: "pan-y" }}
        transition={{ duration: 0.15 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={(_, info) => {
          if (info.offset.x > 70) {
            setReplyingTo(msg);
          }
        }}
        onContextMenu={(e) => { e.preventDefault(); if (!isSelected) { playSound('click'); setSelectedMessages((prev: string[]) => [...prev, msg.id]); } }}
        className={`flex flex-col max-w-[92%] sm:max-w-[85%] relative z-10`}
      >
        <div 
          className={`p-2.5 rounded-xl shadow-sm relative w-fit max-w-full min-w-0 transition-all ${isSelected ? 'scale-[0.98]' : ''} ${
            isMe 
              ? 'bg-[var(--bubble-me)] text-[var(--bubble-me-text)] rounded-tr-none'
              : isAI 
                ? 'animate-rgb-border text-text-primary'
                : 'bg-[var(--bubble-other)] text-[var(--bubble-other-text)] rounded-tl-none'
          }`}
        >
          {msg.reply_to && (
            <div 
              className={`bg-black/20 ${lang === 'ar' ? 'border-r-4' : 'border-l-4'} border-[#00a884] rounded-lg p-2 mb-2 flex flex-col gap-0.5 cursor-pointer hover:bg-black/30 transition-colors border-solid`}
              onClick={(e) => {
                e.stopPropagation();
                const parentMsg = document.getElementById(`msg-${msg.reply_to!.id}`);
                parentMsg?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                parentMsg?.classList.add('bg-accent-primary/20');
                setTimeout(() => parentMsg?.classList.remove('bg-accent-primary/20'), 1500);
              }}
            >
              <span className="text-[#00a884] text-[10px] font-bold">{msg.reply_to.sender_name}</span>
              <p className="text-text-muted text-xs truncate max-w-[200px] flex items-center gap-1">
                {msg.reply_to.type === 'image' ? (lang === 'ar' ? <><CameraIcon size={12}/> صورة</> : <><CameraIcon size={12}/> Image</>) : 
                 msg.reply_to.type === 'audio' ? (lang === 'ar' ? <><Mic size={12}/> رسالة صوتية</> : <><Mic size={12}/> Audio message</>) : 
                 msg.reply_to.content}
              </p>
            </div>
          )}
          {isAI ? (
            <div className="text-sm sm:text-base leading-relaxed markdown-body prose prose-invert max-w-none prose-p:my-1 prose-a:text-purple-400 prose-img:rounded-lg prose-img:max-w-full break-words">
              <Markdown>{msg.content}</Markdown>
            </div>
          ) : msg.type === 'text' || !msg.type ? (
            <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words font-sans">
              {msg.content}
            </div>
          ) : msg.type === 'call_log' || msg.type === 'call' || msg.type === 'call_missed' || msg.content === 'Voice call' || msg.content === 'مكالمة فائتة' || msg.content === 'مكالمة صوتية' || msg.content === 'Missed call' || msg.content === 'No answer' ? (() => {
             const isMissed = msg.type === 'call_missed' || msg.content?.includes('missed') || msg.content?.includes('فائتة') || msg.content?.includes('No answer');
             const isVideo = msg.content?.includes('video') || msg.content?.includes('Video');
             return (
            <div 
              className="flex items-center gap-3 pr-4 cursor-pointer hover:opacity-80 active:scale-95 transition-all"
              onClick={(e) => {
                 e.stopPropagation();
                 
                 useStore.getState().setCallStatus('calling', partner, isVideo ? 'video' : 'audio');
              }}
            >
              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                {isVideo ? (
                   <Video size={20} className={isMissed && !isMe ? 'text-red-500' : 'text-gray-400'} />
                ) : isMe ? (
                   <Phone size={20} className="text-gray-400" />
                ) : (
                   <PhoneMissed size={20} className={isMissed ? 'text-red-500' : 'text-[#00a884]'} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-white/90">
                  {isMe ? (isVideo ? (lang === 'ar' ? 'مكالمة فيديو' : 'Video call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call')) : (isMissed ? (lang === 'ar' ? 'مكالمة فائتة' : 'Missed call') : (isVideo ? (lang === 'ar' ? 'مكالمة فيديو' : 'Video call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call')))}
                </span>
                <span className="text-[13px] text-white/60 mt-0.5 flex items-center gap-1 font-medium">
                   {isMe ? (
                     <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path><polyline points="14 2 22 2 22 10"></polyline><line x1="22" y1="2" x2="16" y2="8"></line></svg>
                        {isMissed ? (lang === 'ar' ? 'لم يتم الرد' : 'No answer') : (lang === 'ar' ? 'تم الرد' : 'Answered')}
                     </>
                   ) : (
                     <>
                        {isMissed ? <PhoneMissed size={12} className="text-red-500" /> : <Phone size={12} className="text-gray-400" />}
                        {isMissed ? (lang === 'ar' ? 'لم يتم الرد' : 'No answer') : (lang === 'ar' ? 'مكالمة واردة' : 'Incoming call')}
                     </>
                   )}
                </span>
              </div>
            </div>
          );})()
          : msg.type === 'audio' ? (
            <div className="relative">
              {selectedMessages?.length > 0 && (
                <div className="absolute inset-0 z-50 cursor-pointer" />
              )}
              <CustomAudioPlayer 
                src={msg.content} 
                isMe={isMe} 
                partnerAvatar={partner?.avatar_url} 
                myAvatar={currentUser?.avatar_url} 
                shouldPlay={playingAudioId === msg.id}
                onPlayStart={() => setPlayingAudioId && setPlayingAudioId(msg.id)}
                onEnded={() => handleAudioEnded && handleAudioEnded(msg.id)}
              />
            </div>
          ) : msg.type === 'image' ? (
            <div className="flex flex-col gap-1.5 max-w-full">
              <div className="relative group/sticker max-w-full overflow-hidden flex items-center justify-center rounded-lg bg-black/15 p-1">
                <img 
                  src={msg.content} 
                  className={`max-w-[240px] max-h-[240px] sm:max-w-[320px] sm:max-h-[320px] object-contain rounded-lg ${selectedMessages?.length > 0 ? '' : 'cursor-pointer hover:opacity-95 transition-opacity'}`} 
                  alt="Uploaded" 
                  onClick={() => {
                    if (selectedMessages?.length > 0) return;
                    setSelectedImage(msg.content);
                  }} 
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteSticker(msg.content);
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover/sticker:opacity-100 transition-opacity shadow-lg "
                  title={lang === 'ar' ? 'إضافة للمفضلة' : 'Add to favorites'}
                >
                  <Heart size={18} />
                </button>
              </div>
              {msg.caption && (
                <p className="text-sm text-[#e9edef] px-1 font-normal leading-relaxed break-words">{msg.caption}</p>
              )}
            </div>
          ) : (
            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          )}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-start' : 'justify-end'}`}>
            {msg.expires_at && (
              <span className={isMe ? 'text-white/80' : 'text-accent-primary'} title="رسالة مؤقتة">
                <Timer size={12} />
              </span>
            )}
            <span className={`text-[10px] opacity-80 ${isMe ? 'text-white/80' : 'text-text-muted'}`} dir="ltr">
              {msg.is_edited && (lang === 'ar' ? 'تم تعديلها ' : 'Edited ')}
              {format(msg.timestamp || Date.now(), 'HH:mm')}
            </span>
            {isMe && partner?.id !== 'hbot-ai' && (
              <span className={msg.status === 'read' ? 'text-blue-400' : 'text-text-muted'}>
                {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
              </span>
            )}
          </div>
          
          {isSelected && (
             <div className="absolute inset-0 bg-black/20 pointer-events-none rounded-xl" />
          )}
        </div>
        
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={`absolute bottom-[-10px] ${isMe ? 'right-2' : 'left-2'} bg-[var(--bg-tertiary)] rounded-full px-1.5 py-0.5 flex items-center gap-1 shadow-sm border border-[var(--bg-secondary)] text-[10px] z-10`}>
            {Object.entries(msg.reactions as Record<string, string[]>).map(([emoji, users]) => (
               <span key={emoji} className="flex items-center gap-0.5">
                 {emoji} {users.length > 1 && <span className="text-text-muted">{users.length}</span>}
               </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}, (prev, next) => {
  return prev.msg === next.msg &&
         prev.isSelected === next.isSelected &&
         prev.lang === next.lang &&
         (prev.selectedMessages.length > 0) === (next.selectedMessages.length > 0) &&
         (prev.showMoreEmojis?.msgId === prev.msg.id) === (next.showMoreEmojis?.msgId === next.msg.id) &&
         (prev.playingAudioId === prev.msg.id) === (next.playingAudioId === next.msg.id);
});

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function ChatArea() {
  const { t, lang } = useTranslation();
  const { activeChat, setActiveChat, users, currentUser, privateKeyPem, messages, addMessage, setMessages, typingUsers, contacts, addContact, blocked, blockUser, unblockUser, friendPreferences, setFriendPreference } = useStore();
  const [inputText, setInputText] = useState('');
  const [ttl, setTtl] = useState<number>(0); // 0 = off, else minutes
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingCancelledRef = useRef(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [canDeleteForEveryone, setCanDeleteForEveryone] = useState(false);
  
  const [showProfile, setShowProfile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [targetForwardUserId, setTargetForwardUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showMoreEmojis, setShowMoreEmojis] = useState<{msgId: string, x: number, y: number} | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [dismissedBanners, setDismissedBanners] = useState<Record<string, boolean>>({});
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [userToAdd, setUserToAdd] = useState<any | null>(null);
  const [friendNickname, setFriendNickname] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNicknameValue, setEditNicknameValue] = useState('');
  const [isBlockedByPartner, setIsBlockedByPartner] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Audio recording gestures states
  const [recordingLockState, setRecordingLockState] = useState<'idle' | 'recording' | 'locked'>('idle');
  const [trashAnimating, setTrashAnimating] = useState(false);

  // Image Editor States
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [editorMode, setEditorMode] = useState<'view' | 'draw' | 'text' | 'emoji' | 'crop'>('view');
  const [drawColor, setDrawColor] = useState('#00a884');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [drawPaths, setDrawPaths] = useState<any[]>([]);
  const [editorTexts, setEditorTexts] = useState<any[]>([]);
  const [editorEmojis, setEditorEmojis] = useState<any[]>([]);
  const [editorRotation, setEditorRotation] = useState(0);
  const [cropLeft, setCropLeft] = useState(0); // percentage 0-100
  const [cropRight, setCropRight] = useState(0); // percentage 0-100
  const [cropTop, setCropTop] = useState(0); // percentage 0-100
  const [cropBottom, setCropBottom] = useState(0); // percentage 0-100

  const [isDraggingColorSlider, setIsDraggingColorSlider] = useState(false);
  const [isDraggingBrushSlider, setIsDraggingBrushSlider] = useState(false);
  const [showTextAddDialog, setShowTextAddDialog] = useState(false);
  const [textValueToInsert, setTextValueToInsert] = useState('');

  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [recipientSearchText, setRecipientSearchText] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<any[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY;

  // GIPHY Suggestion Logic with Cache
  const [suggestionCache] = useState<Map<string, any[]>>(new Map());

  const isAnyModalOpen = showProfile || showEmojiPicker || showGifPicker || showForwardModal || showDeleteModal || showAddFriendModal || imageEditorOpen || showMoreEmojis !== null;

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash !== '#modal') {
        setShowProfile(false);
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        setShowForwardModal(false);
        setShowDeleteModal(false);
        setShowAddFriendModal(false);
        setImageEditorOpen(false);
        setShowMoreEmojis(null);
      }
    };
    window.addEventListener('hashchange', handleHash);
    
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    if (isAnyModalOpen && window.location.hash !== '#modal') {
      window.history.pushState(null, '', '#modal');
    } else if (!isAnyModalOpen && window.location.hash === '#modal') {
      window.history.back();
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (!giphyApiKey || !inputText.trim()) {
      setSuggestions([]);
      return;
    }

    const words = inputText.trim().split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    if (lastWord.length < 1) {
      setSuggestions([]);
      return;
    }

    // Check Cache first
    if (suggestionCache.has(lastWord)) {
      setSuggestions(suggestionCache.get(lastWord) || []);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { GiphyFetch } = await import('@giphy/js-fetch-api');
        const gf = new GiphyFetch(giphyApiKey);
        const options: any = { 
          type: 'stickers', 
          limit: 10
        };
        if (lang === 'ar') options.lang = 'ar';
        
        const { data } = await gf.search(lastWord, options);
        suggestionCache.set(lastWord, data);
        setSuggestions(data);
      } catch (err) {
        console.error('Giphy suggestion error:', err);
      }
    }, 800); // Increased debounce to 800ms

    return () => clearTimeout(timer);
  }, [inputText, giphyApiKey, lang, suggestionCache]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
    if (!showEmojiPicker) setShowGifPicker(false);
  };

  const toggleGifPicker = () => {
    setShowGifPicker(!showGifPicker);
    if (!showGifPicker) setShowEmojiPicker(false);
  };
  const partner = activeChat ? users[activeChat] : null;
  const chatMessages = activeChat ? messages[activeChat] || [] : [];

  useEffect(() => {
    if (imageEditorOpen && partner && selectedRecipients.length === 0) {
      setSelectedRecipients([partner.id]);
    }
  }, [imageEditorOpen, partner, selectedRecipients]);

  useEffect(() => {
    if (!imageEditorOpen) {
      setSelectedRecipients([]);
    }
  }, [imageEditorOpen]);
  
  const handleAudioEnded = (endedMsgId: string) => {
    // Find the current message index
    const currentIndex = chatMessages.findIndex(m => m.id === endedMsgId);
    if (currentIndex === -1 || currentIndex === chatMessages.length - 1) {
      setPlayingAudioId(null);
      return;
    }
    
    // Check if the next message is also audio
    const nextMsg = chatMessages[currentIndex + 1];
    if (nextMsg && nextMsg.type === 'audio') {
      setPlayingAudioId(nextMsg.id);
    } else {
      setPlayingAudioId(null);
    }
  };
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages]);

  useEffect(() => {
    if (!activeChat || activeChat === 'hbot-ai' || !currentUser) {
      setIsBlockedByPartner(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', activeChat), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const partnerBlockedList = data.blocked || [];
        setIsBlockedByPartner(partnerBlockedList.includes(currentUser.id));
      } else {
        setIsBlockedByPartner(false);
      }
    }, (err) => {
      console.error("Error listening to partner block status:", err);
    });

    return () => unsub();
  }, [activeChat, currentUser]);

  useEffect(() => {
    if (activeChat && currentUser && privateKeyPem) {
      const chatId = getChatId(currentUser.id, activeChat);
      const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
          let rawMsgs = snapshot.docs.map(d => {
              const data = d.data() as any;
              let ts = Date.now();
              if (data.timestamp) {
                  if (typeof data.timestamp === 'number') ts = data.timestamp;
                  else if (typeof data.timestamp.toMillis === 'function') ts = data.timestamp.toMillis();
              }
              return { ...data, timestamp: ts };
          });
          rawMsgs.sort((a, b) => a.timestamp - b.timestamp);
          rawMsgs = rawMsgs.filter(m => m.type !== 'call_signal' && (!m.deleted_for || !m.deleted_for.includes(currentUser.id)));
          
          for (const rm of rawMsgs) {
            if (rm.receiver_id === currentUser.id && rm.status !== 'read') {
              updateDoc(doc(db, 'messages', rm.id), { status: 'read' }).catch(console.error);
            }
          }

          if (activeChat === 'hbot-ai') {
              setMessages(activeChat, rawMsgs as any);
              return;
          }
          
          const privKey = await importPrivateKey(privateKeyPem);
          const decryptedMsgs: Message[] = [];
          
          for (const msg of rawMsgs) {
             if (blocked.includes(msg.sender_id)) {
                continue;
             }
             try {
               let encryptedContent = msg.content;
               try {
                 const parsed = JSON.parse(msg.content);
                 if (parsed.forReceiver && parsed.forSender) {
                   encryptedContent = msg.sender_id === currentUser.id ? parsed.forSender : parsed.forReceiver;
                 }
               } catch (e) {}
               
               const content = await decryptMessage(privKey, encryptedContent);
                let caption = msg.caption || '';
                if (caption) {
                  try {
                    const parsedCaption = JSON.parse(caption);
                    if (parsedCaption.forReceiver && parsedCaption.forSender) {
                      caption = msg.sender_id === currentUser.id ? parsedCaption.forSender : parsedCaption.forReceiver;
                    }
                  } catch (e) {}
                  try {
                    caption = await decryptMessage(privKey, caption);
                  } catch (e) {}
                };
               decryptedMsgs.push({ ...msg, content, caption });
             } catch (e) {
               console.error("Failed to decrypt msg", e);
               decryptedMsgs.push({ ...msg, content: '' });
             }
          }
          setMessages(activeChat, decryptedMsgs);
      });
      return () => unsubscribe();
    }
  }, [activeChat, currentUser, privateKeyPem]);

  const sendAudioMessage = async (base64Audio: string) => {
    if (!activeChat || !currentUser || !partner) return;
    playSound('send');
    try {
      const chatId = getChatId(currentUser.id, partner.id);
      const msgId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      
      if (partner.id === 'hbot-ai') {
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: base64Audio, 
          type: 'audio',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent'
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
        
        // Simulating AI acknowledging voice receipt
        const aiId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const aiMsgData = {
          id: aiId,
          chatId,
          sender_id: 'hbot-ai',
          receiver_id: currentUser.id,
          content: lang === 'ar' ? 'وصلتني رسالتك الصوتية وتم سماعها بنجاح!' : 'I received and successfully listened to your voice message!', 
          type: 'ai',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent'
        };
        await setDoc(doc(db, 'messages', aiId), aiMsgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, base64Audio);
        
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, base64Audio);

        const msgData = {
            id: msgId,
            chatId,
            sender_id: currentUser.id,
            receiver_id: partner.id,
            content: JSON.stringify({
              forReceiver: encryptedForPartner,
              forSender: encryptedForMe
            }), 
            type: 'audio',
            timestamp: serverTimestamp(),
            expires_at: expiresAt,
            status: 'sent'
          };
        
        await setDoc(doc(db, 'messages', msgId), msgData);
      }
      await ensurePartnerInHomeScreen();
    } catch (e) {
      console.error(e);
    }
  };

    const handleGifSelect = async (gifUrl: string) => {
    if (!activeChat || !currentUser || !partner) return;
    playSound('send');
    
    saveRecentSticker(gifUrl);
    
    try {
      const chatId = getChatId(currentUser.id, partner.id);
      const msgId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;

      if (partner.id === 'hbot-ai') {
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: gifUrl,
          type: 'image',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent'
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, gifUrl);
        
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, gifUrl);
        
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: JSON.stringify({
            forReceiver: encryptedForPartner,
            forSender: encryptedForMe
          }), 
          type: 'image',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent'
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
      }
      setShowGifPicker(false);
      await ensurePartnerInHomeScreen();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlockedByPartner) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For images, we should resize them to fit within 500KB limit
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                setPendingImage(dataUrl);
                setImageEditorOpen(true);
                setCaptionText('');
                setDrawPaths([]);
                setEditorTexts([]);
                setEditorEmojis([]);
                setEditorRotation(0);
                setCropLeft(0);
                setCropRight(0);
                setCropTop(0);
                setCropBottom(0);
                setEditorMode('view');
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    } else {
        alert("فقط الصور مدعومة حالياً بسبب قيود التشفير");
    }
  };

  const ensurePartnerInHomeScreen = async () => {
    if (currentUser && partner && partner.id !== 'hbot-ai') {
      const activeContacts = currentUser.contacts || [];
      if (!activeContacts.includes(partner.id)) {
        const newContacts = [...activeContacts, partner.id];
        try {
          await updateDoc(doc(db, 'users', currentUser.id), { contacts: newContacts });
          useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
        } catch (e) {
          console.error("Failed to add partner to home screen", e);
        }
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !partner || !currentUser || !privateKeyPem || isBlockedByPartner) return;

    if (editingMessage) {
        try {
            const docRef = doc(db, 'messages', editingMessage.id);
            let content = inputText.trim();
            
            if (partner.id !== 'hbot-ai') {
                const partnerPubKey = await importPublicKey(partner.public_key);
                const encryptedForPartner = await encryptMessage(partnerPubKey, content);
                const myPubKey = await importPublicKey(currentUser.public_key);
                const encryptedForMe = await encryptMessage(myPubKey, content);
                content = JSON.stringify({
                    forReceiver: encryptedForPartner,
                    forSender: encryptedForMe
                });
            }
            
            await updateDoc(docRef, { content, is_edited: true });
            setEditingMessage(null);
            setInputText('');
            return;
        } catch (err) {
            console.error(err);
        }
    }
    
    const plainText = inputText.trim();
    const currentReply = replyingTo;
    setInputText('');
    setReplyingTo(null);
    playSound('send');
    
    try {
      const msgId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      const chatId = getChatId(currentUser.id, partner.id);

      const replyData = currentReply ? {
        id: currentReply.id,
        content: currentReply.content,
        sender_name: currentReply.sender_id === currentUser.id ? (lang === 'ar' ? 'أنت' : 'You') : (partner.name || partner.username),
        type: currentReply.type
      } : null;
      
      if (partner.id === 'hbot-ai') {
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: plainText, 
          type: 'text',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent',
          reply_to: replyData
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
        
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: plainText })
        });
        
        let aiResponseText = "";
        if (res.ok) {
            const data = await res.json();
            aiResponseText = data.text;
        } else {
            const errorData = await res.json().catch(() => ({}));
            aiResponseText = errorData.text || (lang === 'ar' ? 'عذراً، حدث خطأ في الاتصال بالذكاء الاصطناعي.' : 'Sorry, something went wrong with the AI connection.');
        }

        const aiId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const aiMsgData = {
          id: aiId,
          chatId,
          sender_id: 'hbot-ai',
          receiver_id: currentUser.id,
          content: aiResponseText, 
          type: 'ai',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent'
        };
        await setDoc(doc(db, 'messages', aiId), aiMsgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, plainText);
        
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, plainText);
        
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: JSON.stringify({
            forReceiver: encryptedForPartner,
            forSender: encryptedForMe
          }), 
          type: 'text',
          timestamp: serverTimestamp(),
          expires_at: expiresAt,
          status: 'sent',
          reply_to: replyData
        };
        
        await setDoc(doc(db, 'messages', msgId), msgData);
      }
      
      await ensurePartnerInHomeScreen();
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancelRecording = () => {
    isRecordingCancelledRef.current = true;
    audioChunksRef.current = []; // Clear chunks so onstop guard triggers and won't send
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    playSound('record_cancel');
    setIsRecording(false);
    setRecordingLockState('idle');
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
    if (partner && partner.id !== 'hbot-ai' && currentUser) {
      socket.emit('typing', { sender_id: currentUser.id, receiver_id: partner.id, action: 'idle' });
    }
  };

  const handleCancelRecordingWithAnimation = () => {
    setTrashAnimating(true);
    handleCancelRecording();
    setTimeout(() => {
      setTrashAnimating(false);
    }, 1500);
  };

  const toggleRecording = async () => {
    if (isBlockedByPartner) return;
    const isCurrentlyRecording = mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive';
    if (isCurrentlyRecording) {
      isRecordingCancelledRef.current = false;
      // Stop and send normally
      mediaRecorderRef.current?.stop();
      playSound('record_stop');
      setIsRecording(false);
      setRecordingLockState('idle');
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
      if (partner && partner.id !== 'hbot-ai' && currentUser) {
        socket.emit('typing', { sender_id: currentUser.id, receiver_id: partner.id, action: 'idle' });
      }
    } else {
      try {
        playSound('record_start');
        isRecordingCancelledRef.current = false;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let options: MediaRecorderOptions = {};
        let mime = '';
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mime = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mime = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            mime = 'audio/aac';
        }
        if (mime) options = { mimeType: mime };
        
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => {
          const wasCancelled = isRecordingCancelledRef.current;
          stream.getTracks().forEach(t => t.stop());
          if (wasCancelled) {
            return;
          }
          if (audioChunksRef.current.length === 0) return; // Prevent sending if cancelled
          const blobType = mediaRecorder.mimeType || mime || 'audio/mp4';
          const blob = new Blob(audioChunksRef.current, { type: blobType });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            if (!wasCancelled && !isRecordingCancelledRef.current && audioChunksRef.current.length > 0) {
              sendAudioMessage(reader.result as string);
            }
          };
        };
        mediaRecorder.start();
        setIsRecording(true);
        setRecordingLockState('recording');
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(t => t + 1);
          if (partner && partner.id !== 'hbot-ai' && currentUser) {
            socket.emit('typing', { sender_id: currentUser.id, receiver_id: partner.id, action: 'recording' });
          }
        }, 1000);
      } catch (err) {
        console.error("Mic error", err);
        alert(t ? t('chat.mic_error_alert') : "Microphone access denied.");
      }
    }
  };

  const handleOpenDeleteModal = () => {
    // Determine if all selected messages were sent by the current user
    const allSentByMe = selectedMessages.every(id => {
      const msg = chatMessages.find(m => m.id === id);
      return msg && msg.sender_id === currentUser.id;
    });
    setCanDeleteForEveryone(allSentByMe);
    setShowDeleteModal(true);
  };

  const handleDeleteForMe = async () => {
    const ids = [...selectedMessages];
    setSelectedMessages([]);
    setShowDeleteModal(false);
    
    try {
      // Execute in parallel for extremely fast batch deletion!
      await Promise.all(ids.map(async (id) => {
        const msgRef = doc(db, 'messages', id);
        // Find if msg already has deleted_for
        const msg = chatMessages.find(m => m.id === id);
        const existingDeletedFor = msg?.deleted_for || [];
        if (!existingDeletedFor.includes(currentUser.id)) {
          await updateDoc(msgRef, {
            deleted_for: [...existingDeletedFor, currentUser.id]
          });
        }
      }));
    } catch (err) {
      console.error("Error in delete for me:", err);
    }
  };

  const handleDeleteForEveryone = async () => {
    const ids = [...selectedMessages];
    setSelectedMessages([]);
    setShowDeleteModal(false);
    
    try {
      // Execute in parallel for extremely fast batch deletion!
      await Promise.all(ids.map(id => deleteDoc(doc(db, 'messages', id))));
    } catch (err) {
      console.error("Error in delete for everyone:", err);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isRecording && recordingLockState === 'idle') {
      toggleRecording();
    } else if (isRecording && recordingLockState === 'locked') {
      toggleRecording();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isRecording && recordingLockState === 'recording') {
      toggleRecording();
    }
  };

  // Draw Canvas Event Listeners
  // Crop window dragging handler
  const handleCropDragStart = (e: React.MouseEvent | React.TouchEvent, handle: 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startTop = cropTop;
    const startBottom = cropBottom;
    const startLeft = cropLeft;
    const startRight = cropRight;

    const imgElement = document.querySelector('#editor-image-container img');
    if (!imgElement) return;
    const rect = imgElement.getBoundingClientRect();
    const widthPx = rect.width;
    const heightPx = rect.height;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;

      const dxPct = (dx / widthPx) * 100;
      const dyPct = (dy / heightPx) * 100;

      let newTop = startTop;
      let newBottom = startBottom;
      let newLeft = startLeft;
      let newRight = startRight;

      if (handle.includes('t')) newTop = Math.max(0, Math.min(startTop + dyPct, 100 - startBottom - 5));
      if (handle.includes('b')) newBottom = Math.max(0, Math.min(startBottom - dyPct, 100 - startTop - 5));
      if (handle.includes('l')) newLeft = Math.max(0, Math.min(startLeft + dxPct, 100 - startRight - 5));
      if (handle.includes('r')) newRight = Math.max(0, Math.min(startRight - dxPct, 100 - startLeft - 5));

      if (handle === 'top') newTop = Math.max(0, Math.min(startTop + dyPct, 100 - startBottom - 5));
      if (handle === 'bottom') newBottom = Math.max(0, Math.min(startBottom - dyPct, 100 - startTop - 5));
      if (handle === 'left') newLeft = Math.max(0, Math.min(startLeft + dxPct, 100 - startRight - 5));
      if (handle === 'right') newRight = Math.max(0, Math.min(startRight - dxPct, 100 - startLeft - 5));

      setCropTop(Math.round(newTop));
      setCropBottom(Math.round(newBottom));
      setCropLeft(Math.round(newLeft));
      setCropRight(Math.round(newRight));
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // Vertical Hue color slider drag handler
  const handleColorSliderDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingColorSlider(true);
    
    const track = e.currentTarget.getBoundingClientRect();
    
    const updateColor = (clientY: number) => {
      const y = Math.max(0, Math.min(clientY - track.top, track.height));
      const pct = y / track.height;
      const hue = Math.round(pct * 360);
      const newColor = `hsl(${hue}, 100%, 50%)`;
      setDrawColor(newColor);
    };

    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    updateColor(startY);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      updateColor(currentY);
    };

    const handleEnd = () => {
      setIsDraggingColorSlider(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // Vertical brush size slider drag handler
  const handleBrushSliderDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingBrushSlider(true);
    
    const track = e.currentTarget.getBoundingClientRect();
    
    const updateBrush = (clientY: number) => {
      const y = Math.max(0, Math.min(clientY - track.top, track.height));
      const pct = 1 - (y / track.height); // 0 at bottom, 1 at top
      const newSize = Math.round(2 + pct * 22); // range 2 to 24
      setBrushSize(newSize);
    };

    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    updateBrush(startY);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      updateBrush(currentY);
    };

    const handleEnd = () => {
      setIsDraggingBrushSlider(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    isDrawingRef.current = true;
    currentPathRef.current = [{ x, y }];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.strokeStyle = drawColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const last = currentPathRef.current[currentPathRef.current.length - 1];
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    currentPathRef.current.push({ x, y });
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setDrawPaths(prev => [...prev, { color: drawColor, lineWidth: brushSize, points: currentPathRef.current }]);
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPaths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.lineWidth || 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    if (imageEditorOpen && canvasRef.current) {
      const container = document.getElementById('editor-image-container');
      if (container) {
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight;
        redrawCanvas();
      }
    }
  }, [imageEditorOpen, drawPaths, editorRotation, editorMode]);

  const handleSendEditedImage = async () => {
    if (!pendingImage || !activeChat || !currentUser || !partner) return;
    playSound('send');
    
    try {
      const imgContainer = document.getElementById('editor-image-container');
      if (!imgContainer) return;
      const width = imgContainer.clientWidth;
      const height = imgContainer.clientHeight;

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = pendingImage;
      });

      const cropLeftPx = width * (cropLeft / 100);
      const cropTopPx = height * (cropTop / 100);
      const cropW = width * (1 - (cropLeft + cropRight) / 100);
      const cropH = height * (1 - (cropTop + cropBottom) / 100);

      const sx = img.naturalWidth * (cropLeft / 100);
      const sy = img.naturalHeight * (cropTop / 100);
      const sWidth = img.naturalWidth * (1 - (cropLeft + cropRight) / 100);
      const sHeight = img.naturalHeight * (1 - (cropTop + cropBottom) / 100);

      const canvas = document.createElement('canvas');
      const isRotated = (editorRotation === 90 || editorRotation === 270);
      const canvasW = isRotated ? cropH : cropW;
      const canvasH = isRotated ? cropW : cropH;

      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((editorRotation * Math.PI) / 180);
      
      // Draw cropped and rotated image
      ctx.drawImage(img, sx, sy, sWidth, sHeight, -cropW / 2, -cropH / 2, cropW, cropH);
      
      // Draw drawings relative to cropped top-left inside rotated space
      drawPaths.forEach(path => {
        if (path.points.length < 2) return;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.lineWidth || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        const startX = path.points[0].x - cropLeftPx - (cropW / 2);
        const startY = path.points[0].y - cropTopPx - (cropH / 2);
        ctx.moveTo(startX, startY);
        
        for (let i = 1; i < path.points.length; i++) {
          const ptX = path.points[i].x - cropLeftPx - (cropW / 2);
          const ptY = path.points[i].y - cropTopPx - (cropH / 2);
          ctx.lineTo(ptX, ptY);
        }
        ctx.stroke();
      });

      // Draw text overlays inside rotated space
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      editorTexts.forEach(t => {
        ctx.font = 'bold 24px Inter';
        ctx.fillStyle = t.color || 'white';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        const element = document.getElementById(`editor-text-${t.id}`);
        const imgElement = imgContainer.querySelector('img');
        if (element && imgElement) {
          const r = getRelativeCoords(element, imgContainer, imgElement, editorRotation);
          const rx = r.x - cropLeftPx - (cropW / 2);
          const ry = r.y - cropTopPx - (cropH / 2);
          ctx.fillText(t.text, rx, ry);
        }
      });

      // Draw emoji overlays inside rotated space
      editorEmojis.forEach(em => {
        ctx.font = '36px serif';
        const element = document.getElementById(`editor-emoji-${em.id}`);
        const imgElement = imgContainer.querySelector('img');
        if (element && imgElement) {
          const r = getRelativeCoords(element, imgContainer, imgElement, editorRotation);
          const rx = r.x - cropLeftPx - (cropW / 2);
          const ry = r.y - cropTopPx - (cropH / 2);
          ctx.fillText(em.emoji, rx, ry);
        }
      });

      ctx.restore();

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      const plainText = captionText.trim();
      const finalCaption = plainText ? plainText : '';

      const recipientsToSend = selectedRecipients.length > 0 ? selectedRecipients : [partner.id];

      for (const recId of recipientsToSend) {
        const targetUser = users[recId];
        if (!targetUser) continue;

        const chatId = getChatId(currentUser.id, recId);
        const msgId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        if (recId === 'hbot-ai') {
          const msgData = {
            id: msgId,
            chatId,
            sender_id: currentUser.id,
            receiver_id: recId,
            content: finalDataUrl,
            caption: finalCaption,
            type: 'image',
            timestamp: serverTimestamp(),
            expires_at: expiresAt,
            status: 'sent'
          };
          await setDoc(doc(db, 'messages', msgId), msgData);
          
          const aiId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          const aiMsgData = {
            id: aiId,
            chatId,
            sender_id: 'hbot-ai',
            receiver_id: currentUser.id,
            content: lang === 'ar' 
              ? `وصلتني صورتك المعدلة بنجاح! ${plainText ? `وتعليقك عليها: "${plainText}"` : ''}` 
              : `I successfully received your edited image! ${plainText ? `Your caption: "${plainText}"` : ''}`,
            type: 'ai',
            timestamp: serverTimestamp(),
            expires_at: expiresAt,
            status: 'sent'
          };
          await setDoc(doc(db, 'messages', aiId), aiMsgData);
        } else {
          const partnerPubKey = await importPublicKey(targetUser.public_key);
          const encryptedForPartner = await encryptMessage(partnerPubKey, finalDataUrl);
          
          const myPubKey = await importPublicKey(currentUser.public_key);
          const encryptedForMe = await encryptMessage(myPubKey, finalDataUrl);

          let encryptedCaptionReceiver = '';
          let encryptedCaptionSender = '';
          if (finalCaption) {
            encryptedCaptionReceiver = await encryptMessage(partnerPubKey, finalCaption);
            encryptedCaptionSender = await encryptMessage(myPubKey, finalCaption);
          }

          const msgData = {
            id: msgId,
            chatId,
            sender_id: currentUser.id,
            receiver_id: recId,
            content: JSON.stringify({
              forReceiver: encryptedForPartner,
              forSender: encryptedForMe
            }), 
            caption: finalCaption ? JSON.stringify({
              forReceiver: encryptedCaptionReceiver,
              forSender: encryptedCaptionSender
            }) : '',
            type: 'image',
            timestamp: serverTimestamp(),
            expires_at: expiresAt,
            status: 'sent'
          };
          await setDoc(doc(db, 'messages', msgId), msgData);
        }

        // Ensure user added to home screen contact list
        if (recId !== 'hbot-ai' && currentUser) {
          const activeContacts = currentUser.contacts || [];
          if (!activeContacts.includes(recId)) {
            const newContacts = [...activeContacts, recId];
            try {
              await updateDoc(doc(db, 'users', currentUser.id), { contacts: newContacts });
              useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
            } catch (e) {
              console.error("Failed to add partner to home screen", e);
            }
          }
        }
      }

      setImageEditorOpen(false);
      setPendingImage(null);
      setCaptionText('');
    } catch (err) {
      console.error("Compilation error", err);
    }
  };

  const handleAudioCall = () => {
    if (isBlockedByPartner) return;
    useStore.getState().setCallStatus('calling', partner, 'audio');
  };

  const handleVideoCall = () => {
    if (isBlockedByPartner) return;
    useStore.getState().setCallStatus('calling', partner, 'video');
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // Show immediately when scrolling up from the very bottom (150px threshold)
      setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const downloadImage = async (url: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `hsend_image_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `hsend_image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `hsend_image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!partner) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-bg-primary text-text-muted" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
        <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-text-muted" />
        </div>
        <h2 className="text-xl font-medium text-text-primary mb-2">{t('chat.e2e.title')}</h2>
        <p className="max-w-xs text-center text-sm leading-relaxed">{t('chat.e2e.desc')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative bg-[var(--bg-primary)] w-full" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      {/* Header */}
      <div className={`h-16 flex items-center justify-between px-2 sm:px-4 py-2 shrink-0 z-10 shadow-sm transition-colors ${selectedMessages.length > 0 ? 'bg-[var(--bg-tertiary)]' : 'bg-[var(--bg-primary)]'}`}>
        {selectedMessages.length > 0 ? (
          <div className="flex items-center gap-1 sm:gap-4 w-full text-text-primary overflow-x-auto no-scrollbar py-1">
            <button onClick={() => setSelectedMessages([])} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors">
              <ArrowRight size={24} className={`transform ${lang === 'ar' ? '' : 'rotate-180'}`} />
            </button>
            <span className="text-lg font-medium shrink-0 px-2">{selectedMessages.length}</span>
            <div className="flex-1" />
            <button onClick={() => {
                 const msg = chatMessages.find(m => m.id === selectedMessages[0]);
                 if (msg) setReplyingTo(msg);
                 setSelectedMessages([]);
            }} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors" title="Reply">
               <Reply size={22} />
            </button>
            <button onClick={async () => {
                 const selectedTexts = chatMessages
                   .filter(m => selectedMessages.includes(m.id) && m.type === 'text')
                   .map(m => m.content)
                   .join('\n');
                 await navigator.clipboard.writeText(selectedTexts);
                 setSelectedMessages([]);
            }} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors text-text-primary" title="Copy">
               <Copy size={22} />
            </button>
            <button onClick={handleOpenDeleteModal} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors text-text-primary" title="Delete">
               <Trash2 size={22} />
            </button>
            {(() => {
                const msgId = selectedMessages[0];
                const msg = (messages[activeChat!] || []).find(m => m.id === msgId);
                return msg && msg.sender_id === currentUser.id && (
                  <button onClick={() => {
                        setEditingMessage(msg);
                        setInputText(msg.content);
                        setSelectedMessages([]);
                   }} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors text-text-primary" title="Edit">
                      <Pencil size={22} />
                   </button>
                );
            })()}
            <button onClick={() => setShowForwardModal(true)} className="p-2 shrink-0 hover:bg-white/10 rounded-full transition-colors" title="Forward">
               <Forward size={22} />
            </button>
          </div>
        ) : (
        <>
        <div className="flex items-center gap-2 sm:gap-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <button 
            onClick={() => setActiveChat(null)}
            className="md:hidden p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors focus:outline-none"
          >
            <ArrowRight size={24} className={`transform ${lang === 'ar' ? '' : 'rotate-180'}`} />
          </button>
          <div onClick={() => setShowProfile(true)} className="flex items-center gap-2 sm:gap-4 cursor-pointer">
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold uppercase shrink-0 overflow-hidden ${partner.id === 'hbot-ai' ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-accent-primary'}`}
            >
              {partner.id === 'hbot-ai' ? (
                <motion.img 
                  src={partner.avatar_url} 
                  alt="AI" 
                  className="w-full h-full object-cover" 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
              ) : partner.avatar_url ? (
                <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                partner.username.charAt(0)
              )}
            </motion.div>
            <div className="flex flex-col">
              <h3 className={`font-medium truncate max-w-[120px] sm:max-w-[200px] ${partner.id === 'hbot-ai' ? 'bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-bold' : 'text-text-primary'}`}>
                {contacts[partner.id]?.nickname || partner.name || partner.username}
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-text-muted">
                {partner.id === 'hbot-ai' ? (
                   <span className="text-purple-400">{typingUsers[partner.id] ? (lang === 'ar' ? 'يكتب...' : 'Typing...') : 'AI Assistant'}</span>
                ) : typingUsers[partner.id] ? (
                   <span className="text-accent-primary italic font-medium truncate animate-pulse">
                     {typingUsers[partner.id] === 'recording' ? (lang === 'ar' ? 'يسجل صوتاً...' : 'Recording Voice...') : (lang === 'ar' ? 'يكتب...' : 'Typing...')}
                   </span>
                ) : (
                   <>
                     <Lock size={10} className="shrink-0" />
                     <span className="truncate">{t('chat.e2e.badge')}</span>
                   </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-4 text-text-secondary">
          {!isBlockedByPartner && !blocked.includes(partner.id) && (
            <>
              <button onClick={handleAudioCall} className="hover:text-text-primary transition-colors p-2 rounded-full hover:bg-bg-hover" title={t('chat.audio_call')}>
                <Phone size={20} />
              </button>
              <button onClick={handleVideoCall} className="hover:text-text-primary transition-colors p-2 rounded-full hover:bg-bg-hover" title={t('chat.video_call')}>
                <Video size={20} />
              </button>
            </>
          )}
          <button className="hover:text-text-primary transition-colors hidden sm:block p-2 rounded-full hover:bg-bg-hover">
            <Info size={20} />
          </button>
        </div>
        </>
        )}
      </div>

      {/* Add Contact Banner */}
      {!contacts[partner.id] && partner.id !== 'hbot-ai' && !dismissedBanners[partner.id] && (
        <div className="bg-[var(--bg-secondary)] px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between z-20 animate-in fade-in slide-in-from-top-1">
          <div className="flex flex-col min-w-0">
             <p className="text-text-primary text-sm font-medium truncate">
               {lang === 'ar' ? 'هل تود تسجيل هذا الشخص كصديق؟' : 'Would you like to register this person as a friend?'}
             </p>
             <p className="text-text-muted text-xs truncate">
               {lang === 'ar' ? 'أو يمكنك المتابعة والتحدث أولاً دون تسجيله.' : 'Or you can continue and talk first without saving.'}
             </p>
          </div>
          <div className="flex gap-2 shrink-0 ml-4">
             <button 
               onClick={() => {
                 setUserToAdd(partner);
                 setFriendNickname('');
                 setShowAddFriendModal(true);
               }}
               className="bg-[#00a884] text-[var(--bg-primary)] px-4 py-1.5 rounded-full text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
             >
               {lang === 'ar' ? 'تسجيل كصديق' : 'Add Friend'}
             </button>
             <button 
               onClick={() => setDismissedBanners(prev => ({ ...prev, [partner.id]: true }))}
               className="bg-[var(--bg-hover)] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[var(--border-primary)] active:scale-95 transition-all"
             >
               {lang === 'ar' ? 'المتابعة والتحدث' : 'Talk First'}
             </button>
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 py-4 overflow-y-auto overscroll-none flex flex-col gap-1 sm:gap-2 scrollbar-none relative" 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="self-center bg-bg-tertiary text-text-muted text-[11px] px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 max-w-[85%] text-center leading-relaxed border border-border-primary my-2">
          <Lock size={12} className="shrink-0" />
          {t('chat.e2e.notice')}
        </div>
        
          {chatMessages.map(msg => (
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
        ))}
        {partner && typingUsers[partner.id] && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex flex-col max-w-[92%] sm:max-w-[85%] ${lang === 'ar' ? 'items-end self-end' : 'items-start self-start'}`}
          >
            <div className={`p-2.5 rounded-xl shadow-sm relative ${partner.id === 'hbot-ai' ? 'animate-rgb-border text-text-primary' : 'bg-[var(--bg-tertiary)] text-text-muted'} rounded-tl-none flex items-center gap-2`}>
              <span className="text-xs italic whitespace-nowrap">{typingUsers[partner.id] === 'recording' ? (lang === 'ar' ? 'يسجل صوتاً...' : 'Recording Voice...') : (lang === 'ar' ? 'يكتب...' : 'Typing...')}</span>
              <div className="flex items-center gap-1 h-3">
                <motion.div className={`w-1.5 h-1.5 rounded-full ${partner.id === 'hbot-ai' ? 'bg-text-primary' : 'bg-text-muted'}`} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className={`w-1.5 h-1.5 rounded-full ${partner.id === 'hbot-ai' ? 'bg-text-primary' : 'bg-text-muted'}`} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                <motion.div className={`w-1.5 h-1.5 rounded-full ${partner.id === 'hbot-ai' ? 'bg-text-primary' : 'bg-text-muted'}`} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={scrollToBottom}
              className={`absolute bottom-4 ${lang === "ar" ? "left-4 sm:left-6" : "right-4 sm:right-6"} z-40 bg-[var(--bg-tertiary)] text-[#00a884] p-2 rounded-full shadow-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors`}
              title={lang === 'ar' ? 'الذهاب للأسفل' : 'Scroll to bottom'}
            >
              <ChevronDown size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      
      {/* Input */}
      <div className="bg-[var(--bg-primary)] px-2 py-2 flex flex-col shrink-0 z-10 relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {blocked.includes(partner.id) ? (
          <div className="flex flex-col items-center justify-center p-4 bg-[var(--bg-secondary)] border border-red-500/20 rounded-2xl gap-3">
            <p className="text-red-400 text-sm font-semibold text-center leading-relaxed">
              {lang === 'ar' ? 'لقد قمت بحظر هذا المستخدم. لا يمكنك إرسال أو استقبال الرسائل منه.' : 'You have blocked this user. You cannot send or receive messages from them.'}
            </p>
            <button
              onClick={async () => {
                unblockUser(partner.id);
                if (currentUser) {
                  try {
                    const docRef = doc(db, 'users', currentUser.id);
                    const newBlocked = (blocked || []).filter(id => id !== partner.id);
                    await updateDoc(docRef, { blocked: newBlocked });
                  } catch (e) { console.error("Error syncing unblock to firebase", e); }
                }
              }}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-full hover:brightness-110 active:scale-95 transition-all shadow-md"
            >
              {lang === 'ar' ? 'إلغاء الحظر' : 'Unblock'}
            </button>
          </div>
        ) : isBlockedByPartner ? (
          <div className="flex flex-col items-center justify-center p-5 bg-[var(--bg-secondary)] border border-red-500/20 rounded-2xl gap-2">
            <p className="text-red-400 text-sm font-semibold text-center leading-relaxed">
              {lang === 'ar' ? 'لقد تم حظرك من قبل هذا المستخدم. لا يمكنك إرسال الرسائل أو إجراء المكالمات.' : 'You have been blocked by this user. You cannot send messages or make calls.'}
            </p>
          </div>
        ) : (
          <>
        {/* Unified Media Picker Tray */}
        <AnimatePresence>
          {(showEmojiPicker || showGifPicker) && (
            <>
              {/* Backdrop Overlay to close on click */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setShowEmojiPicker(false); setShowGifPicker(false); }}
                className="fixed inset-0 z-[90] bg-black/40  sm:bg-transparent"
              />
              
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100) {
                    setShowEmojiPicker(false);
                    setShowGifPicker(false);
                  }
                }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 sm:absolute sm:bottom-full sm:left-4 sm:right-auto sm:mb-4 sm:w-[400px] sm:rounded-2xl bg-[var(--bg-secondary)] z-[100] shadow-2xl rounded-t-3xl border-t border-[var(--border-primary)] flex flex-col h-[450px] sm:h-[500px]"
                dir="ltr" // Keep picker layout consistent
              >
                {/* Grab Handle / Drag Bar */}
                <div className="w-12 h-1.5 bg-[var(--border-primary)] rounded-full mx-auto my-3 shrink-0 cursor-grab active:cursor-grabbing" />
                
                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                  {showEmojiPicker && (
                    <EmojiPicker 
                      onEmojiClick={(e) => { setInputText(prev => prev + e.emoji); }} 
                      theme={Theme.DARK}
                      width="100%"
                      height="100%"
                      lazyLoadEmojis={true}
                      skinTonesDisabled={true}
                      searchDisabled={false}
                    />
                  )}
                  {showGifPicker && (
                    <GifPicker 
                      onGifSelect={(url) => {
                        handleGifSelect(url);
                        setShowGifPicker(false);
                      }} 
                      onClose={() => setShowGifPicker(false)} 
                      lang={lang as 'en' | 'ar'} 
                    />
                  )}
                </div>

                {/* Tab Navigation at Bottom (WhatsApp Style) */}
                <div className="flex items-center justify-center gap-12 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] shrink-0">
                  <button 
                    onClick={() => { setPickerTab('emoji'); setShowEmojiPicker(true); setShowGifPicker(false); }}
                    className={`p-1 transition-all relative ${pickerTab === 'emoji' ? 'text-[#00a884]' : 'text-[#8696a0]'}`}
                  >
                    <Smile size={26} />
                    {pickerTab === 'emoji' && <motion.div layoutId="activeTab" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00a884] rounded-full" />}
                  </button>
                  <button 
                    onClick={() => { setPickerTab('gif'); setShowGifPicker(true); setShowEmojiPicker(false); }}
                    className={`p-1 transition-all relative ${pickerTab === 'gif' ? 'text-[#00a884]' : 'text-[#8696a0]'}`}
                  >
                    <div className="font-bold text-xl leading-none">GIF</div>
                    {pickerTab === 'gif' && <motion.div layoutId="activeTab" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00a884] rounded-full" />}
                  </button>
                  <button 
                    onClick={() => { /* Sticker placeholder */ }}
                    className="p-1 text-[#8696a0] opacity-50 relative cursor-not-allowed"
                  >
                    <Sticker size={26} />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Mode Indicator */}
        {editingMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] p-3 z-40 flex items-center gap-3 rounded-t-2xl mb-1 shadow-2xl mx-1"
          >
            <div className="p-2 text-[#00a884]">
              <Pencil size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#00a884] text-xs font-bold mb-0.5">
                {lang === 'ar' ? 'تعديل الرسالة' : 'Edit Message'}
              </p>
              <p className="text-text-muted text-sm truncate">
                {(() => {
                  try {
                    const parsed = JSON.parse(editingMessage.content);
                    return parsed.forSender || editingMessage.content;
                  } catch(e) {
                    return editingMessage.content;
                  }
                })()}
              </p>
            </div>
            <button type="button" onClick={() => { setEditingMessage(null); setInputText(''); }} className="text-text-muted hover:text-white p-2 bg-[var(--bg-hover)] rounded-full">
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] p-3 z-40 flex items-center gap-3 rounded-t-2xl mb-1 shadow-2xl mx-1"
          >
            <div className="w-1 self-stretch bg-[#00a884] rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-[#00a884] text-xs font-bold mb-0.5">
                {replyingTo.sender_id === currentUser?.id ? (lang === 'ar' ? 'أنت' : 'You') : (contacts[replyingTo.sender_id]?.nickname || partner.name || partner.username)}
              </p>
              <p className="text-text-muted text-sm truncate flex items-center gap-1">
                {replyingTo.type === 'image' ? (lang === 'ar' ? <><CameraIcon size={12}/> صورة</> : <><CameraIcon size={12}/> Image</>) : 
                 replyingTo.type === 'audio' ? (lang === 'ar' ? <><Mic size={12}/> رسالة صوتية</> : <><Mic size={12}/> Audio message</>) : 
                 (() => {
                    try {
                      const parsed = JSON.parse(replyingTo.content);
                      return parsed.forSender || replyingTo.content;
                    } catch(e) { return replyingTo.content; }
                 })()}
              </p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="text-text-muted hover:text-white p-2 bg-[var(--bg-hover)] rounded-full">
              <X size={16} />
            </button>
          </motion.div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-1.5 sm:gap-2 w-full max-w-full px-1 relative overflow-visible select-none">
          {isRecording ? (
            <div className="flex-1 min-w-0 bg-[var(--bg-secondary)] rounded-[24px] h-[48px] flex items-center justify-between px-4 relative overflow-visible shadow-inner border border-[var(--bg-tertiary)]">
              {/* Pulsing Dot & Timer */}
              <div className="flex items-center gap-2 text-red-500 shrink-0">
                <motion.span 
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0"
                />
                <span className="font-mono text-sm font-semibold text-red-500 select-none">
                  {formatTime(recordingTime)}
                </span>
              </div>

              {/* Lock Indicator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                {recordingLockState === 'locked' ? (
                  <div className="flex items-center gap-1.5 text-[#00a884] bg-[#00a884]/10 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    <Lock size={12} />
                    <span>{lang === 'ar' ? 'مسجل ومقفل' : 'Recording locked'}</span>
                  </div>
                ) : (
                  <motion.div 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-[#8696a0] text-xs font-medium flex items-center gap-1"
                  >
                    <span>{lang === 'ar' ? '◀ اسحب لليسار للإلغاء' : '◀ Swipe left to cancel'}</span>
                  </motion.div>
                )}
              </div>

              {/* Cancel Button (Trash Can icon) if locked */}
              {recordingLockState === 'locked' && (
                <button
                  type="button"
                  onClick={handleCancelRecordingWithAnimation}
                  className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all duration-200 relative z-10 shrink-0 select-none shadow-md border border-red-500/15 hover:scale-105 active:scale-95 animate-fade-in"
                  title={lang === 'ar' ? 'إلغاء وحذف التسجيل' : 'Cancel and discard recording'}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ) : (
            /* Regular message input */
            <div className="flex-1 min-w-0 bg-[var(--bg-tertiary)] rounded-[24px] min-h-[48px] flex items-end px-1 sm:px-2 py-1.5 shadow-sm">
              <button 
                type="button" 
                onClick={() => {
                  if (showEmojiPicker || showGifPicker) {
                    setShowEmojiPicker(false);
                    setShowGifPicker(false);
                  } else {
                    setShowEmojiPicker(true);
                    setPickerTab('emoji');
                  }
                }} 
                className="p-1.5 sm:p-2 text-[#8696a0] hover:text-text-primary shrink-0 mb-0.5"
              >
                {(showEmojiPicker || showGifPicker) ? <Keyboard size={24} /> : <Smile size={24} />}
              </button>
              
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (partner && partner.id !== 'hbot-ai' && currentUser) {
                    socket.emit('typing', { sender_id: currentUser.id, receiver_id: partner.id, action: 'typing' });
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socket.emit('typing', { sender_id: currentUser.id, receiver_id: partner.id, action: 'idle' });
                    }, 2000);
                  }
                }}
                placeholder={partner.id === 'hbot-ai' ? (lang === 'ar' ? 'اسأل المساعد الذكي...' : 'Ask AI Assistant...') : (lang === 'ar' ? 'رسالة' : 'Message')}
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] py-2 px-1 text-text-primary placeholder-[#8696a0] resize-none max-h-32 overflow-y-auto overscroll-none scrollbar-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isMobile()) {
                    e.preventDefault();
                    if (inputText.trim()) handleSend(e as any);
                  }
                }}
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              />

              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 px-1 mb-0.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 sm:p-2 text-[#8696a0] hover:text-text-primary">
                  <Paperclip size={22} className="-rotate-45" />
                </button>
                {!inputText.trim() && (
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="p-1.5 sm:p-2 text-[#8696a0] hover:text-text-primary">
                    <CameraIcon size={24} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Button (Mic/Send) */}
          {inputText.trim() ? (
            <button
              type="submit"
              className="w-[48px] h-[48px] rounded-full flex items-center justify-center text-[var(--bg-primary)] bg-[#00a884] shadow-md hover:brightness-110 active:scale-95 transition-all shrink-0 mb-0.5 animate-fade-in"
            >
              <Send size={22} className={lang === 'ar' ? "rotate-180" : ""} />
            </button>
          ) : (
            <motion.div
              drag={isRecording && recordingLockState !== 'locked'}
              dragConstraints={{ top: -120, bottom: 0, left: -250, right: 0 }}
              dragElastic={0.1}
              dragMomentum={false}
              animate={{
                x: (isRecording && recordingLockState !== 'locked') ? undefined : 0,
                y: (isRecording && recordingLockState !== 'locked') ? undefined : 0
              }}
              onDrag={(_, info) => {
                if (!isRecording) return;
                // Dragged left to cancel
                if (info.offset.x < -100) {
                  handleCancelRecordingWithAnimation();
                }
                // Dragged up to lock
                if (info.offset.y < -50 && recordingLockState === 'recording') {
                  setRecordingLockState('locked');
                  playSound('record_lock');
                  if (navigator.vibrate) navigator.vibrate(100);
                }
              }}
              onDragEnd={() => {
                if (!isRecording) return;
                // If they release it while not locked, stop and send!
                if (recordingLockState === 'recording') {
                  toggleRecording();
                }
              }}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-[48px] h-[48px] rounded-full flex items-center justify-center text-white shadow-lg shrink-0 mb-0.5 cursor-grab active:cursor-grabbing relative z-30 select-none ${
                isRecording 
                  ? recordingLockState === 'locked' 
                    ? 'bg-[#00a884]' 
                    : 'bg-red-500 animate-pulse' 
                  : 'bg-[#00a884] text-[var(--bg-primary)]'
              }`}
            >
              {isRecording && recordingLockState === 'recording' && (
                <div className="absolute bottom-[56px] left-1/2 -translate-x-1/2 flex flex-col items-center -space-y-1.5 pointer-events-none z-50 select-none">
                  <motion.div
                    animate={{ y: [-2, -12, -2], opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.0, delay: 0 }}
                  >
                    <ChevronUp size={20} className="text-[#00a884]" />
                  </motion.div>
                  <motion.div
                    animate={{ y: [-2, -12, -2], opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.0, delay: 0.2 }}
                  >
                    <ChevronUp size={18} className="text-[#00a884]/70" />
                  </motion.div>
                  <motion.div
                    animate={{ y: [-2, -12, -2], opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.0, delay: 0.4 }}
                  >
                    <ChevronUp size={16} className="text-[#00a884]/40" />
                  </motion.div>
                </div>
              )}
              {isRecording ? (
                recordingLockState === 'locked' ? <Send size={22} className={lang === 'ar' ? "rotate-180" : ""} /> : <Mic size={24} />
              ) : (
                <Mic size={24} />
              )}
            </motion.div>
          )}
        </form>

        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileUpload} />
          </>
        )}
      </div>

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 ">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--bg-tertiary)] w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                {lang === 'ar' ? 'تحويل الرسالة إلى...' : 'Forward message to...'}
              </h3>
              <button onClick={() => { setShowForwardModal(false); setTargetForwardUserId(null); }} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto overscroll-none p-2">
              {Object.values(users).filter(u => u.id !== currentUser?.id && (contacts[u.id] || u.id === 'hbot-ai')).map(user => (
                <button
                  key={user.id}
                  onClick={() => setTargetForwardUserId(user.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors mb-1 ${
                    targetForwardUserId === user.id ? 'bg-[#00a884]/20 border border-[#00a884]/50' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center text-white font-bold shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      (user.name?.[0] || user.username?.[0] || '?')
                    )}
                  </div>
                  <span className="text-white font-medium text-left flex-1">
                    {contacts[user.id]?.nickname || user.name || user.username}
                  </span>
                  {targetForwardUserId === user.id && <div className="w-2 h-2 rounded-full bg-[#00a884]" />}
                </button>
              ))}
            </div>

            <div className="p-4 bg-[var(--bg-secondary)] flex gap-3">
              <button 
                onClick={() => { setShowForwardModal(false); setTargetForwardUserId(null); }}
                className="flex-1 py-2.5 rounded-xl bg-[var(--bg-hover)] text-white font-medium hover:bg-[var(--border-primary)]"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                disabled={!targetForwardUserId}
                onClick={async () => {
                  if (!targetForwardUserId || !currentUser || !privateKeyPem) return;
                  
                  try {
                    const targetUser = users[targetForwardUserId];
                    const chatId = getChatId(currentUser.id, targetForwardUserId);
                    const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
                    
                    for (const msgId of selectedMessages) {
                      const msg = chatMessages.find(m => m.id === msgId);
                      if (!msg) continue;

                      const newMsgId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                      
                      let finalContent = msg.content;
                      let finalCaption = msg.caption || '';

                      if (targetForwardUserId !== 'hbot-ai') {
                        // We need to encrypt the content and caption for the target user and ourselves
                        const partnerPubKey = await importPublicKey(targetUser.public_key);
                        const encryptedForPartner = await encryptMessage(partnerPubKey, msg.content);
                        
                        const myPubKey = await importPublicKey(currentUser.public_key);
                        const encryptedForMe = await encryptMessage(myPubKey, msg.content);

                        finalContent = JSON.stringify({
                          forReceiver: encryptedForPartner,
                          forSender: encryptedForMe
                        });

                        if (msg.caption) {
                          const encryptedCaptionReceiver = await encryptMessage(partnerPubKey, msg.caption);
                          const encryptedCaptionSender = await encryptMessage(myPubKey, msg.caption);
                          finalCaption = JSON.stringify({
                            forReceiver: encryptedCaptionReceiver,
                            forSender: encryptedCaptionSender
                          });
                        }
                      }

                      const forwardData = {
                        id: newMsgId,
                        sender_id: currentUser.id,
                        receiver_id: targetForwardUserId,
                        chatId: chatId,
                        content: finalContent,
                        caption: finalCaption,
                        type: msg.type,
                        timestamp: serverTimestamp(),
                        expires_at: expiresAt,
                        status: 'sent',
                        forwarded: true
                      };
                      await setDoc(doc(db, 'messages', newMsgId), forwardData);
                    }
                    
                    setActiveChat(targetForwardUserId);
                    setShowForwardModal(false);
                    setSelectedMessages([]);
                    setTargetForwardUserId(null);
                  } catch (err) {
                    console.error('Forwarding error:', err);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  targetForwardUserId ? 'bg-[#00a884] text-[var(--bg-primary)] hover:bg-[#008f6f]' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {lang === 'ar' ? 'تحويل' : 'Forward'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Profile Sidebar/Modal */}
      {showProfile && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-[350px] bg-bg-primary z-[250] border-l border-border-primary shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
           <div className="h-16 bg-bg-tertiary flex items-center px-4 py-2 shrink-0 gap-3 shadow-md border-b border-border-primary">
             <button 
                onClick={() => setShowProfile(false)}
                className="p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors focus:outline-none"
              >
                <ArrowRight size={24} className={`transform ${lang === 'ar' ? 'rotate-180' : ''}`} />
             </button>
             <h1 className="text-xl font-bold text-text-primary">Contact Info</h1>
           </div>
           <div className="flex-1 overflow-y-auto overscroll-none p-6 flex flex-col items-center">
             <div 
               onClick={() => partner.avatar_url && setSelectedImage(partner.avatar_url)}
               className={`w-32 h-32 shrink-0 rounded-full bg-accent-primary flex items-center justify-center text-white text-4xl font-bold uppercase overflow-hidden mb-4 ${partner.avatar_url ? 'cursor-zoom-in hover:brightness-90 transition-all' : ''}`}
             >
                {partner.avatar_url ? (
                  <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  partner.username.charAt(0)
                )}
             </div>
             
             {isEditingNickname ? (
               <div className="flex flex-col items-center gap-2 mt-2 w-full px-4 mb-3">
                 <input 
                   type="text" 
                   value={editNicknameValue} 
                   onChange={(e) => setEditNicknameValue(e.target.value)}
                   className="w-full bg-[var(--bg-secondary)] text-white border border-[var(--border-primary)] rounded-lg px-3 py-2 outline-none focus:border-[#00a884] text-center text-sm"
                   placeholder={lang === 'ar' ? 'الاسم المستعار' : 'Nickname'}
                   autoFocus
                   dir="auto"
                 />
                 <div className="flex gap-2 w-full justify-center">
                   <button 
                     onClick={() => {
                       addContact(partner.id, editNicknameValue.trim() || undefined);
                       setIsEditingNickname(false);
                     }}
                     className="px-3 py-1 bg-[#00a884] text-black text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all"
                   >
                     {lang === 'ar' ? 'حفظ' : 'Save'}
                   </button>
                   <button 
                     onClick={() => setIsEditingNickname(false)}
                     className="px-3 py-1 bg-[var(--bg-hover)] text-white text-xs font-medium rounded-lg hover:bg-[var(--border-primary)] active:scale-95 transition-all"
                   >
                     {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                   </button>
                 </div>
               </div>
             ) : (
               <div className="flex items-center gap-2 mb-1">
                 <h2 className="text-2xl font-bold text-text-primary text-center">
                   {contacts[partner.id]?.nickname || partner.name || partner.username}
                 </h2>
                 {partner.id !== 'hbot-ai' && (
                   <button 
                     onClick={() => {
                       setEditNicknameValue(contacts[partner.id]?.nickname || '');
                       setIsEditingNickname(true);
                     }}
                     className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-full text-[#00a884] transition-colors"
                     title={lang === 'ar' ? 'تعديل الاسم' : 'Edit Nickname'}
                   >
                     <Pencil size={16} />
                   </button>
                 )}
               </div>
             )}
             
             <p className="text-text-muted mb-6">@{partner.username}</p>

              {partner.id !== 'hbot-ai' && (
                <div className="w-full mb-4">
                  {blocked.includes(partner.id) ? (
                    <button
                      onClick={async () => {
                        unblockUser(partner.id);
                        if (currentUser) {
                          try {
                            const docRef = doc(db, 'users', currentUser.id);
                            const newBlocked = (blocked || []).filter(id => id !== partner.id);
                            await updateDoc(docRef, { blocked: newBlocked });
                          } catch (e) { console.error("Error syncing unblock to firebase", e); }
                        }
                      }}
                      className="w-full py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:bg-red-500/10 text-red-500 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Ban size={16} />
                      {lang === 'ar' ? 'إلغاء حظر الصديق' : 'Unblock Friend'}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (window.confirm(lang === 'ar' ? `هل أنت متأكد من حظر ${partner.name || partner.username}؟` : `Are you sure you want to block ${partner.name || partner.username}?`)) {
                          blockUser(partner.id);
                          if (currentUser) {
                            try {
                              const docRef = doc(db, 'users', currentUser.id);
                              const newBlocked = [...(blocked || []), partner.id];
                              await updateDoc(docRef, { blocked: newBlocked });
                            } catch (e) { console.error("Error syncing block to firebase", e); }
                          }
                        }
                      }}
                      className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-red-500/20"
                    >
                      <Ban size={16} />
                      {lang === 'ar' ? 'حظر هذا المستخدم' : 'Block this user'}
                    </button>
                  )}
                </div>
              )}
             
             <div className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-xl p-4 space-y-4 mb-4">
               <div>
                 <span className="text-xs text-text-muted uppercase font-semibold">{lang === 'ar' ? 'معلومات' : 'About'}</span>
                 <p className="text-text-primary mt-1">{partner.id === 'hbot-ai' ? (lang === 'ar' ? 'مساعد ذكي متطور' : 'Advanced AI Assistant') : (lang === 'ar' ? 'متوفر' : 'Available')}</p>
               </div>
             </div>

             {partner.id !== 'hbot-ai' && (
               <div className="w-full bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-xl p-4 space-y-4">
                 <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2 text-text-primary">
                     <Bell size={18} />
                     <span className="font-semibold">{lang === 'ar' ? 'الأصوات والإشعارات' : 'Sounds & Notifications'}</span>
                   </div>
                 </div>
                 
                 <div className="space-y-3">
                   <div>
                     <label className="text-xs text-text-muted mb-1 block">{lang === 'ar' ? 'نغمة الرسائل' : 'Message Tone'}</label>
                     <select 
                       value={friendPreferences[partner.id]?.notificationSound || 'default'}
                       onChange={(e) => {
                         setFriendPreference(partner.id, { notificationSound: e.target.value });
                         playSound('receive', e.target.value);
                       }}
                       className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-white outline-none"
                     >
                       {NOTIFICATION_SOUNDS.map(s => (
                         <option key={s.id} value={s.id}>{s.name}</option>
                       ))}
                     </select>
                   </div>
                   
                   <div>
                     <label className="text-xs text-text-muted mb-1 block">{lang === 'ar' ? 'نغمة الاتصال' : 'Ringtone'}</label>
                     <select 
                       value={friendPreferences[partner.id]?.ringtoneSound || 'default'}
                       onChange={(e) => {
                         setFriendPreference(partner.id, { ringtoneSound: e.target.value });
                         // Briefly preview the ringtone using startRingtone might be too much, let's just let them set it.
                       }}
                       className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-white outline-none"
                     >
                       {RINGTONE_SOUNDS.map(s => (
                         <option key={s.id} value={s.id}>{s.name}</option>
                       ))}
                     </select>
                   </div>

                   <div className="pt-2">
                     <label className="w-full py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm text-text-primary">
                       <span>{lang === 'ar' ? 'اختيار من الجهاز' : 'Choose from Device'}</span>
                       <input 
                         type="file" 
                         accept="audio/*" 
                         className="hidden" 
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             const reader = new FileReader();
                             reader.onload = (ev) => {
                               if (ev.target?.result) {
                                 setFriendPreference(partner.id, { ringtoneSound: ev.target.result as string });
                               }
                             };
                             reader.readAsDataURL(file);
                           }
                         }}
                       />
                     </label>
                   </div>
                 </div>
               </div>
             )}
           </div>
        </div>
      )}

      {/* Add Friend Modal */}
      <AnimatePresence>
        {showAddFriendModal && userToAdd && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 ">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-tertiary)] w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 shrink-0 rounded-full bg-accent-primary flex items-center justify-center text-white text-3xl font-bold uppercase shadow-lg overflow-hidden">
                  {userToAdd.avatar_url ? (
                    <img src={userToAdd.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    userToAdd.username.charAt(0)
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">{userToAdd.name || userToAdd.username}</h3>
                  <p className="text-text-muted text-sm">@{userToAdd.username}</p>
                </div>
                
                <div className="w-full text-left space-y-2 mt-2">
                  <label className="text-xs font-semibold text-text-muted uppercase px-1">
                    {lang === 'ar' ? 'تخصيص اسم (اختياري)' : 'Nickname (Optional)'}
                  </label>
                  <input 
                    type="text" 
                    value={friendNickname}
                    onChange={(e) => setFriendNickname(e.target.value)}
                    placeholder={lang === 'ar' ? 'أدخل اسم ليظهر لك فقط' : 'Enter a nickname for your view'}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-white outline-none focus:border-[#00a884] transition-all"
                    dir="auto"
                  />
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-secondary)] flex gap-3">
                <button 
                  onClick={() => { setShowAddFriendModal(false); setUserToAdd(null); }}
                  className="flex-1 py-3 rounded-xl bg-[var(--bg-hover)] text-white font-medium hover:bg-[var(--border-primary)] transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={async () => {
                    addContact(userToAdd.id, friendNickname);
                    if (currentUser) {
                      try {
                        const docRef = doc(db, 'users', currentUser.id);
                        const currentContacts = currentUser.contacts || [];
                        if (!currentContacts.includes(userToAdd.id)) {
                          const newContacts = [...currentContacts, userToAdd.id];
                          await updateDoc(docRef, { contacts: newContacts });
                          useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
                        }
                      } catch(e) { console.error("Error updating contacts in db", e); }
                    }
                    useStore.getState().addUser(userToAdd);
                    setShowAddFriendModal(false);
                    setUserToAdd(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#00a884] text-[var(--bg-primary)] font-bold hover:bg-[#008f6f] transition-all active:scale-95"
                >
                  {lang === 'ar' ? 'تسجيل كصديق' : 'Add Friend'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full screen image viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[500] bg-black/95  flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-50  border border-white/10"
            >
              <X size={24} />
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(selectedImage);
              }}
              className="absolute top-4 left-4 p-3 bg-[#00a884] hover:bg-[#008f6f] text-black rounded-full transition-colors z-50 shadow-md border border-white/10 flex items-center justify-center cursor-pointer"
              title={lang === 'ar' ? 'حفظ الصورة' : 'Save Image'}
            >
              <Download size={24} />
            </button>
            
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={selectedImage} 
              alt="High Quality" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trash Animation Overlay */}
      <AnimatePresence>
        {trashAnimating && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] bg-[var(--bg-tertiary)] border border-red-500/30 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-medium"
          >
            <motion.div 
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className="text-[#ef4444]"
            >
              <Trash2 size={20} />
            </motion.div>
            <span>
              {lang === 'ar' ? 'تم إلغاء وحذف التسجيل الصوتي بنجاح' : 'Voice recording deleted successfully'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Image Editor Modal */}
      <AnimatePresence>
        {imageEditorOpen && pendingImage && (
          <div className="fixed inset-0 z-[600] bg-black/95  flex flex-col justify-between overflow-hidden text-white" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Header: Controls */}
            <div className="h-16 bg-black/40 border-b border-white/10 px-4 flex items-center justify-between z-50">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setImageEditorOpen(false); setPendingImage(null); }} 
                  className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-text-primary"
                  title={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                >
                  <X size={22} />
                </button>
                <span className="font-semibold text-sm sm:text-base">{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
              </div>

              {/* Editing Tools */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Crop Button */}
                <button 
                  onClick={() => setEditorMode(editorMode === 'crop' ? 'view' : 'crop')}
                  className={`p-2.5 rounded-full transition-all ${editorMode === 'crop' ? 'bg-[#00a884] text-black' : 'hover:bg-white/10 text-white'}`}
                  title={lang === 'ar' ? 'قص' : 'Crop'}
                >
                  <Crop size={20} />
                </button>

                {/* Draw Button */}
                <button 
                  onClick={() => setEditorMode(editorMode === 'draw' ? 'view' : 'draw')}
                  className={`p-2.5 rounded-full transition-all ${editorMode === 'draw' ? 'bg-[#00a884] text-black' : 'hover:bg-white/10 text-white'}`}
                  title={lang === 'ar' ? 'رسم' : 'Draw'}
                >
                  <Palette size={20} />
                </button>

                {/* Add Text Button */}
                <button 
                  onClick={() => {
                    setTextValueToInsert('');
                    setShowTextAddDialog(true);
                  }}
                  className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-text-primary"
                  title={lang === 'ar' ? 'إضافة نص' : 'Add text'}
                >
                  <Type size={20} />
                </button>

                {/* Add Emoji Button */}
                <button 
                  onClick={() => setEditorMode(editorMode === 'emoji' ? 'view' : 'emoji')}
                  className={`p-2.5 rounded-full transition-all ${editorMode === 'emoji' ? 'bg-[#00a884] text-black' : 'hover:bg-white/10 text-white'}`}
                  title={lang === 'ar' ? 'إيموجي' : 'Emoji'}
                >
                  <Smile size={20} />
                </button>

                {/* Rotate Button */}
                <button 
                  onClick={async () => {
                    if (pendingImage) {
                      const rotated = await rotateBase64Image(pendingImage);
                      setPendingImage(rotated);
                      setDrawPaths([]);
                      setEditorTexts([]);
                      setEditorEmojis([]);
                    }
                  }}
                  className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-text-primary"
                  title={lang === 'ar' ? 'تدوير' : 'Rotate'}
                >
                  <RotateCw size={20} />
                </button>

                {/* Undo Button */}
                {(drawPaths.length > 0 || editorTexts.length > 0 || editorEmojis.length > 0) && (
                  <button 
                    onClick={() => {
                      setDrawPaths([]);
                      setEditorTexts([]);
                      setEditorEmojis([]);
                      setEditorRotation(0);
                      setCropLeft(0); setCropRight(0); setCropTop(0); setCropBottom(0);
                    }}
                    className="p-2.5 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors text-text-primary"
                    title={lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  >
                    <RotateCcw size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Main Area: Image Canvas view */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-black/45">
              
              {/* Optional Inline Emoji List if mode === emoji */}
              {editorMode === 'emoji' && (
                <div className="absolute top-4 inset-x-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3 rounded-2xl flex flex-wrap gap-3 justify-center z-50 shadow-2xl max-h-32 overflow-y-auto overscroll-none">
                  {['😀','😍','😂','👍','🔥','❤️','🙌','👏','🎉','✨','🚀','💡','💬','⭐','⚡','🧁','🍕','🍟','🎈','🎁'].map(em => (
                    <button 
                      key={em} 
                      onClick={() => {
                        setEditorEmojis(prev => [...prev, { id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), emoji: em }]);
                        setEditorMode('view');
                      }}
                      className="text-2xl hover:scale-125 transition-transform p-1.5"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Vertical Color Hue (RGB) Slider on Left */}
              {(editorMode === 'draw' || editorMode === 'text') && (
                <div 
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-48 rounded-2xl flex flex-col items-center justify-between z-50 select-none py-4 border border-white/10 shadow-2xl transition-all duration-300 bg-[var(--bg-secondary)]/85"
                  style={{ opacity: isDraggingColorSlider ? 1.0 : 0.45 }}
                >
                  <div 
                    className="relative w-2.5 h-full rounded-full cursor-ns-resize bg-gradient-to-b from-[#ff0000] via-[#ffff00] via-[#00ff00] via-[#00ffff] via-[#0000ff] via-[#ff00ff] to-[#ff0000]"
                    onMouseDown={handleColorSliderDragStart}
                    onTouchStart={handleColorSliderDragStart}
                  >
                    {/* Sliding Handle */}
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-ns-resize flex items-center justify-center"
                      style={{ 
                        top: `${(drawColor.startsWith('hsl') ? parseInt(drawColor.substring(4, drawColor.indexOf(','))) : 160) / 360 * 100}%`,
                        backgroundColor: drawColor
                      }}
                    >
                      <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60" />
                    </div>
                  </div>
                </div>
              )}

              {/* Vertical Brush Size Slider on Right */}
              {editorMode === 'draw' && (
                <div 
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-48 rounded-2xl flex flex-col items-center justify-between z-50 select-none py-4 border border-white/10 shadow-2xl transition-all duration-300 bg-[var(--bg-secondary)]/85"
                  style={{ opacity: isDraggingBrushSlider ? 1.0 : 0.45 }}
                >
                  <div 
                    className="relative w-2.5 h-full rounded-full cursor-ns-resize bg-white/20"
                    onMouseDown={handleBrushSliderDragStart}
                    onTouchStart={handleBrushSliderDragStart}
                  >
                    {/* Thicker shape top, thinner bottom line */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-white/40 rounded-full" />
                    
                    {/* Sliding Handle */}
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full border-2 border-white shadow-lg cursor-ns-resize flex items-center justify-center"
                      style={{ 
                        top: `${(1 - (brushSize - 2) / 22) * 100}%`,
                        width: `${Math.max(12, Math.min(22, brushSize + 4))}px`,
                        height: `${Math.max(12, Math.min(22, brushSize + 4))}px`,
                        backgroundColor: '#00a884'
                      }}
                    >
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Crop Instruction Panel */}
              {editorMode === 'crop' && (
                <div className="absolute inset-x-4 top-4 bg-[var(--bg-secondary)]/95 border border-[#00a884]/30 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 z-50 text-white shadow-2xl animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Crop size={18} className="text-[#00a884] animate-pulse" />
                    <span className="font-bold text-[#00a884] text-sm">
                      {lang === 'ar' ? 'اسحب الزوايا للقص' : 'Drag corners to crop'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCropTop(0);
                        setCropBottom(0);
                        setCropLeft(0);
                        setCropRight(0);
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-xs font-semibold"
                    >
                      {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
                    </button>
                    <button
                      onClick={() => {
                        setEditorMode('view');
                      }}
                      className="px-4 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-black rounded-xl transition-all text-xs font-bold shadow-md shadow-emerald-950/20"
                    >
                      {lang === 'ar' ? 'نعم / قص' : 'Yes / Apply'}
                    </button>
                  </div>
                </div>
              )}

              {/* Image Container with Editor overlays */}
              <div 
                id="editor-image-container"
                className="relative max-w-full max-h-[60vh] select-none"
                style={{
                  clipPath: editorMode === 'crop' ? 'none' : `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`,
                  transform: `rotate(${editorRotation}deg)`,
                  transition: 'transform 0.3s ease, clip-path 0.3s ease'
                }}
              >
                {/* Background Image */}
                <img 
                  src={pendingImage || ''} 
                  alt="Editor Source" 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg pointer-events-none select-none"
                />

                {/* Crop Mode Visual Overlay */}
                {editorMode === 'crop' && (
                  <div className="absolute inset-0 z-40 pointer-events-none">
                    {/* Dimmed Overlays */}
                    <div className="absolute top-0 left-0 right-0 bg-black/65" style={{ height: `${cropTop}%` }} />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/65" style={{ height: `${cropBottom}%` }} />
                    <div className="absolute left-0 bg-black/65" style={{ top: `${cropTop}%`, bottom: `${cropBottom}%`, width: `${cropLeft}%` }} />
                    <div className="absolute right-0 bg-black/65" style={{ top: `${cropTop}%`, bottom: `${cropBottom}%`, width: `${cropRight}%` }} />

                    {/* Bright Crop Window with Grid and Corners */}
                    <div 
                      className="absolute border-2 border-[#00a884] shadow-[0_0_0_1px_rgba(255,255,255,0.2)] pointer-events-auto"
                      style={{
                        top: `${cropTop}%`,
                        bottom: `${cropBottom}%`,
                        left: `${cropLeft}%`,
                        right: `${cropRight}%`,
                      }}
                    >
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between opacity-30">
                        <div className="w-full h-px bg-white border-b border-dashed border-white/50 mt-[33.33%]" />
                        <div className="w-full h-px bg-white border-b border-dashed border-white/50 mb-[33.33%]" />
                      </div>
                      <div className="absolute inset-0 flex justify-between opacity-30">
                        <div className="w-px h-full bg-white border-r border-dashed border-white/50 ml-[33.33%]" />
                        <div className="w-px h-full bg-white border-r border-dashed border-white/50 mr-[33.33%]" />
                      </div>

                      {/* Interactive Drag Handles */}
                      {/* Corner Handles */}
                      <div 
                        className="absolute -top-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize z-50 group"
                        onMouseDown={(e) => handleCropDragStart(e, 'tl')}
                        onTouchStart={(e) => handleCropDragStart(e, 'tl')}
                      >
                        <div className="w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                      </div>
                      <div 
                        className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize z-50 group"
                        onMouseDown={(e) => handleCropDragStart(e, 'tr')}
                        onTouchStart={(e) => handleCropDragStart(e, 'tr')}
                      >
                        <div className="w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                      </div>
                      <div 
                        className="absolute -bottom-3 -left-3 w-6 h-6 flex items-center justify-center cursor-nesw-resize z-50 group"
                        onMouseDown={(e) => handleCropDragStart(e, 'bl')}
                        onTouchStart={(e) => handleCropDragStart(e, 'bl')}
                      >
                        <div className="w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                      </div>
                      <div 
                        className="absolute -bottom-3 -right-3 w-6 h-6 flex items-center justify-center cursor-nwse-resize z-50 group"
                        onMouseDown={(e) => handleCropDragStart(e, 'br')}
                        onTouchStart={(e) => handleCropDragStart(e, 'br')}
                      >
                        <div className="w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                      </div>

                      {/* Side Handles */}
                      <div 
                        className="absolute -top-1.5 left-3 right-3 h-3 cursor-ns-resize z-40"
                        onMouseDown={(e) => handleCropDragStart(e, 'top')}
                        onTouchStart={(e) => handleCropDragStart(e, 'top')}
                      />
                      <div 
                        className="absolute -bottom-1.5 left-3 right-3 h-3 cursor-ns-resize z-40"
                        onMouseDown={(e) => handleCropDragStart(e, 'bottom')}
                        onTouchStart={(e) => handleCropDragStart(e, 'bottom')}
                      />
                      <div 
                        className="absolute -left-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-40"
                        onMouseDown={(e) => handleCropDragStart(e, 'left')}
                        onTouchStart={(e) => handleCropDragStart(e, 'left')}
                      />
                      <div 
                        className="absolute -right-1.5 top-3 bottom-3 w-3 cursor-ew-resize z-40"
                        onMouseDown={(e) => handleCropDragStart(e, 'right')}
                        onTouchStart={(e) => handleCropDragStart(e, 'right')}
                      />
                    </div>
                  </div>
                )}

                {/* Sketch overlay Canvas */}
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={400}
                  onMouseDown={editorMode === 'draw' ? startDrawing : undefined}
                  onMouseMove={editorMode === 'draw' ? draw : undefined}
                  onMouseUp={editorMode === 'draw' ? endDrawing : undefined}
                  onMouseLeave={editorMode === 'draw' ? endDrawing : undefined}
                  onTouchStart={editorMode === 'draw' ? startDrawing : undefined}
                  onTouchMove={editorMode === 'draw' ? draw : undefined}
                  onTouchEnd={editorMode === 'draw' ? endDrawing : undefined}
                  className={`absolute inset-0 w-full h-full z-20 ${editorMode === 'draw' ? 'cursor-crosshair' : 'pointer-events-none'}`}
                />

                {/* Render Draggable Added Texts */}
                {editorTexts.map(t => (
                  <motion.div
                    key={t.id}
                    id={`editor-text-${t.id}`}
                    drag
                    dragMomentum={false}
                    className="absolute z-30 cursor-move bg-black/60 px-3 py-1.5 rounded-lg border border-white/20 select-none text-base font-bold shadow-xl flex items-center gap-2 group"
                    style={{ left: '20%', top: '30%', color: t.color || 'white' }}
                  >
                    <span>{t.text}</span>
                    <button 
                      onClick={() => setEditorTexts(prev => prev.filter(item => item.id !== t.id))}
                      className="hidden group-hover:flex p-1 bg-red-500 hover:bg-red-600 rounded-full text-white cursor-pointer animate-fade-in"
                    >
                      <X size={10} />
                    </button>
                  </motion.div>
                ))}

                {/* Render Draggable Added Emojis */}
                {editorEmojis.map(em => (
                  <motion.div
                    key={em.id}
                    id={`editor-emoji-${em.id}`}
                    drag
                    dragMomentum={false}
                    className="absolute z-30 cursor-move text-4xl select-none group"
                    style={{ left: '30%', top: '40%' }}
                  >
                    <span>{em.emoji}</span>
                    <button 
                      onClick={() => setEditorEmojis(prev => prev.filter(item => item.id !== em.id))}
                      className="absolute -top-2 -right-2 hidden group-hover:flex p-1 bg-red-500 hover:bg-red-600 rounded-full text-white cursor-pointer animate-fade-in"
                    >
                      <X size={8} />
                    </button>
                  </motion.div>
                ))}

              </div>
            </div>

            {/* Footer: Optional Caption & Send Button */}
            <div className="bg-black/60 border-t border-white/10 p-4 pb-6 flex flex-col gap-3 z-50">
              
              {/* Recipient selection row */}
              <div className="flex justify-between items-center px-1">
                <button
                  type="button"
                  onClick={() => setShowRecipientSelector(true)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-zinc-200 px-4 py-2 rounded-full text-xs transition-colors shadow-md border border-white/5"
                >
                  <Users size={14} className="text-white shrink-0" />
                  <span className="font-semibold max-w-[280px] sm:max-w-md truncate text-right">
                    {lang === 'ar' ? 'إرسال إلى: ' : 'Send to: '}
                    {selectedRecipients.length === 0 && partner ? (partner.name || partner.username) : ''}
                    {selectedRecipients.length > 0 ? (
                      selectedRecipients
                        .map(id => users[id]?.name || users[id]?.username || id)
                        .join(', ')
                    ) : ''}
                  </span>
                  <span className="text-[10px] text-[#00a884] ml-1">▼</span>
                </button>
              </div>

              <div className="flex items-center gap-3 bg-[var(--bg-tertiary)] rounded-full px-4 py-2.5">
                <input 
                  type="text"
                  value={captionText}
                  onChange={e => setCaptionText(e.target.value)}
                  placeholder={lang === 'ar' ? 'إضافة رسالة توضيحية...' : 'Add a caption...'}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-text-muted text-sm sm:text-base"
                />
                
                <button 
                  onClick={handleSendEditedImage}
                  className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-black font-bold flex items-center justify-center transition-transform active:scale-95 shadow-md"
                >
                  <Send size={22} className={lang === 'ar' ? 'rotate-180 mr-0.5' : 'ml-0.5'} />
                </button>
              </div>
            </div>

          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* CHAT RECIPIENT SELECTOR MODAL */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showRecipientSelector && (
          <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center p-0 sm:p-4 text-white">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowRecipientSelector(false); setRecipientSearchText(''); }}
              className="absolute inset-0 bg-black/85 "
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative z-10 text-white font-sans flex flex-col h-[85vh] sm:h-[75vh]"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
                <button
                  onClick={() => { setShowRecipientSelector(false); setRecipientSearchText(''); }}
                  className="p-1.5 hover:bg-zinc-850 rounded-full transition-colors"
                >
                  <ArrowRight size={20} className={lang === 'ar' ? '' : 'rotate-180'} />
                </button>
                <div className="flex-1">
                  <h3 className="text-base font-bold">
                    {lang === 'ar' ? 'اختيار المستلمين' : 'Select Recipients'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {lang === 'ar' 
                      ? `تم تحديد ${selectedRecipients.length}` 
                      : `${selectedRecipients.length} selected`}
                  </p>
                </div>
              </div>

              {/* Search input bar */}
              <div className="p-3 bg-zinc-950/45 border-b border-zinc-800/60">
                <input
                  type="text"
                  value={recipientSearchText}
                  onChange={(e) => setRecipientSearchText(e.target.value)}
                  placeholder={lang === 'ar' ? 'البحث عن جهة اتصال...' : 'Search contact...'}
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00a884] transition-colors"
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto py-2">
                {Object.values(users)
                  .filter(u => 
                    (contacts[u.id] || u.id === 'hbot-ai') && u.id !== currentUser?.id
                  )
                  .filter(friend => {
                    if (!recipientSearchText) return true;
                    const nameMatch = (friend.name || '').toLowerCase().includes(recipientSearchText.toLowerCase());
                    const userMatch = (friend.username || '').toLowerCase().includes(recipientSearchText.toLowerCase());
                    return nameMatch || userMatch;
                  })
                  .length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-sm">
                      {lang === 'ar' ? 'لا يوجد نتائج' : 'No results found'}
                    </div>
                  ) : (
                    Object.values(users)
                      .filter(u => 
                        (contacts[u.id] || u.id === 'hbot-ai') && u.id !== currentUser?.id
                      )
                      .filter(friend => {
                        if (!recipientSearchText) return true;
                        const nameMatch = (friend.name || '').toLowerCase().includes(recipientSearchText.toLowerCase());
                        const userMatch = (friend.username || '').toLowerCase().includes(recipientSearchText.toLowerCase());
                        return nameMatch || userMatch;
                      })
                      .map(friend => {
                        const isSelected = selectedRecipients.includes(friend.id);

                        const toggleSelection = () => {
                          setSelectedRecipients(prev => 
                            prev.includes(friend.id) 
                              ? prev.filter(id => id !== friend.id) 
                              : [...prev, friend.id]
                          );
                        };

                        return (
                          <div
                            key={friend.id}
                            onClick={toggleSelection}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 cursor-pointer transition-colors border-b border-zinc-800/30"
                          >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <img
                                src={friend.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.id}
                                alt={friend.name || friend.username}
                                className="w-10 h-10 rounded-full object-cover bg-zinc-800"
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-right">
                              <div className="text-sm font-semibold text-zinc-100">
                                {friend.name || friend.username}
                              </div>
                              <div className="text-xs text-zinc-500">
                                @{friend.username}
                              </div>
                            </div>

                            {/* Green checkbox circle indicator */}
                            <div className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              isSelected 
                                ? 'bg-[#00a884] border-[#00a884]' 
                                : 'border-zinc-600'
                            }`}>
                              {isSelected && (
                                <span className="text-black font-black text-[10px]">✓</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
              </div>

              {/* Confirm / Done button */}
              <div className="p-4 border-t border-zinc-800/60 bg-zinc-950 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setShowRecipientSelector(false); setRecipientSearchText(''); }}
                  className="px-6 py-2 bg-[#00a884] hover:bg-[#008f6f] text-black text-sm font-bold rounded-full active:scale-95 transition-transform"
                >
                  {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Native Text Addition Dialog */}
      <AnimatePresence>
        {showTextAddDialog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTextAddDialog(false)}
              className="absolute inset-0 bg-black/75 "
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-tertiary)] border border-[#2f3e46] rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative z-10 p-5 text-right font-sans"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              <h3 className="text-base font-bold text-gray-100 mb-3">
                {lang === 'ar' ? 'إضافة نص على الصورة' : 'Add text to image'}
              </h3>
              
              <input 
                type="text"
                value={textValueToInsert}
                onChange={(e) => setTextValueToInsert(e.target.value)}
                autoFocus
                placeholder={lang === 'ar' ? 'اكتب شيئاً...' : 'Type something...'}
                className="w-full bg-[var(--bg-hover)] border border-[#00a884]/30 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-[#00a884] transition-all text-sm mb-4 text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (textValueToInsert.trim()) {
                      setEditorTexts(prev => [...prev, { id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), text: textValueToInsert.trim(), color: drawColor }]);
                    }
                    setShowTextAddDialog(false);
                  }
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (textValueToInsert.trim()) {
                      setEditorTexts(prev => [...prev, { id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), text: textValueToInsert.trim(), color: drawColor }]);
                    }
                    setShowTextAddDialog(false);
                  }}
                  className="flex-1 py-2 bg-[#00a884] hover:bg-[#008f6f] text-black font-bold rounded-xl text-xs transition-all"
                >
                  {lang === 'ar' ? 'حفظ' : 'Save'}
                </button>
                <button
                  onClick={() => setShowTextAddDialog(false)}
                  className="flex-1 py-2 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl text-xs border border-white/10"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Deletion Choice Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/70 "
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[var(--bg-tertiary)] border border-[#2f3e46] rounded-2xl max-w-xs sm:max-w-md w-full overflow-hidden shadow-2xl relative z-10 p-5 sm:p-6 text-right"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              <h3 className="text-lg font-bold text-gray-100 mb-2">
                {lang === 'ar' ? 'حذف الرسالة؟' : 'Delete message?'}
              </h3>
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                {lang === 'ar' 
                  ? `هل تريد حذف الرسائل المحددة (${selectedMessages.length})؟` 
                  : `Are you sure you want to delete the selected messages (${selectedMessages.length})?`
                }
              </p>

              <div className="flex flex-col gap-2">
                {canDeleteForEveryone && (
                  <button
                    onClick={handleDeleteForEveryone}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-red-900/10"
                  >
                    {lang === 'ar' ? 'حذف لدى الجميع' : 'Delete for everyone'}
                  </button>
                )}
                
                <button
                  onClick={handleDeleteForMe}
                  className="w-full py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] text-black font-bold rounded-xl text-sm transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-emerald-950/10"
                >
                  {lang === 'ar' ? 'حذف لدي' : 'Delete for me'}
                </button>

                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-2.5 px-4 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white font-medium rounded-xl text-sm transition-all duration-150 border border-white/10 mt-1"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
