export const getStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage access denied', e);
      return null;
    }
  }
  return null;
};

export const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('LocalStorage access denied', e);
    }
  }
};

export const removeStorageItem = (key: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
        window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage access denied', e);
    }
  }
};
