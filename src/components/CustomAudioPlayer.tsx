import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../lib/store';
import { playSound } from '../lib/sounds';

export default function CustomAudioPlayer({ src, isMe, partnerAvatar, myAvatar, onEnded, shouldPlay, onPlayStart }: { src: string, isMe: boolean, partnerAvatar?: string, myAvatar?: string, onEnded?: () => void, shouldPlay?: boolean, onPlayStart?: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [waveform, setWaveform] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Expose a way for parent to trigger play if needed
  useEffect(() => {
    if (shouldPlay && audioRef.current && !isPlaying) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    } else if (!shouldPlay && audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [shouldPlay]);

  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
      setPlaybackRate(1);
      if (onEndedRef.current) onEndedRef.current();
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  // Generate real waveform peak levels by decoding the audio base64 or source
  useEffect(() => {
    if (!src) return;

    const generateWaveform = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          generateFallbackWave();
          return;
        }
        
        const audioCtx = new AudioContextClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0); // get first channel
        
        const numBars = 30;
        const blockSize = Math.floor(channelData.length / numBars);
        const peaks: number[] = [];
        
        for (let i = 0; i < numBars; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const val = Math.abs(channelData[start + j]);
            if (val > max) max = val;
          }
          peaks.push(max);
        }
        
        const maxPeak = Math.max(...peaks);
        const normalized = peaks.map(p => maxPeak > 0 ? (p / maxPeak) * 80 + 20 : 35);
        setWaveform(normalized);
        await audioCtx.close();
      } catch (e) {
        console.error("Error decoding audio for waveform:", e);
        generateFallbackWave();
      }
    };

    const generateFallbackWave = () => {
      const peaks: number[] = [];
      const numBars = 30;
      const seed = src.length;
      for (let i = 0; i < numBars; i++) {
        const value = Math.abs(Math.sin(seed + i * 1.5)) * 60 + 30;
        peaks.push(value);
      }
      setWaveform(peaks);
    };

    generateWaveform();
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        playSound('voice_message_pause');
      } else {
        if (onPlayStart) onPlayStart();
        audioRef.current.playbackRate = playbackRate;
        playSound('voice_message_playback');
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedCycle = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = percent * duration;
      setProgress(percent * 100);
    }
  };

  const avatar = isMe ? myAvatar : partnerAvatar;
  
  return (
    <div className={`flex items-center gap-2 sm:gap-3 w-full min-w-[200px] max-w-[260px] sm:max-w-[300px] p-1`} dir="ltr">
      <audio ref={audioRef} src={src} />
      
      {/* Avatar or Playback Speed Multiplier */}
      <div className="relative shrink-0">
        {isPlaying ? (
          <button 
            onClick={handleSpeedCycle}
            className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-black text-xs font-bold hover:brightness-110 active:scale-95 transition-all select-none shadow-md border border-[#374045]"
            title="Cycle Speed"
          >
            {playbackRate}x
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent-primary overflow-hidden flex items-center justify-center text-white text-xs font-bold">
            {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : '?'}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 bg-bg-primary rounded-full p-0.5">
           <div className={`w-3 h-3 rounded-full ${isMe ? 'bg-[#00a884]' : 'bg-[#00a884]'}`} />
        </div>
      </div>

      <button onClick={togglePlay} className={`w-8 h-8 flex items-center justify-center shrink-0 ${isMe ? 'text-[#e9edef]' : 'text-[#8696a0]'}`}>
        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="h-4 flex items-center cursor-pointer relative w-full" onClick={handleSeek}>
          {/* Actual waveform peaks */}
          <div className="flex items-center gap-[2px] w-full h-full overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => {
              const peakHeight = waveform[i] || 35;
              return (
                <div 
                  key={i} 
                  className={`flex-1 rounded-full ${i / 30 * 100 < progress ? (isMe ? 'bg-[#4fb6ec]' : 'bg-[#00a884]') : (isMe ? 'bg-white/30' : 'bg-white/20')}`} 
                  style={{ height: `${peakHeight}%`, transition: 'height 0.2s ease' }} 
                />
              );
            })}
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-sm" 
               style={{ left: `max(0%, min(${progress}%, calc(100% - 10px)))`, backgroundColor: isMe ? '#4fb6ec' : '#00a884', transition: 'left 0.1s linear' }} />
        </div>
      </div>
    </div>
  );
}
