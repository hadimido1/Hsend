/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { Search, X, TrendingUp, Clock, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { getRecentStickers, saveRecentSticker, getFavoriteStickers, toggleFavoriteSticker } from '../lib/giphy';

const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY;
const gf = new GiphyFetch(giphyApiKey || '');

interface GifPickerProps {
  onGifSelect: (url: string) => void;
  onClose: () => void;
  lang: 'en' | 'ar';
}

type Tab = 'trending' | 'recent' | 'favorites';

const GifPicker: React.FC<GifPickerProps> = ({ onGifSelect, onClose, lang }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [recents, setRecents] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setRecents(getRecentStickers());
    setFavorites(getFavoriteStickers());

    const handleUpdate = () => {
      setRecents(getRecentStickers());
      setFavorites(getFavoriteStickers());
    };

    window.addEventListener('giphy_recents_updated', handleUpdate);
    window.addEventListener('giphy_favorites_updated', handleUpdate);
    return () => {
      window.removeEventListener('giphy_recents_updated', handleUpdate);
      window.removeEventListener('giphy_favorites_updated', handleUpdate);
    };
  }, []);

  const handleGifClick = (gif: any) => {
    const url = gif.images.fixed_height.url;
    saveRecentSticker(url);
    onGifSelect(url);
  };

  const fetchGifs = (offset: number) => {
    const options: any = { offset, limit: 12, type: 'stickers' };
    if (lang === 'ar') options.lang = 'ar';
    
    if (searchTerm) {
      return gf.search(searchTerm, options);
    }
    return gf.trending(options);
  };

  if (!giphyApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-text-muted text-sm mb-4">
          {lang === 'ar' 
            ? 'يرجى إضافة VITE_GIPHY_API_KEY لتفعيل الملصقات.' 
            : 'Please add VITE_GIPHY_API_KEY to enable stickers.'}
        </p>
        <button onClick={onClose} className="bg-[#00a884] text-white px-4 py-2 rounded-lg text-sm font-medium">
          {lang === 'ar' ? 'إغلاق' : 'Close'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#111b21] overflow-hidden flex flex-col">
      <div className="p-3 border-b border-[#374045] space-y-3 bg-[#111b21]">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setActiveTab('trending');
              }}
              placeholder={lang === 'ar' ? 'بحث في GIPHY...' : 'Search GIPHY...'}
              className="w-full bg-[#2a3942] text-text-primary rounded-xl py-2 pl-9 pr-4 outline-none focus:ring-1 focus:ring-[#00a884] text-sm"
            />
          </div>
          <button onClick={onClose} className="text-text-muted hover:bg-[#2a3942] p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1">
          {[
            { id: 'trending', icon: TrendingUp, label: lang === 'ar' ? 'شائع' : 'Trending' },
            { id: 'recent', icon: Clock, label: lang === 'ar' ? 'الأخيرة' : 'Recent' },
            { id: 'favorites', icon: Heart, label: lang === 'ar' ? 'المفضلة' : 'Favs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as Tab);
                setSearchTerm('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#00a884] text-white' 
                  : 'text-text-muted hover:bg-[#2a3942]'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-gif-grid bg-[#1c2930]">
        {activeTab === 'trending' || searchTerm ? (
          <Grid
            width={window.innerWidth < 640 ? window.innerWidth - 64 : 356}
            columns={2}
            fetchGifs={fetchGifs}
            key={searchTerm}
            onGifClick={(gif, e) => {
              e.preventDefault();
              handleGifClick(gif);
            }}
            overlay={({ gif, isHovered }: any) => (
              <div className={`absolute inset-0 flex items-start justify-end p-2 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFavoriteSticker(gif.images.fixed_height.url);
                  }}
                  className={`p-2 rounded-full  transition-all pointer-events-auto ${
                    favorites.includes(gif.images.fixed_height.url) 
                      ? 'bg-[#00a884] text-white opacity-100' 
                      : 'bg-black/40 text-white hover:bg-black/60'
                  }`}
                >
                  <Heart size={16} fill={favorites.includes(gif.images.fixed_height.url) ? "currentColor" : "none"} />
                </button>
              </div>
            )}
            noResultsMessage={lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(activeTab === 'recent' ? recents : favorites).map((url, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden bg-[#2a3942] aspect-square">
                <img 
                  src={url} 
                  alt="gif" 
                  className="w-full h-full object-cover cursor-pointer" 
                  onClick={() => {
                    saveRecentSticker(url);
                    onGifSelect(url);
                  }}
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteSticker(url);
                  }}
                  className={`absolute top-1 right-1 p-1.5 rounded-full  transition-opacity ${
                    favorites.includes(url) ? 'bg-[#00a884] text-white opacity-100' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Heart size={14} fill={favorites.includes(url) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
            {(activeTab === 'recent' ? recents : favorites).length === 0 && (
              <div className="col-span-2 py-10 text-center text-text-muted text-sm">
                {lang === 'ar' ? 'القائمة فارغة' : 'List is empty'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-2 bg-[#233138] flex justify-center border-t border-[#374045]">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/8/82/Giphy-logo.svg" 
          alt="Powered by GIPHY" 
          className="h-4 opacity-30 filter grayscale invert" 
        />
      </div>
    </div>
  );
};

export default GifPicker;
