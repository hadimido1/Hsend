import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  public_key: string;
  name?: string;
  country?: string;
  age?: number;
  avatar_url?: string;
  last_seen?: number;
  contacts?: string[];
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string; // Plaintext content (decrypted)
  type: string; // "text" | "image"
  timestamp: number;
  expires_at?: number | null;
  status?: string;
  reactions?: Record<string, string[]>;
  deleted_for?: string[];
  reply_to?: {
    id: string;
    content: string;
    sender_name: string;
    type: string;
  } | null;
  caption?: string;
  forwarded?: boolean;
}

interface ChatState {
  currentUser: User | null;
  privateKeyPem: string | null;
  setCurrentUser: (user: User, privateKey: string) => void;
  logout: () => void;
  
  users: Record<string, User>;
  addUser: (user: User) => void;
  
  messages: Record<string, Message[]>; // Keyed by partnerId
  addMessage: (partnerId: string, message: Message) => void;
  updateMessage: (partnerId: string, messageId: string, updates: Partial<Message>) => void;
  setMessages: (partnerId: string, messages: Message[]) => void;
  
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
  
  typingUsers: Record<string, 'typing' | 'recording' | false>;
  setTypingUser: (userId: string, isTyping: 'typing' | 'recording' | false) => void;
  
  incognitoMode: boolean;
  setIncognitoMode: (active: boolean) => void;
  
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  
  contacts: Record<string, { nickname?: string; addedAt: number }>;
  addContact: (friendId: string, nickname?: string) => void;
  removeContact: (friendId: string) => void;
  
  blocked: string[];
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  
  friendPreferences: Record<string, { notificationSound?: string; ringtoneSound?: string; }>;
  setFriendPreference: (friendId: string, prefs: { notificationSound?: string; ringtoneSound?: string; }) => void;

  callStatus: "idle" | "calling" | "incoming" | "connected";
  callType: 'audio' | 'video' | null;
  callTo: User | null;
  setCallStatus: (status: "idle" | "calling" | "incoming" | "connected", to?: User, type?: 'audio' | 'video' | null) => void;
  incomingCallData: any;
  setIncomingCallData: (data: any) => void;
}

export const HBOT_USER: User = {
  id: 'hbot-ai',
  username: 'ai_assistant',
  name: 'HiSEND',
  public_key: 'hbot-public-key',
  avatar_url: '/HSEND_LOGO.png'
};

export const useStore = create<ChatState>((set) => ({
  currentUser: null,
  privateKeyPem: null,
  theme: 'dark',
  language: 'ar',
  
  contacts: {},
  addContact: (friendId, nickname) => set((state) => {
    const newContacts = { ...state.contacts, [friendId]: { nickname, addedAt: Date.now() } };
    localStorage.setItem('chat_friends_list', JSON.stringify(newContacts));
    return { contacts: newContacts };
  }),
  removeContact: (friendId) => set((state) => {
    const newContacts = { ...state.contacts };
    delete newContacts[friendId];
    localStorage.setItem('chat_friends_list', JSON.stringify(newContacts));
    return { contacts: newContacts };
  }),

  blocked: [],
  blockUser: (userId) => set((state) => {
    const newBlocked = state.blocked.includes(userId) ? state.blocked : [...state.blocked, userId];
    localStorage.setItem('chat_blocked_list', JSON.stringify(newBlocked));
    return { blocked: newBlocked };
  }),
  unblockUser: (userId) => set((state) => {
    const newBlocked = state.blocked.filter(id => id !== userId);
    localStorage.setItem('chat_blocked_list', JSON.stringify(newBlocked));
    return { blocked: newBlocked };
  }),

  friendPreferences: {},
  setFriendPreference: (friendId, prefs) => set((state) => {
    const current = state.friendPreferences[friendId] || {};
    const newPrefs = { ...state.friendPreferences, [friendId]: { ...current, ...prefs } };
    localStorage.setItem('chat_friend_prefs', JSON.stringify(newPrefs));
    return { friendPreferences: newPrefs };
  }),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('chat_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
  setLanguage: (language) => {
    set({ language });
    localStorage.setItem('chat_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  },
  setCurrentUser: (user, privateKeyPem) => {
    localStorage.setItem('chat_user', JSON.stringify(user));
    localStorage.setItem('chat_priv_key', privateKeyPem);
    set({ currentUser: user, privateKeyPem });
  },
  logout: () => {
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_priv_key');
    set({ currentUser: null, privateKeyPem: null, messages: {}, activeChat: null });
  },
  
  users: {
    'hbot-ai': HBOT_USER
  },
  addUser: (user) => set((state) => {
    const newUsers = { ...state.users, [user.id]: user };
    localStorage.setItem('chat_contacts', JSON.stringify(newUsers));
    return { users: newUsers };
  }),
  
  messages: {},
  addMessage: (partnerId, message) => set((state) => {
    // If incognito mode is active and we are receiving/sending, do not persist to store permanently if closing
    const existing = state.messages[partnerId] || [];
    if (existing.find(m => m.id === message.id)) return state;
    return {
      messages: {
        ...state.messages,
        [partnerId]: [...existing, message].sort((a, b) => a.timestamp - b.timestamp)
      }
    };
  }),
  updateMessage: (partnerId, messageId, updates) => set((state) => {
    const existing = state.messages[partnerId] || [];
    const index = existing.findIndex(m => m.id === messageId);
    if (index === -1) return state;
    const newMessages = [...existing];
    newMessages[index] = { ...newMessages[index], ...updates };
    return {
      messages: {
        ...state.messages,
        [partnerId]: newMessages
      }
    };
  }),
  setMessages: (partnerId, messages) => set((state) => ({
    messages: { ...state.messages, [partnerId]: messages }
  })),
  
  activeChat: null,
  setActiveChat: (id) => set((state) => {
    if (id) {
      localStorage.setItem('chat_active_chat', id);
    } else {
      localStorage.removeItem('chat_active_chat');
    }
    return { activeChat: id };
  }),
  
  typingUsers: {},
  setTypingUser: (userId, isTyping) => set((state) => ({
    typingUsers: { ...state.typingUsers, [userId]: isTyping }
  })),
  
  incognitoMode: false,
  setIncognitoMode: (active) => set({ incognitoMode: active }),
  
  callStatus: "idle",
  callType: null,
  callTo: null,
  setCallStatus: (status, to, type) => set((state) => ({ 
    callStatus: status, 
    callTo: to !== undefined ? to : state.callTo,
    callType: type !== undefined ? type : (status === 'idle' ? null : state.callType)
  })),
  incomingCallData: null,
  setIncomingCallData: (data) => set({ incomingCallData: data })
}));

// Load initial from localStorage
const storedUser = localStorage.getItem('chat_user');
const storedKey = localStorage.getItem('chat_priv_key');
const storedTheme = localStorage.getItem('chat_theme') as 'light' | 'dark';
const storedLang = localStorage.getItem('chat_lang') as 'ar' | 'en';
const storedContacts = localStorage.getItem('chat_contacts');
const storedFriendsList = localStorage.getItem('chat_friends_list');
const storedBlockedList = localStorage.getItem('chat_blocked_list');
const storedFriendPrefs = localStorage.getItem('chat_friend_prefs');
const storedActiveChat = localStorage.getItem('chat_active_chat');

if (storedUser && storedKey) {
  useStore.setState({ currentUser: JSON.parse(storedUser), privateKeyPem: storedKey });
}

if (storedActiveChat) {
  useStore.setState({ activeChat: storedActiveChat });
}

if (storedFriendPrefs) {
  try {
    useStore.setState({ friendPreferences: JSON.parse(storedFriendPrefs) });
  } catch(e) {}
}

if (storedFriendsList) {
  try {
    useStore.setState({ contacts: JSON.parse(storedFriendsList) });
  } catch(e) {}
}

if (storedBlockedList) {
  try {
    useStore.setState({ blocked: JSON.parse(storedBlockedList) });
  } catch(e) {}
}

if (storedContacts) {
  try {
    const parsed = JSON.parse(storedContacts);
    // Ensure HBOT_USER is always up to date and not overwritten by old local storage
     
        parsed['hbot-ai'] = HBOT_USER;
    useStore.setState(state => ({ users: { ...state.users, ...parsed } }));
  } catch(e) {}
}

if (storedTheme) {
  useStore.getState().setTheme(storedTheme);
} else {
  useStore.getState().setTheme('dark');
}

if (storedLang) {
  useStore.getState().setLanguage(storedLang);
} else {
  useStore.getState().setLanguage('ar');
}
