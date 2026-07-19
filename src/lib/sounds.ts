export const NOTIFICATION_SOUNDS = [
  { id: 'default', name: 'الافتراضي' },
  { id: 'pop', name: 'فرقعة' },
  { id: 'chime', name: 'رنين' },
  { id: 'bell', name: 'جرس' },
  { id: 'glass', name: 'زجاج' },
  { id: 'wood', name: 'خشب' },
  { id: 'synth', name: 'مركب صوتي' },
  { id: 'echo', name: 'صدى' },
  { id: 'bubble', name: 'فقاعة' },
  { id: 'coin', name: 'عملة' },
  { id: 'harp', name: 'قيثارة' },
  { id: 'drop', name: 'قطرة' },
  { id: 'snap', name: 'فرقعة أصابع' },
  { id: 'sparkle', name: 'بريق' },
  { id: 'tink', name: 'رنين معدني' },
  { id: 'boop', name: 'تنبيه' },
  { id: 'pluck', name: 'نقر وتر' },
  { id: 'tap', name: 'نقر' },
  { id: 'perc', name: 'إيقاع' },
  { id: 'wave', name: 'موجة' }
];

export const RINGTONE_SOUNDS = [
  { id: 'default', name: 'رنين هاتف تقليدي' },
  { id: 'modern', name: 'هاتف حديث' },
  { id: 'digital', name: 'رقمي' },
  { id: 'uk', name: 'رنين أوروبي/بريطاني' },
  { id: 'us', name: 'رنين أمريكي' },
  { id: 'marimba', name: 'ماريمبا' },
  { id: 'smooth', name: 'هادئ' },
  { id: 'urgent', name: 'عاجل' },
  { id: 'office', name: 'مكتب' },
  { id: 'retro', name: 'ريترو' },
  { id: 'pulse', name: 'نبض' },
  { id: 'alert', name: 'إنذار' },
  { id: 'calm', name: 'سكينة' },
  { id: 'bounce', name: 'ارتداد' },
  { id: 'glassy', name: 'زجاجي' },
  { id: 'dream', name: 'حلم' },
  { id: 'space', name: 'فضاء' },
  { id: 'tech', name: 'تقني' },
  { id: 'classic', name: 'كلاسيكي' },
  { id: 'arcade', name: 'أركيد' }
];

let currentRingtoneOscillators: any[] = [];
let ringtoneInterval: any;
let audioCtx: AudioContext | null = null;
let currentCustomAudio: HTMLAudioElement | null = null;

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const playTone = (freq: number | number[], type: OscillatorType, startTime: number, duration: number, vol = 1.0) => {
  const ctx = getCtx();
  const freqs = Array.isArray(freq) ? freq : [freq];
  
  const results: any[] = [];
  freqs.forEach(f => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol / freqs.length, startTime + Math.min(0.05, duration/2));
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
    results.push({ osc, gain });
  });
  return results;
};

export const playSound = (
  type: 'send' | 'receive' | 'dial' | 'end' | 'record_start' | 'record_stop' | 'record_lock' | 'record_cancel' | 'click' | 
        'call_connected' | 'call_failed' | 'call_waiting' | 'reconnecting' | 'participant_joined' | 'participant_left' | 
        'mic_muted' | 'speaker_toggle' | 'voice_message_playback' | 'voice_message_pause' | 'channel_notification' | 'updates_notification', 
  customUrl?: string
) => {
  if (customUrl && !['default', 'pop', 'chime', 'bell', 'glass', 'wood', 'synth', 'echo', 'bubble', 'coin', 'harp', 'drop', 'snap', 'sparkle', 'tink', 'boop', 'pluck', 'tap', 'perc', 'wave'].includes(customUrl)) {
    if (customUrl.startsWith('data:') || customUrl.startsWith('http')) {
      const audio = new Audio(customUrl);
      audio.play().catch(e => console.error(e));
      return;
    }
  }

  const ctx = getCtx();
  const now = ctx.currentTime;
  const v = 1.0; 

  if (type === 'send') {
    playTone(400, 'sine', now, 0.1, v*0.5);
    playTone(600, 'sine', now + 0.05, 0.15, v*0.5);
  } else if (type === 'record_start') {
    playTone(600, 'sine', now, 0.1, v*0.6);
    playTone(800, 'sine', now + 0.1, 0.15, v*0.7);
  } else if (type === 'record_stop') {
    playTone(800, 'sine', now, 0.1, v*0.7);
    playTone(600, 'sine', now + 0.1, 0.15, v*0.6);
  } else if (type === 'record_lock') {
    playTone(900, 'sine', now, 0.1, v*0.8);
    playTone(1100, 'sine', now + 0.1, 0.15, v*0.9);
  } else if (type === 'record_cancel') {
    playTone(400, 'sawtooth', now, 0.1, v*0.5);
    playTone(200, 'sawtooth', now + 0.1, 0.2, v*0.6);
  } else if (type === 'voice_message_playback') {
    playTone(500, 'sine', now, 0.1, v*0.5);
  } else if (type === 'voice_message_pause') {
    playTone(400, 'sine', now, 0.1, v*0.5);
  } else if (type === 'click') {
    playTone(800, 'sine', now, 0.05, v*0.3);
  } else if (type === 'call_connected') {
    playTone(1000, 'sine', now, 0.1, v*0.8);
  } else if (type === 'call_failed') {
    playTone([300, 350], 'sawtooth', now, 0.3, v*0.6);
    playTone([300, 350], 'sawtooth', now + 0.4, 0.3, v*0.6);
  } else if (type === 'call_waiting') {
    playTone(440, 'sine', now, 0.2, v*0.6);
    playTone(440, 'sine', now + 0.4, 0.2, v*0.6);
  } else if (type === 'reconnecting') {
    playTone(600, 'sine', now, 0.1, v*0.5);
    playTone(600, 'sine', now + 1.0, 0.1, v*0.5);
  } else if (type === 'participant_joined') {
    playTone(500, 'sine', now, 0.1, v*0.6);
    playTone(700, 'sine', now + 0.1, 0.15, v*0.7);
  } else if (type === 'participant_left') {
    playTone(700, 'sine', now, 0.1, v*0.6);
    playTone(500, 'sine', now + 0.1, 0.15, v*0.7);
  } else if (type === 'mic_muted') {
    playTone(300, 'square', now, 0.1, v*0.4);
  } else if (type === 'speaker_toggle') {
    playTone(800, 'square', now, 0.05, v*0.3);
  } else if (type === 'channel_notification') {
    playTone(1200, 'sine', now, 0.1, v*0.8);
    playTone(1400, 'sine', now + 0.1, 0.2, v*0.9);
  } else if (type === 'updates_notification') {
    playTone(1000, 'triangle', now, 0.1, v*0.7);
    playTone(1200, 'triangle', now + 0.1, 0.15, v*0.8);
    playTone(1500, 'triangle', now + 0.25, 0.2, v*0.9);
  } else if (type === 'receive') {
    if (customUrl === 'chime') {
      playTone(523.25, 'sine', now, 0.2, v*0.8);
      playTone(659.25, 'sine', now + 0.15, 0.4, v*0.8);
    } else if (customUrl === 'bell') {
      playTone(880, 'sine', now, 0.4, v*0.7);
      playTone(1760, 'sine', now + 0.1, 0.5, v*0.7);
    } else if (customUrl === 'pop') {
      playTone(800, 'sine', now, 0.1, v*0.9);
    } else if (customUrl === 'glass') {
      playTone(1200, 'triangle', now, 0.3, v*0.8);
    } else if (customUrl === 'wood') {
      playTone(200, 'square', now, 0.1, v*0.9);
    } else if (customUrl === 'synth') {
      playTone([440, 554, 659], 'sawtooth', now, 0.3, v*0.5);
    } else if (customUrl === 'echo') {
      playTone(600, 'sine', now, 0.2, v*0.8);
      playTone(600, 'sine', now + 0.2, 0.2, v*0.5);
      playTone(600, 'sine', now + 0.4, 0.2, v*0.2);
    } else if (customUrl === 'bubble') {
      playTone(400, 'sine', now, 0.1, v*0.9);
      playTone(500, 'sine', now + 0.05, 0.1, v*0.9);
    } else if (customUrl === 'coin') {
      playTone(987.77, 'square', now, 0.1, v*0.4);
      playTone(1318.51, 'square', now + 0.1, 0.4, v*0.4);
    } else if (customUrl === 'harp') {
      playTone(1046.5, 'sine', now, 0.3, v*0.4);
      playTone(1318.5, 'sine', now + 0.1, 0.3, v*0.4);
      playTone(1567.9, 'sine', now + 0.2, 0.4, v*0.4);
    } else if (customUrl === 'drop') {
      playTone(700, 'sine', now, 0.1, v*0.8);
      playTone(900, 'sine', now + 0.05, 0.1, v*0.7);
    } else if (customUrl === 'snap') {
      playTone(1000, 'square', now, 0.05, v*0.9);
    } else if (customUrl === 'sparkle') {
      playTone(2000, 'triangle', now, 0.1, v*0.5);
      playTone(2200, 'triangle', now + 0.05, 0.1, v*0.4);
      playTone(2400, 'triangle', now + 0.1, 0.1, v*0.3);
    } else if (customUrl === 'tink') {
      playTone(3000, 'triangle', now, 0.15, v*0.5);
    } else if (customUrl === 'boop') {
      playTone(440, 'square', now, 0.1, v*0.7);
    } else if (customUrl === 'pluck') {
      playTone(300, 'triangle', now, 0.2, v*0.9);
    } else if (customUrl === 'tap') {
      playTone(150, 'square', now, 0.05, v*0.9);
    } else if (customUrl === 'perc') {
      playTone(100, 'sawtooth', now, 0.1, v*0.9);
    } else if (customUrl === 'wave') {
      playTone([300, 400], 'sine', now, 0.5, v*0.6);
    } else {
      playTone(800, 'sine', now, 0.1, v*0.8);
      playTone(1000, 'sine', now + 0.1, 0.15, v*0.8);
    }
  } else if (type === 'end') {
    playTone(400, 'sine', now, 0.2, v*0.7);
    playTone(300, 'sine', now + 0.2, 0.3, v*0.7);
  }
};

export const startRingtone = (customUrl?: string) => {
  stopRingtone();
  if (customUrl && !['default', 'modern', 'digital', 'uk', 'us', 'marimba', 'smooth', 'urgent', 'office', 'retro', 'pulse', 'alert', 'calm', 'bounce', 'glassy', 'dream', 'space', 'tech', 'classic', 'arcade'].includes(customUrl)) {
    if (customUrl.startsWith('data:') || customUrl.startsWith('http')) {
      const audio = new Audio(customUrl);
      audio.loop = true;
      audio.play().catch(e => console.error(e));
      currentCustomAudio = audio;
      return stopRingtone;
    }
  }
  
  const ctx = getCtx();
  const v = 1.0;
  
  const playRingPattern = () => {
    const now = ctx.currentTime;
    let t: any[] = [];
    if (customUrl === 'uk') {
      t.push(...playTone([400, 450], 'sine', now, 0.4, v));
      t.push(...playTone([400, 450], 'sine', now + 0.6, 0.4, v));
    } else if (customUrl === 'us') {
      t.push(...playTone([440, 480], 'sine', now, 2.0, v));
    } else if (customUrl === 'modern') {
      t.push(...playTone(600, 'sine', now, 0.1, v));
      t.push(...playTone(650, 'sine', now + 0.15, 0.1, v));
      t.push(...playTone(700, 'sine', now + 0.3, 0.1, v));
    } else if (customUrl === 'digital') {
      t.push(...playTone(800, 'square', now, 0.1, v*0.4));
      t.push(...playTone(800, 'square', now + 0.2, 0.1, v*0.4));
      t.push(...playTone(800, 'square', now + 0.4, 0.1, v*0.4));
    } else if (customUrl === 'marimba') {
      t.push(...playTone(523.25, 'sine', now, 0.2, v));
      t.push(...playTone(659.25, 'sine', now + 0.2, 0.2, v));
      t.push(...playTone(783.99, 'sine', now + 0.4, 0.4, v));
    } else if (customUrl === 'smooth') {
      t.push(...playTone(440, 'triangle', now, 1.0, v));
    } else if (customUrl === 'urgent') {
      t.push(...playTone(800, 'square', now, 0.05, v*0.5));
      t.push(...playTone(800, 'square', now + 0.1, 0.05, v*0.5));
      t.push(...playTone(800, 'square', now + 0.2, 0.05, v*0.5));
      t.push(...playTone(800, 'square', now + 0.3, 0.05, v*0.5));
    } else if (customUrl === 'office') {
      t.push(...playTone(600, 'triangle', now, 0.8, v));
      t.push(...playTone(600, 'triangle', now + 1.0, 0.8, v));
    } else if (customUrl === 'retro') {
      t.push(...playTone([500, 520], 'sawtooth', now, 1.5, v*0.4));
    } else if (customUrl === 'pulse') {
      t.push(...playTone(900, 'sine', now, 0.1, v*0.6));
      t.push(...playTone(900, 'sine', now + 0.5, 0.1, v*0.6));
    } else if (customUrl === 'alert') {
      t.push(...playTone(1000, 'square', now, 0.2, v*0.4));
      t.push(...playTone(1200, 'square', now + 0.2, 0.2, v*0.4));
    } else if (customUrl === 'calm') {
      t.push(...playTone(400, 'sine', now, 1.5, v*0.8));
    } else if (customUrl === 'bounce') {
      t.push(...playTone(600, 'triangle', now, 0.1, v));
      t.push(...playTone(500, 'triangle', now + 0.15, 0.1, v));
      t.push(...playTone(400, 'triangle', now + 0.3, 0.1, v));
    } else if (customUrl === 'glassy') {
      t.push(...playTone(1500, 'sine', now, 0.5, v*0.6));
      t.push(...playTone(2000, 'sine', now + 0.2, 0.5, v*0.4));
    } else if (customUrl === 'dream') {
      t.push(...playTone([300, 400, 500], 'sine', now, 2.0, v*0.5));
    } else if (customUrl === 'space') {
      t.push(...playTone([800, 810], 'triangle', now, 1.0, v*0.5));
    } else if (customUrl === 'tech') {
      t.push(...playTone(600, 'square', now, 0.05, v*0.5));
      t.push(...playTone(600, 'square', now + 0.1, 0.05, v*0.5));
      t.push(...playTone(900, 'square', now + 0.2, 0.2, v*0.5));
    } else if (customUrl === 'classic') {
      t.push(...playTone([440, 480], 'sine', now, 0.4, v));
      t.push(...playTone([440, 480], 'sine', now + 0.6, 0.4, v));
    } else if (customUrl === 'arcade') {
      t.push(...playTone(800, 'square', now, 0.1, v*0.4));
      t.push(...playTone(1200, 'square', now + 0.1, 0.1, v*0.4));
      t.push(...playTone(1600, 'square', now + 0.2, 0.3, v*0.4));
    } else { // default
      t.push(...playTone([440, 480], 'sine', now, 1.0, v));
      t.push(...playTone([440, 480], 'sine', now + 1.5, 1.0, v));
    }
    
    t.forEach(res => currentRingtoneOscillators.push(res.osc));
  };

  playRingPattern();
  let interval = 3000;
  if (customUrl === 'us' || customUrl === 'dream') interval = 6000;
  else if (['modern', 'digital', 'urgent', 'marimba', 'pulse', 'bounce', 'tech', 'arcade'].includes(customUrl || '')) interval = 2000;
  else if (customUrl === 'alert') interval = 1000;
  else if (customUrl === 'office' || customUrl === 'retro' || customUrl === 'calm' || customUrl === 'glassy' || customUrl === 'space') interval = 4000;
  
  ringtoneInterval = setInterval(playRingPattern, interval);
  return stopRingtone;
};

export const startDialTone = () => {
  stopRingtone();
  const ctx = getCtx();
  const v = 0.8; // Louder dial tone
  const playDialPattern = () => {
    const now = ctx.currentTime;
    const t = playTone([440, 480], 'sine', now, 2.0, v); // Ringback tone (US style: 2s on, 4s off)
    t.forEach(res => currentRingtoneOscillators.push(res.osc));
  };
  playDialPattern();
  ringtoneInterval = setInterval(playDialPattern, 6000);
  return stopRingtone;
};

export const stopRingtone = () => {
  if (currentCustomAudio) {
    currentCustomAudio.pause();
    currentCustomAudio.src = '';
    currentCustomAudio = null;
  }
  clearInterval(ringtoneInterval);
  currentRingtoneOscillators.forEach(osc => {
    try { osc.stop(); } catch(e) {}
  });
  currentRingtoneOscillators = [];
};
