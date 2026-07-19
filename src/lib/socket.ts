import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';

class FirebaseSocket {
  listeners: Record<string, Function[]> = {};
  userId: string | null = null;
  unsub: any = null;
  id = Math.random().toString(36).substring(7);
  connected = false;

  constructor() {
    setTimeout(() => {
      this.connect();
    }, 500);
  }

  connect() {
    this.connected = true;
    this.trigger('connect');
  }

  disconnect() {
    this.connected = false;
    this.userId = null;
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback?: Function) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      this.listeners[event] = [];
    }
  }

  trigger(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(...args));
    }
  }

  emit(event: string, ...args: any[]) {
    if (event === 'auth') {
      this.userId = args[0];
      this.setupListener();
    } else {
      this.sendEventToFirestore(event, args);
    }
  }

  async sendEventToFirestore(event: string, args: any[]) {
    if (!this.userId) return;
    
    let receiver_id = null;
    let payload = args[0];

    if (event === 'typing') {
      receiver_id = payload.receiver_id;
    } else if (event === 'call_user') {
      receiver_id = payload.userToCall;
    } else if (event === 'answer_call') {
      receiver_id = payload.to;
    } else if (event === 'ice_candidate') {
      receiver_id = payload.to;
    } else if (event === 'end_call') {
      receiver_id = payload.to;
    }

    if (receiver_id) {
      await addDoc(collection(db, 'messages'), {
        is_socket_event: true,
        event,
        payload,
        receiver_id,
        sender_id: this.userId,
        timestamp: serverTimestamp()
      });
    }
  }

  setupListener() {
    if (this.unsub) this.unsub();
    if (!this.userId) return;

    // Use receiver_id to listen. We use the messages collection because 
    // it's the only one we have write access to send to other users.
    const q = query(
      collection(db, 'messages'),
      where('receiver_id', '==', this.userId)
    );

    let isFirstRun = true;
    this.unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.is_socket_event) {
            if (!isFirstRun) {
              this.handleIncomingEvent(data.event, data.payload, data.sender_id);
            }
            deleteDoc(change.doc.ref).catch(() => {});
          }
        }
      });
      isFirstRun = false;
    });
  }

  handleIncomingEvent(event: string, payload: any, sender_id: string) {
    if (event === 'typing') {
      this.trigger('user_typing', payload);
    } else if (event === 'call_user') {
      this.trigger('call_incoming', payload);
    } else if (event === 'answer_call') {
      this.trigger('call_accepted', payload.signal);
    } else if (event === 'ice_candidate') {
      this.trigger('ice_candidate', payload);
    } else if (event === 'end_call') {
      this.trigger('call_ended');
    }
  }
}

export const socket = new FirebaseSocket();

socket.on("connect", () => {
  console.log("Socket connected! ID:", socket.id);
  const user = useStore.getState().currentUser;
  if (user) {
    socket.emit("auth", user.id);
  }
});

socket.on("user_typing", ({ sender_id, action }: any) => {
  const state = useStore.getState();
  if (action === 'idle') {
    state.setTypingUser(sender_id, false);
  } else {
    state.setTypingUser(sender_id, action || 'typing');
  }
});
