import { LOG_PREFIX } from './config.js';

export const cachedElements = new Map();

// ⭐ ДОБАВИТЬ: Определение мобильного устройства
export const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ⭐ ОПТИМИЗАЦИЯ: Адаптивное логирование для мобильных
export const log = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // На мобильных логируем только важные сообщения (для экономии памяти)
    if (!isMobile || message.includes('Error') || message.includes('Warn') || 
        message.includes('Detected') || message.includes('Processing')) {
        console.log(`${LOG_PREFIX} ${message}`, ...args);
    }
};

export const logWarn = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // На мобильных сокращаем сообщения
    if (isMobile && args.length > 0) {
        // Берем только первый аргумент для экономии памяти
        console.warn(`${LOG_PREFIX} ${message}`, args[0]);
    } else {
        console.warn(`${LOG_PREFIX} ${message}`, ...args);
    }
};

export const logError = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // Всегда логируем ошибки, но на мобильных - кратко
    if (isMobile) {
        // Сокращаем длинные сообщения об ошибках
        const shortMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        // Логируем только первые 2 аргумента
        const limitedArgs = args.slice(0, 2);
        console.error(`${LOG_PREFIX} ${shortMessage}`, ...limitedArgs);
    } else {
        console.error(`${LOG_PREFIX} ${message}`, ...args);
    }
};

export const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime.id;
  } catch (e) {
    const isMobile = isMobileDevice();
    const errorMsg = isMobile ? 'Extension context invalidated' : `Extension context invalidated: ${e}`;
    logError(errorMsg);
    return false;
  }
};

export const getElements = (selector) => {
    const dynamicSelectors = [
        '.trade__inventory-item',
        '.card-filter-list__card',
        '.trade__main-item',
        '.lootbox__card', 
        '.deck__item'
    ];
    
    const isMobile = isMobileDevice();
    
    // ⭐ ОПТИМИЗАЦИЯ: На мобильных чаще обновляем кэш
    if (!cachedElements.has(selector) || dynamicSelectors.includes(selector) || isMobile) {
        const elements = Array.from(document.querySelectorAll(selector));
        cachedElements.set(selector, elements);
        
        if (isMobile && elements.length > 0) {
            // На мобильных логируем только если много элементов
            if (elements.length > 5) {
                log(`Cached ${elements.length} elements for ${selector} (mobile)`);
            }
        }
    }
    
    const result = cachedElements.get(selector) || [];
    
    // ⭐ БЕЗОПАСНОСТЬ: Проверяем что элементы все еще в DOM (особенно важно для мобильных)
    if (isMobile && result.length > 0) {
        const validElements = result.filter(el => el.isConnected);
        if (validElements.length !== result.length) {
            // Обновляем кэш если некоторые элементы удалены
            cachedElements.set(selector, validElements);
            return validElements;
        }
    }
    
    return result;
};

export const debounce = (func, wait) => {
  let timeout;
  const isMobile = isMobileDevice();
  
  // ⭐ ОПТИМИЗАЦИЯ: На мобильных увеличиваем задержку по умолчанию
  const effectiveWait = isMobile ? Math.max(wait, 300) : wait;
  
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), effectiveWait);
  };
};

export const waitForElements = (selector, timeout, single = false) => {
  const isMobile = isMobileDevice();
  
  // ⭐ АДАПТАЦИЯ: Увеличиваем таймаут для мобильных (медленные устройства)
  const effectiveTimeout = isMobile ? timeout * 1.5 : timeout;
  
  return new Promise(resolve => {
    let intervalId;
    const timerId = setTimeout(() => {
      clearInterval(intervalId);
      
      // ⭐ ОПТИМИЗАЦИЯ: Разные сообщения для мобильных
      const warnMsg = isMobile ? 
          `Timeout (${effectiveTimeout}ms) waiting for ${selector}` :
          `Timeout waiting for ${selector}`;
      
      logWarn(warnMsg);
      resolve(single ? null : []);
    }, effectiveTimeout);

    // ⭐ ОПТИМИЗАЦИЯ: На мобильных проверяем реже для экономии батареи
    const checkInterval = isMobile ? 200 : 100;
    
    intervalId = setInterval(() => {
      const elements = single ? document.querySelector(selector) : Array.from(document.querySelectorAll(selector));
      if ((single && elements) || (!single && elements.length > 0)) {
        clearInterval(intervalId);
        clearTimeout(timerId);
        
        // ⭐ ОПТИМИЗАЦИЯ: Меньше логирования на мобильных
        if (!isMobile || elements.length > 3) {
          log(`Found ${single ? 'element' : elements.length + ' elements'} for ${selector}${isMobile ? ' (mobile)' : ''}`);
        }
        
        resolve(elements);
      }
    }, checkInterval);
  });
};

// ⭐ ДОБАВИТЬ: Новые утилиты для мобильных
export const getScreenInfo = () => {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: isMobileDevice(),
        pixelRatio: window.devicePixelRatio || 1,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
};

export const isTouchDevice = () => {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
};

export const optimizeForMobile = (element) => {
    if (!isMobileDevice()) return element;
    
    // Применяем мобильные оптимизации к элементу
    if (element && element.style) {
        // Увеличиваем область касания
        element.style.minHeight = '44px';
        element.style.minWidth = '44px';
        
        // Улучшаем читаемость
        element.style.fontSize = 'calc(100% + 2px)';
        
        // Убираем подсветку при тапе (для iOS)
        element.style.webkitTapHighlightColor = 'transparent';
        
        // Улучшаем плавность анимаций
        element.style.willChange = 'transform, opacity';
    }
    
    return element;
};

export const throttle = (func, limit) => {
    const isMobile = isMobileDevice();
    // На мобильных используем больший лимит для экономии батареи
    const effectiveLimit = isMobile ? limit * 2 : limit;
    
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, effectiveLimit);
        }
    };
};

// ⭐ ДОБАВИТЬ: Функция для безопасного удаления элементов (особенно на мобильных)
export const safeRemove = (element) => {
    if (!element || !element.parentNode) return false;
    
    try {
        element.parentNode.removeChild(element);
        return true;
    } catch (error) {
        if (isMobileDevice()) {
            logWarn('Failed to remove element on mobile:', error.message);
        } else {
            logError('Failed to remove element:', error);
        }
        return false;
    }
};

// ⭐ ДОБАВИТЬ: Функция для измерения производительности (только для dev)
export const measurePerformance = (name, func) => {
    if (!isMobileDevice()) {
        // На десктопе - полное измерение
        console.time(`${LOG_PREFIX} ${name}`);
        const result = func();
        console.timeEnd(`${LOG_PREFIX} ${name}`);
        return result;
    } else {
        // На мобильных - просто выполняем (измерения тратят ресурсы)
        return func();
    }
};