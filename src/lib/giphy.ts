
export const getRecentStickers = (): string[] => {
  try {
    const saved = localStorage.getItem('giphy_recents');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const saveRecentSticker = (url: string) => {
  try {
    const recents = getRecentStickers();
    const newRecents = [url, ...recents.filter(r => r !== url)].slice(0, 20);
    localStorage.setItem('giphy_recents', JSON.stringify(newRecents));
    // Dispatch a custom event to notify components
    window.dispatchEvent(new Event('giphy_recents_updated'));
  } catch (e) {}
};

export const getFavoriteStickers = (): string[] => {
  try {
    const saved = localStorage.getItem('giphy_favorites');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const toggleFavoriteSticker = (url: string) => {
  try {
    const favorites = getFavoriteStickers();
    const isFavorite = favorites.includes(url);
    const newFavs = isFavorite
      ? favorites.filter(f => f !== url)
      : [url, ...favorites];
    localStorage.setItem('giphy_favorites', JSON.stringify(newFavs));
    // Dispatch a custom event to notify components
    window.dispatchEvent(new Event('giphy_favorites_updated'));
    return !isFavorite;
  } catch (e) {
    return false;
  }
};
