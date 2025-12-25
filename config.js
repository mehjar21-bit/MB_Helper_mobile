export const BASE_URL = 'https://mangabuff.ru';
export const LOG_PREFIX = '[MangaBuffExt]';

// ⭐ АДАПТИВНОЕ КОЛИЧЕСТВО ЗАПРОСОВ: меньше для мобильных
export const getMaxConcurrentRequests = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 5 : 10; // 2 для мобильных, 5 для десктопа
};

export const MAX_CONCURRENT_REQUESTS = getMaxConcurrentRequests();

// ⭐ ФУНКЦИЯ ОПРЕДЕЛЕНИЯ УСТРОЙСТВА
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const initialContextState = {
  userCards: { wishlist: false },
  trade: { wishlist: true, owners: true },
  tradeOffer: { wishlist: false, owners: false },
  remelt: { wishlist: false, owners: false },
  market: { wishlist: false, owners: false },
  split: { wishlist: false, owners: false },
  pack: { wishlist: true, owners: false },
  deckCreate: { wishlist: false, owners: false },
  marketCreate: { wishlist: false, owners: false },
  marketRequestCreate: { wishlist: false, owners: false },
  marketRequestView: { wishlist: true, owners: false }, 
  deckView: { wishlist: false, owners: false },
  quizPage: {},
  minePage: {}
};

// ⭐ АДАПТИВНЫЕ СЕЛЕКТОРЫ: можно добавить мобильные версии если классы отличаются
export const contextsSelectors = {
  // Десктопные селекторы (основные)
  userCards: '.manga-cards__item[data-card-id]',
  trade: '.trade__main-item',
  tradeOffer: '.trade__inventory-item',
  remelt: '.card-filter-list__card',
  pack: '.lootbox__card[data-id]',
  market: '.card-filter-list__card',
  split: '.card-filter-list__card',
  deckCreate: '.card-filter-list__card',
  marketCreate: '.card-filter-list__card',
  marketRequestCreate: '.card-filter-list__card[data-card-id]',
  marketRequestView: '.card-pool__item[data-id]', 
  deckView: '.deck__item',
  
  // ⭐ ДОПОЛНИТЕЛЬНО: Мобильные селекторы (если структура отличается)
  // userCards_mobile: '.m-card-item[data-id]', // пример
  // pack_mobile: '.mobile-pack-card', // пример
  
  // ⭐ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ СЕЛЕКТОРА С УЧЕТОМ УСТРОЙСТВА
  getSelector: function(context) {
    const device = getDeviceType();
    const mobileSelector = `${context}_mobile`;
    
    // Если есть мобильный селектор и мы на мобильном устройстве
    if (device === 'mobile' && this[mobileSelector]) {
      console.log(`${LOG_PREFIX} Using mobile selector for ${context}: ${this[mobileSelector]}`);
      return this[mobileSelector];
    }
    
    // Иначе используем стандартный селектор
    return this[context];
  }
};

// ⭐ АДАПТИВНЫЕ ТАЙМАУТЫ ДЛЯ ЗАПРОСОВ
export const getRequestTimeout = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 15000; // 15 секунд для мобильных (медленные сети)
    case 'tablet': return 10000; // 10 секунд для планшетов
    default: return 8000; // 8 секунд для десктопа
  }
};

// ⭐ АДАПТИВНЫЕ ЗАДЕРЖКИ МЕЖДУ ПАКЕТАМИ ЗАПРОСОВ
export const getBatchDelay = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 1500; // 1.5 секунды для мобильных
    case 'tablet': return 1000; // 1 секунда для планшетов
    default: return 500; // 0.5 секунды для десктопа
  }
};

// ⭐ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ОПТИМАЛЬНОГО РАЗМЕРА ПАКЕТА
export const getBatchSize = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 3; // 3 карточки за раз на мобильных
    case 'tablet': return 5; // 5 карточек на планшетах
    default: return 10; // 10 карточек на десктопе
  }
};

export const getCurrentContext = () => {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search); 

  const contextsMap = {
    '/users/\\d+/cards': 'userCards',
    '/trades/\\d+': 'trade',
    '/trades/offers/\\d+': 'tradeOffer',
    '/cards/pack': 'pack',
    '/cards/remelt': 'remelt',
    '/market/\\d+': 'market', 
    '/cards/split': 'split',
    '/market/create': 'marketCreate',
    '/decks/create': 'deckCreate',
    '/decks/\\d+': 'deckView',
    '/quiz': 'quizPage',
    '/mine': 'minePage',
    '/market/requests/create': 'marketRequestCreate',
    '/market/requests/\\d+': 'marketRequestView' 
  };
  
  for (const [pattern, context] of Object.entries(contextsMap)) {
    const regex = new RegExp(`^${pattern}$`);
    if (context === 'marketRequestCreate' && path === '/market/requests/create') {
      console.log(`${LOG_PREFIX} Detected context: ${context}`);
      return context;
    } else if (regex.test(path)) {
      console.log(`${LOG_PREFIX} Detected context: ${context}`);
      return context;
    }
  }
  
  // ⭐ ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ДЛЯ МОБИЛЬНЫХ ПУТЕЙ
  const mobileContextsMap = {
    '/m/users/\\d+/cards': 'userCards', // если есть мобильная версия пути
    '/m/trades/\\d+': 'trade',
    // добавьте другие мобильные пути при необходимости
  };
  
  for (const [pattern, context] of Object.entries(mobileContextsMap)) {
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(path)) {
      console.log(`${LOG_PREFIX} Detected MOBILE context: ${context} for path: ${path}`);
      return context;
    }
  }
  
  console.log(`${LOG_PREFIX} No context detected for path: ${path}`);
  return null;
};

// ⭐ ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ ДЛЯ МОБИЛЬНЫХ
export const mobileSettings = {
  // Оптимизация для медленных сетей
  enableLowDataMode: true,
  
  // Использовать ли кэш более агрессивно на мобильных
  cacheDuration: {
    mobile: 48 * 60 * 60 * 1000, // 48 часов для мобильных
    desktop: 24 * 60 * 60 * 1000 // 24 часа для десктопа
  },
  
  // Задержка перед повторной попыткой запроса
  retryDelay: {
    mobile: 3000, // 3 секунды для мобильных
    desktop: 1000 // 1 секунда для десктопа
  }
};

// ⭐ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ОПТИМАЛЬНЫХ НАСТРОЕК
export const getOptimizedSettings = () => {
  const device = getDeviceType();
  const isMobile = device === 'mobile';
  
  return {
    requestTimeout: getRequestTimeout(),
    batchSize: getBatchSize(),
    batchDelay: getBatchDelay(),
    maxConcurrentRequests: getMaxConcurrentRequests(),
    cacheDuration: isMobile ? 
      mobileSettings.cacheDuration.mobile : 
      mobileSettings.cacheDuration.desktop,
    retryDelay: isMobile ? 
      mobileSettings.retryDelay.mobile : 
      mobileSettings.retryDelay.desktop,
    enableLowDataMode: isMobile && mobileSettings.enableLowDataMode
  };
};