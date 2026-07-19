import React, { useState, useEffect, useRef } from 'react';
import { Camera, Edit2, Plus, ArrowLeft, RotateCw, Type, Smile, Undo, Send, Trash2, X, Eye } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTranslation } from '../lib/i18n';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces for Story/Status system
export interface StatusItem {
  id: string;
  mediaUrl: string;
  timestamp: number;
  caption?: string;
  views: string[];
}

export interface GroupedStatus {
  userId: string;
  userName: string;
  userAvatar: string;
  items: StatusItem[];
}

interface OverlayItem {
  id: string;
  type: 'text' | 'emoji';
  content: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  color?: string;
  size: number;
}

// ----------------------------------------------------
// Segmented Ring Component for Status Circle Outlines
// ----------------------------------------------------
export function SegmentedRing({ count, viewed, size = 64 }: { count: number; viewed: boolean[]; size: number }) {
  if (count <= 0) return null;
  const radius = (size - 6) / 2;
  const center = size / 2;
  const strokeWidth = 3;
  
  if (count === 1) {
    const color = viewed[0] ? '#8696a0' : '#00a884'; // Gray if viewed, green if active
    return (
      <svg width={size} height={size} className="absolute inset-0 select-none pointer-events-none transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  const gap = 5; // degrees
  const totalGaps = count * gap;
  const totalArcAngle = 360 - totalGaps;
  const singleArcAngle = totalArcAngle / count;
  
  const segments = [];
  let startAngle = -90; // Start at the top

  for (let i = 0; i < count; i++) {
    const endAngle = startAngle + singleArcAngle;
    
    const rad1 = (startAngle * Math.PI) / 180;
    const rad2 = (endAngle * Math.PI) / 180;
    
    const x1 = center + radius * Math.cos(rad1);
    const y1 = center + radius * Math.sin(rad1);
    const x2 = center + radius * Math.cos(rad2);
    const y2 = center + radius * Math.sin(rad2);
    
    const color = viewed[i] ? '#8696a0' : '#00a884';
    
    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    segments.push(
      <path
        key={i}
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
    
    startAngle = endAngle + gap;
  }

  return (
    <svg width={size} height={size} className="absolute inset-0 select-none pointer-events-none">
      {segments}
    </svg>
  );
}

// ----------------------------------------------------
// Main Updates Component
// ----------------------------------------------------
export default function Updates() {
  const { currentUser, users, contacts } = useStore();
  const { lang } = useTranslation();
  
  // States for active status list loaded from Firestore
  const [statuses, setStatuses] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local statuses fallback
  const [localStatuses, setLocalStatuses] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('local_statuses') || '[]');
    } catch {
      return [];
    }
  });

  // Audience selection states
  const [audienceType, setAudienceType] = useState<'contacts' | 'except' | 'only'>('contacts');
  const [excludedContacts, setExcludedContacts] = useState<string[]>([]);
  const [onlyShareWithContacts, setOnlyShareWithContacts] = useState<string[]>([]);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [showContactSelectionModal, setShowContactSelectionModal] = useState(false);
  const [contactSelectionType, setContactSelectionType] = useState<'except' | 'only'>('except');
  const [searchContactText, setSearchContactText] = useState('');

  const registeredFriends = Object.values(users).filter(u => 
    !!contacts[u.id] && u.id !== 'hbot-ai' && u.id !== currentUser?.id
  );
  
  // Status Creator/Editor States
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [statusCaption, setStatusCaption] = useState('');
  const [brushColor, setBrushColor] = useState('#00a884');
  const [drawMode, setDrawMode] = useState(false);
  const [paths, setPaths] = useState<{ points: { x: number; y: number }[]; color: string }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Overlays (Text / Emojis)
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [textInputOpen, setTextInputOpen] = useState(false);
  const [tempText, setTempText] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  
  // Dragging overlays
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Story Viewer States
  const [activeStoryUser, setActiveStoryUser] = useState<GroupedStatus | null>(null);
  const [activeStoryItemIndex, setActiveStoryItemIndex] = useState<number>(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [viewerReplyText, setViewerReplyText] = useState('');

  // Swipe gesture detection
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // File picker reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Canvas refs for drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // ----------------------------------------------------
  // Subscribe to real statuses from Firestore
  // ----------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, 'statuses'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setStatuses(list);
    }, (error) => {
      console.error("Error loading statuses:", error);
    });
    return () => unsubscribe();
  }, []);

  // Combine firestore and local statuses, filtering out duplicates
  const allStatusesCombined = [...statuses];
  localStatuses.forEach(ls => {
    if (!allStatusesCombined.some(s => s.id === ls.id || (s.mediaUrl === ls.mediaUrl && s.timestamp === ls.timestamp))) {
      allStatusesCombined.push(ls);
    }
  });

  // Filter statuses within last 24 hours AND check visibility based on audience selector settings
  const activeStatuses = allStatusesCombined.filter(s => {
    // 24 hour window
    if (s.timestamp <= Date.now() - 24 * 3600 * 1000) return false;
    
    // If it is my status, it's always visible to me
    if (s.userId === currentUser?.id) return true;
    
    // Otherwise, check visibility based on audience fields
    const audType = s.audienceType || 'contacts';
    const excluded = s.excludedContacts || [];
    const onlyWith = s.onlyShareWithContacts || [];
    
    if (audType === 'except') {
      return !excluded.includes(currentUser?.id || '');
    } else if (audType === 'only') {
      return onlyWith.includes(currentUser?.id || '');
    }
    
    // default: contacts
    return true;
  });

  // Group active statuses by user
  const grouped = activeStatuses.reduce<Record<string, GroupedStatus>>((acc, item) => {
    const uid = item.userId;
    if (!acc[uid]) {
      acc[uid] = {
        userId: uid,
        userName: item.userName || item.userId,
        userAvatar: item.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + uid,
        items: []
      };
    }
    acc[uid].items.push({
      id: item.id,
      mediaUrl: item.mediaUrl,
      caption: item.caption || '',
      timestamp: item.timestamp,
      views: item.views || []
    });
    return acc;
  }, {});

  const groupedList = Object.values(grouped);

  // Separate mine vs others
  const myGrouped = groupedList.find(g => g.userId === currentUser?.id);
  const otherGrouped = groupedList.filter(g => g.userId !== currentUser?.id);

  // ----------------------------------------------------
  // Sync Canvas Drawing on Image Resize/Load
  // ----------------------------------------------------
  const syncCanvasSize = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      redrawPaths();
    }
  };

  useEffect(() => {
    if (editingImage) {
      // Small timeout to allow render in DOM
      const timer = setTimeout(() => {
        syncCanvasSize();
      }, 100);
      window.addEventListener('resize', syncCanvasSize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', syncCanvasSize);
      };
    }
  }, [editingImage, paths]);

  // ----------------------------------------------------
  // Drawing Canvas Handlers
  // ----------------------------------------------------
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getCanvasTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const handleDrawStart = (x: number, y: number) => {
    if (!drawMode) return;
    setIsDrawing(true);
    setPaths(prev => [...prev, { points: [{ x, y }], color: brushColor }]);
  };

  const handleDrawMove = (x: number, y: number) => {
    if (!isDrawing || !drawMode) return;
    setPaths(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const activePath = { ...updated[updated.length - 1] };
      activePath.points = [...activePath.points, { x, y }];
      updated[updated.length - 1] = activePath;
      return updated;
    });
  };

  const handleDrawEnd = () => {
    setIsDrawing(false);
  };

  const redrawPaths = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paths.forEach(p => {
      if (p.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    redrawPaths();
  }, [paths]);

  // Rotate base64 helper
  const handleRotateImage = async () => {
    if (!editingImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      setEditingImage(canvas.toDataURL('image/jpeg', 0.9));
      // Clear paths/overlays on rotation to prevent aspect ratios misalignment
      setPaths([]);
      setOverlays([]);
    };
    img.src = editingImage;
  };

  // ----------------------------------------------------
  // Drag and drop overlay handlers
  // ----------------------------------------------------
  const handleOverlayMouseDown = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingId(id);
    const item = overlays.find(o => o.id === id);
    if (item && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const currentX = (item.x / 100) * rect.width;
      const currentY = (item.y / 100) * rect.height;
      setDragOffset({
        x: e.clientX - rect.left - currentX,
        y: e.clientY - rect.top - currentY
      });
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (draggingId && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      
      const pctX = Math.max(2, Math.min(98, (newX / rect.width) * 100));
      const pctY = Math.max(2, Math.min(98, (newY / rect.height) * 100));
      
      setOverlays(prev => prev.map(o => o.id === draggingId ? { ...o, x: pctX, y: pctY } : o));
    }
  };

  const handleOverlayTouchStart = (id: string, e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    setDraggingId(id);
    const item = overlays.find(o => o.id === id);
    if (item && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const currentX = (item.x / 100) * rect.width;
      const currentY = (item.y / 100) * rect.height;
      setDragOffset({
        x: e.touches[0].clientX - rect.left - currentX,
        y: e.touches[0].clientY - rect.top - currentY
      });
    }
  };

  const handleContainerTouchMove = (e: React.TouchEvent) => {
    if (draggingId && imageRef.current && e.touches.length > 0) {
      const rect = imageRef.current.getBoundingClientRect();
      const newX = e.touches[0].clientX - rect.left - dragOffset.x;
      const newY = e.touches[0].clientY - rect.top - dragOffset.y;
      
      const pctX = Math.max(2, Math.min(98, (newX / rect.width) * 100));
      const pctY = Math.max(2, Math.min(98, (newY / rect.height) * 100));
      
      setOverlays(prev => prev.map(o => o.id === draggingId ? { ...o, x: pctX, y: pctY } : o));
    }
  };

  // Add overlay (text or emoji)
  const handleAddTextOverlay = () => {
    if (!tempText.trim()) return;
    const newItem: OverlayItem = {
      id: Math.random().toString(),
      type: 'text',
      content: tempText,
      x: 50,
      y: 40,
      color: brushColor,
      size: 26
    };
    setOverlays(prev => [...prev, newItem]);
    setTempText('');
    setTextInputOpen(false);
  };

  const handleAddEmojiOverlay = (emoji: string) => {
    const newItem: OverlayItem = {
      id: Math.random().toString(),
      type: 'emoji',
      content: emoji,
      x: 50,
      y: 50,
      size: 44
    };
    setOverlays(prev => [...prev, newItem]);
    setEmojiPickerOpen(false);
  };

  // ----------------------------------------------------
  // File upload input handler
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        setEditingImage(rawBase64);
        setPaths([]);
        setOverlays([]);
        setStatusCaption('');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  // ----------------------------------------------------
  // Publish / Upload merged Status
  // ----------------------------------------------------
  const handlePublishStatus = () => {
    if (!editingImage) return;
    setIsSubmitting(true);
    
    const img = new Image();
    img.src = editingImage;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsSubmitting(false);
        return;
      }
      
      // Draw background image
      ctx.drawImage(img, 0, 0);
      
      // Scale ratios for drawings/overlays to actual natural pixel coordinates
      const scaleX = img.naturalWidth / (canvasRef.current?.width || 1);
      const scaleY = img.naturalHeight / (canvasRef.current?.height || 1);
      
      // Draw freehand drawings
      paths.forEach(p => {
        if (p.points.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * scaleX; // thicker stroke on high res
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(p.points[0].x * scaleX, p.points[0].y * scaleY);
        for (let i = 1; i < p.points.length; i++) {
          ctx.lineTo(p.points[i].x * scaleX, p.points[i].y * scaleY);
        }
        ctx.stroke();
      });
      
      // Draw overlays (text or emojis)
      overlays.forEach(o => {
        const itemX = (o.x / 100) * img.naturalWidth;
        const itemY = (o.y / 100) * img.naturalHeight;
        
        ctx.save();
        const fontSize = o.size * scaleX;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add stroke/shadow outline for high readability
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6 * scaleX;
        ctx.strokeText(o.content, itemX, itemY);
        
        ctx.fillStyle = o.color || '#ffffff';
        ctx.fillText(o.content, itemX, itemY);
        ctx.restore();
      });
      
      const finalBase64 = canvas.toDataURL('image/jpeg', 0.85);
      
      const newStatusDoc = {
        userId: currentUser?.id || 'anonymous',
        userName: currentUser?.name || currentUser?.username || 'User',
        userAvatar: currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=me',
        mediaUrl: finalBase64,
        caption: statusCaption.trim(),
        timestamp: Date.now(),
        views: [],
        audienceType,
        excludedContacts,
        onlyShareWithContacts
      };

      try {
        await addDoc(collection(db, 'statuses'), newStatusDoc);
      } catch (err) {
        console.error("Error creating status document in Firebase, using fallback local storage:", err);
        const fallbackId = 'local_' + Date.now();
        const updatedLocal = [...localStatuses, { id: fallbackId, ...newStatusDoc }];
        setLocalStatuses(updatedLocal);
        localStorage.setItem('local_statuses', JSON.stringify(updatedLocal));
      } finally {
        // Clear editor states
        setEditingImage(null);
        setPaths([]);
        setOverlays([]);
        setStatusCaption('');
        setIsSubmitting(false);
      }
    };
  };

  // ----------------------------------------------------
  // Story/Status Viewer Controls (Tap / Timer / Swipe)
  // ----------------------------------------------------
  const handleOpenViewer = (userGroup: GroupedStatus) => {
    setActiveStoryUser(userGroup);
    // Find first unviewed story, or start with first one if all viewed
    const firstUnviewedIdx = userGroup.items.findIndex(item => !item.views.includes(currentUser?.id || ''));
    setActiveStoryItemIndex(firstUnviewedIdx !== -1 ? firstUnviewedIdx : 0);
  };

  const currentGroupIndex = groupedList.findIndex(g => g.userId === activeStoryUser?.userId);

  const goToNextFriend = () => {
    const nextIdx = currentGroupIndex + 1;
    if (nextIdx < groupedList.length) {
      setActiveStoryUser(groupedList[nextIdx]);
      // Reset index to first story
      setActiveStoryItemIndex(0);
    } else {
      // Finished all users' stories, return to updates tab!
      setActiveStoryUser(null);
    }
  };

  const goToPrevFriend = () => {
    const prevIdx = currentGroupIndex - 1;
    if (prevIdx >= 0) {
      setActiveStoryUser(groupedList[prevIdx]);
      setActiveStoryItemIndex(0);
    } else {
      // Reset current story to 0
      setActiveStoryItemIndex(0);
    }
  };

  const handleViewerNext = () => {
    if (!activeStoryUser) return;
    if (activeStoryItemIndex < activeStoryUser.items.length - 1) {
      setActiveStoryItemIndex(prev => prev + 1);
    } else {
      goToNextFriend();
    }
  };

  const handleViewerPrev = () => {
    if (!activeStoryUser) return;
    if (activeStoryItemIndex > 0) {
      setActiveStoryItemIndex(prev => prev - 1);
    } else {
      goToPrevFriend();
    }
  };

  // Story Viewer Auto-progress
  const handleViewerNextRef = useRef(handleViewerNext);
  useEffect(() => {
    handleViewerNextRef.current = handleViewerNext;
  });

  useEffect(() => {
    if (!activeStoryUser) return;
    
    setStoryProgress(0);
    const duration = 5000; // 5 seconds per story
    const tick = 50; //ms
    const totalSteps = duration / tick;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const pct = (step / totalSteps) * 100;
      if (pct >= 100) {
        clearInterval(interval);
        setStoryProgress(100);
        handleViewerNextRef.current();
      } else {
        setStoryProgress(pct);
      }
    }, tick);

    return () => clearInterval(interval);
  }, [activeStoryUser?.userId, activeStoryItemIndex]);

  // Mark story as viewed when displayed
  useEffect(() => {
    if (activeStoryUser && currentUser) {
      const currentStory = activeStoryUser.items[activeStoryItemIndex];
      if (currentStory && !currentStory.views.includes(currentUser.id)) {
        const docRef = doc(db, 'statuses', currentStory.id);
        updateDoc(docRef, {
          views: arrayUnion(currentUser.id)
        }).catch(err => console.error("Error setting status view:", err));
      }
    }
  }, [activeStoryUser?.userId, activeStoryItemIndex, currentUser?.id]);

  // Swipe navigation touch handlers
  const handleViewerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleViewerTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect swipe if gesture is horizontal and distance is notable (> 50px)
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        // Swipe Left (depending on language, we move to next or previous)
        if (lang === 'ar') {
          goToPrevFriend();
        } else {
          goToNextFriend();
        }
      } else {
        // Swipe Right
        if (lang === 'ar') {
          goToNextFriend();
        } else {
          goToPrevFriend();
        }
      }
    }
  };

  // Convert status timestamp to pretty label
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now';
    if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return lang === 'ar' ? `منذ ${hours} س` : `${hours}h ago`;
    return lang === 'ar' ? 'أمس' : 'Yesterday';
  };

  return (
    <div className="flex-1 bg-bg-primary flex flex-col h-full relative overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Hidden file input for status picker */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="flex-1 overflow-y-auto overscroll-none flex flex-col p-4 scrollbar-none">
        
        {/* Status Section */}
        <div className="mb-6 mt-2">
          <h2 className="text-xl font-bold text-text-primary mb-4">{lang === 'ar' ? 'الحالة' : 'Status'}</h2>
          
          <div className="flex gap-5 overflow-x-auto scrollbar-none pb-2">
            
            {/* My Status element */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                {myGrouped && myGrouped.items.length > 0 ? (
                  // Active status segmented ring around avatar
                  <div 
                    className="relative w-[70px] h-[70px] flex items-center justify-center cursor-pointer"
                    onClick={() => handleOpenViewer(myGrouped)}
                  >
                    <SegmentedRing 
                      count={myGrouped.items.length} 
                      viewed={myGrouped.items.map(item => item.views.includes(currentUser?.id || ''))} 
                      size={70} 
                    />
                    <img 
                      src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=me'} 
                      alt="My status" 
                      className="w-14 h-14 rounded-full object-cover border-2 border-bg-primary" 
                    />
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerFilePicker();
                      }}
                      className="absolute bottom-1 right-1 w-5.5 h-5.5 bg-[#00a884] rounded-full flex items-center justify-center border border-bg-primary text-white shadow-md cursor-pointer active:scale-95 transition-transform"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </div>
                  </div>
                ) : (
                  // Initial Add Status state
                  <div 
                    className="relative cursor-pointer w-[70px] h-[70px] flex items-center justify-center"
                    onClick={triggerFilePicker}
                  >
                    <img 
                      src={currentUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=me'} 
                      alt="My status" 
                      className="w-14 h-14 rounded-full object-cover border-2 border-bg-primary" 
                    />
                    <div className="absolute bottom-1 right-1 w-5.5 h-5.5 bg-[#00a884] rounded-full flex items-center justify-center border border-bg-primary text-white shadow-md">
                      <Plus size={14} strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
              <span className="text-xs text-text-primary font-semibold mt-1">
                {lang === 'ar' ? 'حالتك' : 'My Status'}
              </span>
            </div>

            {/* Other Users' Statuses */}
            {otherGrouped.map((userStatus) => {
              const hasUnseen = userStatus.items.some(item => !item.views.includes(currentUser?.id || ''));
              return (
                <div 
                  key={userStatus.userId} 
                  className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
                  onClick={() => handleOpenViewer(userStatus)}
                >
                  <div className="relative w-[70px] h-[70px] flex items-center justify-center">
                    <SegmentedRing 
                      count={userStatus.items.length} 
                      viewed={userStatus.items.map(item => item.views.includes(currentUser?.id || ''))} 
                      size={70} 
                    />
                    <img 
                      src={userStatus.userAvatar} 
                      alt={userStatus.userName} 
                      className="w-14 h-14 rounded-full object-cover border-2 border-bg-primary" 
                    />
                  </div>
                  <span className="text-xs text-text-primary font-semibold mt-1 max-w-[70px] truncate">
                    {userStatus.userName}
                  </span>
                </div>
              );
            })}

            {otherGrouped.length === 0 && (!myGrouped || myGrouped.items.length === 0) && (
              <div className="flex items-center text-text-muted text-xs px-2 py-4 italic">
                {lang === 'ar' ? 'لا توجد حالات نشطة حالياً' : 'No active statuses found'}
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-px bg-border-primary mb-6" />

        {/* Channels Section - COMPLETELY EMPTY AS REQUESTED */}
        <div className="flex flex-col pb-20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-text-primary">{lang === 'ar' ? 'القنوات' : 'Channels'}</h2>
          </div>
          <div className="flex flex-col items-center justify-center p-8 bg-bg-secondary/40 border border-border-primary/50 rounded-2xl text-text-muted text-center gap-3">
            <span className="text-3xl opacity-60">📢</span>
            <p className="text-sm font-medium text-text-secondary">
              {lang === 'ar' ? 'لا توجد قنوات لمتابعتها بعد' : 'No channels to follow yet'}
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* IMAGE EDITOR OVERLAY BEFORE POSTING */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {editingImage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 bg-zinc-950 z-50 flex flex-col select-none overflow-hidden"
          >
            {/* Action Header */}
            <div className="h-16 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0 text-white z-20">
              <button 
                onClick={() => setEditingImage(null)} 
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 active:scale-95 transition-transform"
                title="Cancel"
              >
                <ArrowLeft size={22} className={lang === 'ar' ? 'rotate-180' : ''} />
              </button>

              <div className="flex items-center gap-2">
                {/* Rotate Button */}
                <button 
                  onClick={handleRotateImage} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 text-white active:scale-95 transition-transform"
                  title="Rotate"
                >
                  <RotateCw size={20} />
                </button>

                {/* Draw Tool Button */}
                <button 
                  onClick={() => setDrawMode(!drawMode)} 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${drawMode ? 'bg-[#00a884] text-black' : 'hover:bg-zinc-800 text-white'}`}
                  title="Draw Pen"
                >
                  <Edit2 size={20} />
                </button>

                {/* Text overlay button */}
                <button 
                  onClick={() => setTextInputOpen(true)} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 text-white"
                  title="Add Text"
                >
                  <Type size={20} />
                </button>

                {/* Emoji overlay button */}
                <button 
                  onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 text-white"
                  title="Add Emoji"
                >
                  <Smile size={20} />
                </button>

                {/* Undo Button */}
                <button 
                  onClick={() => setPaths(prev => prev.slice(0, -1))} 
                  disabled={paths.length === 0}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-white"
                  title="Undo"
                >
                  <Undo size={20} />
                </button>

                {/* Clear Overlays Button */}
                <button 
                  onClick={() => {
                    setPaths([]);
                    setOverlays([]);
                  }} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 text-white text-rose-400"
                  title="Clear All"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Editing Palette (Brush Colors) */}
            {drawMode && (
              <div className="bg-zinc-900 px-4 py-2 flex justify-center gap-4 shrink-0 border-b border-zinc-800 z-20">
                {['#00a884', '#ffbc00', '#ea4335', '#ffffff', '#2196f3', '#9c27b0'].map(color => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${brushColor === color ? 'border-white scale-110 shadow-md' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}

            {/* Quick Emojis Grid Overlay (popup) */}
            {emojiPickerOpen && (
              <div className="bg-zinc-900/95 border-b border-zinc-800 p-3 grid grid-cols-8 gap-3 justify-items-center shrink-0 z-20">
                {['❤️', '😂', '😍', '👍', '🔥', '😭', '🙌', '👏', '🙏', '🎉', '🌟', '😎', '😜', '👻', '🍕', '🍔'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleAddEmojiOverlay(emoji)}
                    className="text-2xl hover:scale-125 transition-transform active:scale-95 p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Overlay Input Form for Text Overlay */}
            {textInputOpen && (
              <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex gap-2 items-center shrink-0 z-20">
                <input
                  type="text"
                  value={tempText}
                  onChange={(e) => setTempText(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب نصاً...' : 'Enter text...'}
                  className="flex-1 px-4 py-2 bg-zinc-800 border-none rounded-xl text-white outline-none focus:ring-1 focus:ring-[#00a884]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTextOverlay();
                  }}
                />
                <button
                  onClick={handleAddTextOverlay}
                  className="px-4 py-2 bg-[#00a884] text-black font-semibold rounded-xl active:scale-95"
                >
                  OK
                </button>
                <button
                  onClick={() => setTextInputOpen(false)}
                  className="px-3 py-2 bg-zinc-800 rounded-xl text-zinc-400"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}

            {/* Canvas / Preview Workspace */}
            <div 
              className="flex-1 bg-black flex items-center justify-center relative p-2"
              onMouseMove={handleContainerMouseMove}
              onTouchMove={handleContainerTouchMove}
              onMouseUp={() => setDraggingId(null)}
              onTouchEnd={() => setDraggingId(null)}
            >
              {/* Responsive container for sizing both Image & Canvas identically */}
              <div className="relative max-w-full max-h-[70vh] flex items-center justify-center">
                <img 
                  ref={imageRef}
                  src={editingImage} 
                  alt="Status Edit" 
                  className="object-contain max-w-full max-h-[70vh] rounded-lg select-none pointer-events-none"
                  onLoad={syncCanvasSize}
                />

                {/* Freehand drawing canvas */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 z-10 cursor-crosshair touch-none"
                  onMouseDown={(e) => {
                    const pos = getCanvasMousePos(e);
                    handleDrawStart(pos.x, pos.y);
                  }}
                  onMouseMove={(e) => {
                    const pos = getCanvasMousePos(e);
                    handleDrawMove(pos.x, pos.y);
                  }}
                  onMouseUp={handleDrawEnd}
                  onMouseLeave={handleDrawEnd}
                  onTouchStart={(e) => {
                    const pos = getCanvasTouchPos(e);
                    handleDrawStart(pos.x, pos.y);
                  }}
                  onTouchMove={(e) => {
                    const pos = getCanvasTouchPos(e);
                    handleDrawMove(pos.x, pos.y);
                  }}
                  onTouchEnd={handleDrawEnd}
                />

                {/* Draggable overlays on top */}
                {overlays.map(o => (
                  <div
                    key={o.id}
                    onMouseDown={(e) => handleOverlayMouseDown(o.id, e)}
                    onTouchStart={(e) => handleOverlayTouchStart(o.id, e)}
                    onDoubleClick={() => setOverlays(prev => prev.filter(item => item.id !== o.id))}
                    className="absolute z-20 cursor-move select-none p-2 rounded-lg font-bold text-center touch-none select-none"
                    style={{
                      left: `${o.x}%`,
                      top: `${o.y}%`,
                      transform: 'translate(-50%, -50%)',
                      color: o.color || '#ffffff',
                      fontSize: `${o.size}px`,
                      textShadow: '0 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                    }}
                    title="Drag to position. Double click to delete."
                  >
                    {o.content}
                  </div>
                ))}
              </div>

              {/* Guide label */}
              {overlays.length > 0 && (
                <div className="absolute top-2 text-zinc-400 text-xs bg-black/60 px-3 py-1 rounded-full select-none">
                  {lang === 'ar' ? 'اسحب العناصر لوضعها. انقر مرتين للحذف.' : 'Drag to position. Double tap to delete.'}
                </div>
              )}
            </div>

            {/* Audience privacy selector pill */}
            <div className="bg-zinc-900 px-4 pt-3 pb-1 flex justify-between items-center z-20">
              <button
                type="button"
                onClick={() => setShowAudienceModal(true)}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 px-4 py-2 rounded-full text-xs transition-colors shadow-md border border-zinc-700/50"
              >
                <span className="text-sm">🌐</span>
                <span className="font-semibold">
                  {audienceType === 'contacts' && (lang === 'ar' ? 'الحالة (جهات اتصالي)' : 'Status (My contacts)')}
                  {audienceType === 'except' && (lang === 'ar' ? `الحالة (تم استثناء ${excludedContacts.length})` : `Status (${excludedContacts.length} excluded)`)}
                  {audienceType === 'only' && (lang === 'ar' ? `الحالة (المشاركة فقط مع ${onlyShareWithContacts.length})` : `Status (${onlyShareWithContacts.length} included)`)}
                </span>
                <span className="text-[10px] text-[#00a884] ml-1">▼</span>
              </button>
            </div>

            {/* Bottom Caption Input Bar */}
            <div className="bg-zinc-900 border-t border-zinc-800 p-4 flex gap-3 items-center shrink-0 text-white z-20">
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={statusCaption}
                  onChange={(e) => setStatusCaption(e.target.value)}
                  placeholder={lang === 'ar' ? 'إضافة شرح...' : 'Add a caption...'}
                  className="w-full bg-zinc-800 border-none rounded-full py-3 px-5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#00a884] outline-none text-sm"
                  maxLength={150}
                />
              </div>

              <button
                onClick={handlePublishStatus}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-black active:scale-95 transition-transform hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={20} className={lang === 'ar' ? 'rotate-180' : ''} />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* IMMERSIVE STORY VIEWER OVERLAY */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeStoryUser && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setActiveStoryUser(null);
              if (e.key === 'ArrowRight') lang === 'ar' ? handleViewerPrev() : handleViewerNext();
              if (e.key === 'ArrowLeft') lang === 'ar' ? handleViewerNext() : handleViewerPrev();
            }}
            tabIndex={0}
            className="fixed inset-0 bg-black z-50 flex flex-col justify-between overflow-hidden outline-none select-none"
            onTouchStart={handleViewerTouchStart}
            onTouchEnd={handleViewerTouchEnd}
          >
            {/* Top Area: Story Indicators & Header */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-4 flex flex-col gap-3 z-30">
              
              {/* Horizontal Segmented Progress bars */}
              <div className="flex gap-1.5 w-full">
                {activeStoryUser.items.map((item, idx) => {
                  let progressWidth = '0%';
                  if (idx < activeStoryItemIndex) {
                    progressWidth = '100%';
                  } else if (idx === activeStoryItemIndex) {
                    progressWidth = `${storyProgress}%`;
                  }
                  
                  return (
                    <div key={item.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-50 ease-linear"
                        style={{ width: progressWidth }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Story User Info Header */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveStoryUser(null)}
                    className="p-1 hover:bg-white/10 rounded-full active:scale-95 transition-transform"
                  >
                    <ArrowLeft size={22} className={lang === 'ar' ? 'rotate-180' : ''} />
                  </button>
                  <img 
                    src={activeStoryUser.userAvatar} 
                    alt={activeStoryUser.userName} 
                    className="w-10 h-10 rounded-full object-cover border border-white/20 bg-zinc-800"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-tight">{activeStoryUser.userName}</span>
                    <span className="text-[10px] text-zinc-300">
                      {formatTime(activeStoryUser.items[activeStoryItemIndex]?.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Close button */}
                  <button 
                    onClick={() => setActiveStoryUser(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Center Area: Story Media, Click Navs & Captions */}
            <div className="flex-1 relative flex items-center justify-center bg-zinc-950 p-2">
              
              {/* Invisible Click Targets to tap previous/next status */}
              <div 
                onClick={handleViewerPrev}
                className="absolute left-0 top-16 bottom-20 w-[30%] z-20 cursor-pointer"
                title="Tap for previous status"
              />
              <div 
                onClick={handleViewerNext}
                className="absolute right-0 top-16 bottom-20 w-[70%] z-20 cursor-pointer"
                title="Tap for next status"
              />

              {/* Immersive Image Display */}
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeStoryUser.items[activeStoryItemIndex]?.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  src={activeStoryUser.items[activeStoryItemIndex]?.mediaUrl}
                  alt="Status item"
                  className="max-w-full max-h-[80vh] object-contain select-none pointer-events-none rounded-lg"
                />
              </AnimatePresence>

              {/* View Count Badge at bottom if viewing my own status */}
              {activeStoryUser.userId === currentUser?.id && (
                <div className="absolute bottom-24 bg-black/60 px-4 py-1.5 rounded-full text-white text-xs flex items-center gap-2 z-30">
                  <Eye size={14} />
                  <span>
                    {(activeStoryUser.items[activeStoryItemIndex]?.views?.length || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Section: Caption & Quick Reaction Bar */}
            <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-6 pb-4 px-4 flex flex-col gap-4 shrink-0 z-30">
              
              {/* Caption Display if existing */}
              {activeStoryUser.items[activeStoryItemIndex]?.caption && (
                <div className="text-white text-center text-sm px-6 font-medium leading-relaxed max-w-lg mx-auto drop-shadow-md">
                  {activeStoryUser.items[activeStoryItemIndex]?.caption}
                </div>
              )}

              {/* WhatsApp Quick Reactions Panel */}
              <div className="flex justify-around items-center max-w-sm mx-auto w-full py-1 bg-white/5 rounded-2xl border border-white/10">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setViewerReplyText(prev => prev + emoji);
                      // Visual confirmation animation
                    }}
                    className="text-2xl hover:scale-130 active:scale-95 transition-transform p-1.5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Story Swipe up to Reply controls */}
              <div className="flex gap-2 items-center max-w-md mx-auto w-full">
                <input
                  type="text"
                  value={viewerReplyText}
                  onChange={(e) => setViewerReplyText(e.target.value)}
                  placeholder={lang === 'ar' ? 'الرد على الحالة...' : 'Reply to status...'}
                  className="flex-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full py-2 px-4 text-sm text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-[#00a884]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && viewerReplyText.trim()) {
                      // Custom interactive feedback, then clear
                      setViewerReplyText('');
                    }
                  }}
                />
                {viewerReplyText.trim() && (
                  <button
                    onClick={() => setViewerReplyText('')}
                    className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-black font-semibold text-xs active:scale-95 transition-transform"
                  >
                    <Send size={14} className={lang === 'ar' ? 'rotate-180' : ''} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* STATUS AUDIENCE OPTIONS DIALOG / BOTTOM SHEET */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showAudienceModal && (
          <div className="fixed inset-0 z-[610] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAudienceModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative z-10 text-white font-sans flex flex-col max-h-[85vh]"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  {lang === 'ar' ? 'خصوصية الحالة' : 'Status Privacy'}
                </h3>
                <button
                  onClick={() => setShowAudienceModal(false)}
                  className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Description */}
              <div className="px-5 py-4 text-xs text-zinc-400 border-b border-zinc-800/50">
                {lang === 'ar' 
                  ? 'من يمكنه رؤية حالاتك الجديدة؟ لن تؤثر التغييرات على الحالات المنشورة مسبقاً.' 
                  : 'Who can see your new status updates? Changes won\'t affect updates already sent.'}
              </div>

              {/* Options */}
              <div className="flex-1 overflow-y-auto py-2">
                {/* Option 1: All Contacts */}
                <div 
                  onClick={() => setAudienceType('contacts')}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-xl shrink-0">
                    👥
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-100">
                      {lang === 'ar' ? 'جهات اتصالي' : 'My contacts'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {lang === 'ar' ? 'جميع أصدقائك على الشاشة الرئيسية' : 'All of your home screen friends'}
                    </div>
                  </div>
                  <div className="relative w-5 h-5 rounded-full border-2 border-zinc-600 flex items-center justify-center shrink-0">
                    {audienceType === 'contacts' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
                    )}
                  </div>
                </div>

                {/* Option 2: Contacts Except */}
                <div 
                  onClick={() => {
                    setAudienceType('except');
                    setContactSelectionType('except');
                    setSearchContactText('');
                    setShowContactSelectionModal(true);
                  }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-red-950/50 border border-red-900/30 flex items-center justify-center text-xl shrink-0 text-red-400">
                    👤❌
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-100">
                      {lang === 'ar' ? 'جهات اتصالي باستثناء...' : 'My contacts except...'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {lang === 'ar' 
                        ? `${excludedContacts.length} مستثنى` 
                        : `${excludedContacts.length} contacts excluded`}
                    </div>
                  </div>
                  <div className="relative w-5 h-5 rounded-full border-2 border-zinc-600 flex items-center justify-center shrink-0">
                    {audienceType === 'except' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
                    )}
                  </div>
                </div>

                {/* Option 3: Only Share With */}
                <div 
                  onClick={() => {
                    setAudienceType('only');
                    setContactSelectionType('only');
                    setSearchContactText('');
                    setShowContactSelectionModal(true);
                  }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#00a884]/10 border border-[#00a884]/20 flex items-center justify-center text-xl shrink-0 text-[#00a884]">
                    👤✅
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-100">
                      {lang === 'ar' ? 'المشاركة فقط مع...' : 'Only share with...'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {lang === 'ar' 
                        ? `${onlyShareWithContacts.length} مستهدف` 
                        : `${onlyShareWithContacts.length} contacts included`}
                    </div>
                  </div>
                  <div className="relative w-5 h-5 rounded-full border-2 border-zinc-600 flex items-center justify-center shrink-0">
                    {audienceType === 'only' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Done button */}
              <div className="p-4 border-t border-zinc-800/60 bg-zinc-950 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAudienceModal(false)}
                  className="px-6 py-2 bg-[#00a884] text-black text-sm font-bold rounded-full hover:bg-[#008f6f] active:scale-95 transition-transform"
                >
                  {lang === 'ar' ? 'تم' : 'Done'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* CONTACT SELECTION MODAL */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {showContactSelectionModal && (
          <div className="fixed inset-0 z-[620] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactSelectionModal(false)}
              className="absolute inset-0 bg-black/90"
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
                  onClick={() => setShowContactSelectionModal(false)}
                  className="p-1.5 hover:bg-zinc-850 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className={lang === 'ar' ? 'rotate-180' : ''} />
                </button>
                <div className="flex-1">
                  <h3 className="text-base font-bold">
                    {contactSelectionType === 'except' 
                      ? (lang === 'ar' ? 'جهات الاتصال باستثناء...' : 'Hide status from...')
                      : (lang === 'ar' ? 'المشاركة فقط مع...' : 'Share status with...')}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {contactSelectionType === 'except'
                      ? (lang === 'ar' ? `${excludedContacts.length} مستثنى` : `${excludedContacts.length} excluded`)
                      : (lang === 'ar' ? `${onlyShareWithContacts.length} محدد` : `${onlyShareWithContacts.length} selected`)}
                  </p>
                </div>
              </div>

              {/* Search input bar */}
              <div className="p-3 bg-zinc-950/45 border-b border-zinc-800/60">
                <input
                  type="text"
                  value={searchContactText}
                  onChange={(e) => setSearchContactText(e.target.value)}
                  placeholder={lang === 'ar' ? 'البحث عن جهة اتصال...' : 'Search contact...'}
                  className="w-full bg-zinc-800 border border-zinc-700/50 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00a884] transition-colors"
                />
              </div>

              {/* Friend list */}
              <div className="flex-1 overflow-y-auto py-2">
                {registeredFriends.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-sm">
                    {lang === 'ar' ? 'لا يوجد جهات اتصال مسجلة' : 'No registered contacts found'}
                  </div>
                ) : (
                  registeredFriends
                    .filter(f => {
                      if (!searchContactText) return true;
                      const nameMatch = (f.name || '').toLowerCase().includes(searchContactText.toLowerCase());
                      const userMatch = (f.username || '').toLowerCase().includes(searchContactText.toLowerCase());
                      return nameMatch || userMatch;
                    })
                    .map(friend => {
                      const isSelected = contactSelectionType === 'except'
                        ? excludedContacts.includes(friend.id)
                        : onlyShareWithContacts.includes(friend.id);

                      const toggleSelection = () => {
                        if (contactSelectionType === 'except') {
                          setExcludedContacts(prev => 
                            prev.includes(friend.id) 
                              ? prev.filter(id => id !== friend.id) 
                              : [...prev, friend.id]
                          );
                        } else {
                          setOnlyShareWithContacts(prev => 
                            prev.includes(friend.id) 
                              ? prev.filter(id => id !== friend.id) 
                              : [...prev, friend.id]
                          );
                        }
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
                          <div className="flex-1">
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

              {/* Floating green check action button */}
              <div className="p-4 border-t border-zinc-800/60 bg-zinc-950 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowContactSelectionModal(false)}
                  className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-black shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="text-lg font-bold">✓</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
