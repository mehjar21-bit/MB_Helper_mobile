/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./api.js":
/*!****************!*\
  !*** ./api.js ***!
  \****************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   activeRequests: () => (/* binding */ activeRequests),
/* harmony export */   csrfToken: () => (/* binding */ csrfToken),
/* harmony export */   getOwnersCount: () => (/* binding */ getOwnersCount),
/* harmony export */   getWishlistCount: () => (/* binding */ getWishlistCount),
/* harmony export */   pendingRequests: () => (/* binding */ pendingRequests),
/* harmony export */   setCsrfToken: () => (/* binding */ setCsrfToken)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./config.js */ "./config.js");
// api.js (С ОПТИМИЗАЦИЕЙ ПО ПАГИНАЦИИ)



const pendingRequests = new Map();
let activeRequests = 0;
let csrfToken = null;

const setCsrfToken = (token) => {
    csrfToken = token;
}

const getLastPageNumber = (doc) => {
    const paginationButtons = doc.querySelectorAll('ul.pagination li.pagination__button a[href*="page="]');
    let maxPage = 1;
    paginationButtons.forEach(link => {
        const url = link.getAttribute('href');
        const match = url.match(/page=(\d+)/);
        if (match && match[1]) {
            const pageNum = parseInt(match[1], 10);
            if (!isNaN(pageNum) && pageNum > maxPage) {
                maxPage = pageNum;
            }
        }
    });
    return maxPage;
};

const countItemsOnPage = (doc, type) => {
    const selector = type === 'wishlist' ? '.profile__friends-item' : '.card-show__owner';
    return doc.querySelectorAll(selector).length;
};

const getUserCount = async (type, cardId, retries = 2) => {
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) return 0;

  const cacheKey = `${type}_${cardId}`;
  if (!csrfToken) {
      csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }

  try {
    const cached = await chrome.storage.local.get([cacheKey]).then(r => r[cacheKey]);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.count;
    }
  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error accessing local storage for cache key ${cacheKey}:`, error);
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Getting OPTIMIZED ${type} count for card ${cardId}`);
  const requestPromise = (async () => {
    while (activeRequests >= _config_js__WEBPACK_IMPORTED_MODULE_1__.MAX_CONCURRENT_REQUESTS) {
        await new Promise(r => setTimeout(r, 50000));
    }
    activeRequests++;

    let total = 0; 

    try {
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error('Extension context lost before first page fetch');

        let responsePage1 = await chrome.runtime.sendMessage({
            action: `fetch${type.charAt(0).toUpperCase() + type.slice(1)}Count`,
            cardId,
            page: 1, 
            csrfToken
        });

        if (!responsePage1 || !responsePage1.success || !responsePage1.text) {
            if (responsePage1?.error?.includes('404')) {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Card ${cardId} not found for ${type} (404 on page 1). Count is 0.`);
                 total = 0;
            } else {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Failed to fetch page 1 for ${type} count, card ${cardId}:`, responsePage1?.error || 'No response or text');
                 if (retries > 0) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Retrying fetch for card ${cardId} (page 1), retries left: ${retries - 1}`);
                     activeRequests--;
                     pendingRequests.delete(cacheKey);
                     return await getUserCount(type, cardId, retries - 1); 
                 }
                 throw new Error(`Failed to fetch page 1 after retries for card ${cardId}`);
            }
        } else {
            const docPage1 = new DOMParser().parseFromString(responsePage1.text, 'text/html');
            const countPerPage = countItemsOnPage(docPage1, type);
            const lastPageNum = getLastPageNumber(docPage1);
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Page 1 fetched: countPerPage=${countPerPage}, lastPageNum=${lastPageNum}`);

            if (lastPageNum <= 1) {
                total = countPerPage;
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Only one page found. Total ${type} count: ${total}`);
            } else {
                if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error('Extension context lost before last page fetch');

                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Fetching last page (${lastPageNum}) for card ${cardId}`);
                 let responseLastPage = await chrome.runtime.sendMessage({
                     action: `fetch${type.charAt(0).toUpperCase() + type.slice(1)}Count`,
                     cardId,
                     page: lastPageNum, 
                     csrfToken
                 });

                 if (!responseLastPage || !responseLastPage.success || !responseLastPage.text) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Failed to fetch last page (${lastPageNum}) for ${type} count, card ${cardId}:`, responseLastPage?.error || 'No response or text');
                      total = 0; 
                      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Could not calculate total count accurately due to last page fetch error.`);
                 } else {
                     const docLastPage = new DOMParser().parseFromString(responseLastPage.text, 'text/html');
                     const countOnLastPage = countItemsOnPage(docLastPage, type);
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Last page (${lastPageNum}) fetched: countOnLastPage=${countOnLastPage}`);

                     total = (countPerPage * (lastPageNum - 1)) + countOnLastPage;
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Calculated total ${type} count: (${countPerPage} * ${lastPageNum - 1}) + ${countOnLastPage} = ${total}`);
                 }
            }
        }

      if ((0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)() && total >= 0) {
          try {
            await chrome.storage.local.set({ [cacheKey]: { count: total, timestamp: Date.now() } });
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Fetched (Optimized) and cached ${type} count for card ${cardId}: ${total}`);
          } catch (storageError) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error setting local storage for cache key ${cacheKey}:`, storageError);
          }
      } else if (total < 0) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Fetch resulted in invalid count (${total}) for ${type}, card ${cardId}. Not caching.`);
          total = 0; 
      }
      return total; 

    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Unhandled error during OPTIMIZED ${type} count fetch for card ${cardId}:`, error);
        if (retries > 0 && error.message !== 'Extension context lost before first page fetch' && error.message !== 'Extension context lost before last page fetch') {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Retrying entire optimized fetch for card ${cardId} due to error: ${error.message}`);
            activeRequests--;
            pendingRequests.delete(cacheKey);
            return await getUserCount(type, cardId, retries - 1); 
        }
        return 0; 
    } finally {
      activeRequests--;
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

const getWishlistCount = cardId => getUserCount('wishlist', cardId);
const getOwnersCount = cardId => getUserCount('owners', cardId);

/***/ }),

/***/ "./cardProcessor.js":
/*!**************************!*\
  !*** ./cardProcessor.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   processCards: () => (/* binding */ processCards),
/* harmony export */   processCardsLazy: () => (/* binding */ processCardsLazy)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _domUtils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./domUtils.js */ "./domUtils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./main.js */ "./main.js");
// cardProcessor.js (АДАПТИРОВАННЫЙ ДЛЯ МОБИЛЬНЫХ)




 

// Обработка карт
const processCards = async (context, settings) => { 
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)('processCards: Extension context invalid, skipping');
    return;
  }

  const selector = _config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context];
  if (!selector) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`No selector defined for context: ${context}`);
    return;
  }

  const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.getElements)(selector);
  if (!cardItems.length) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`No cards found for selector: ${selector}`);
    return;
  }

  // ⭐ АДАПТИВНЫЙ РАЗМЕР ПАКЕТА
  const BATCH_SIZE = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.getBatchSize)();
  const optimizedSettings = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.getOptimizedSettings)();
  const isMobile = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.isMobileDevice)();
  
  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Processing ${cardItems.length} cards in context "${context}" (batch size: ${BATCH_SIZE}, device: ${isMobile ? 'mobile' : 'desktop'})`);

  // ⭐ ОПТИМИЗАЦИЯ ДЛЯ МОБИЛЬНЫХ: меньше параллельных запросов
  let processedCount = 0;
  const totalCards = cardItems.length;

  for (let i = 0; i < cardItems.length; i += BATCH_SIZE) {
    const batch = cardItems.slice(i, i + BATCH_SIZE);
    
    // ⭐ ЛОГИРОВАНИЕ ПРОГРЕССА ДЛЯ МОБИЛЬНЫХ
    if (isMobile && processedCount % 5 === 0) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Mobile progress: ${processedCount}/${totalCards} cards processed`);
    }
    
    const promises = batch.map(async (item) => {
      let cardId = null;
      try { 
        // ⭐ УНИВЕРСАЛЬНОЕ ПОЛУЧЕНИЕ ID С ПРИОРИТЕТОМ ДЛЯ МОБИЛЬНЫХ
        if (context === 'trade') {
          cardId = item.getAttribute('href')?.match(/\/cards\/(\d+)/)?.[1];
        } else if (context === 'tradeOffer') {
          cardId = item.getAttribute('data-card-id');
        } else if (context === 'pack') {
          cardId = item.getAttribute('data-id');
        } else if (context === 'deckView') {
          cardId = item.getAttribute('data-card-id');
        } else {
          // Пробуем разные атрибуты для мобильной совместимости
          cardId = item.getAttribute('data-card-id') || 
                   item.getAttribute('data-id') ||
                   item.getAttribute('id')?.replace('card-', '');
        }

        if (!cardId) { 
          // ⭐ ДОПОЛНИТЕЛЬНЫЕ ПОПЫТКИ ДЛЯ МОБИЛЬНЫХ
          if (isMobile) {
            // Пробуем найти ID в дочерних элементах
            const idElement = item.querySelector('[data-card-id], [data-id]');
            if (idElement) {
              cardId = idElement.getAttribute('data-card-id') || idElement.getAttribute('data-id');
            }
          }
          
          if (!cardId) {
            throw new Error('Card ID not found');
          }
        }
      } catch (idError) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Skipping item in ${context} due to ID error:`, idError.message);
        // ⭐ НЕ ЛОГИРУЕМ ВЕСЬ HTML НА МОБИЛЬНЫХ ДЛЯ ЭКОНОМИИ ПАМЯТИ
        if (!isMobile) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)('Item HTML:', item.outerHTML);
        }
        return;
      }

      const showWishlist = settings.alwaysShowWishlist || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.wishlist;
      const showOwners = settings.alwaysShowOwners || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.owners;

      // ⭐ ОПТИМИЗАЦИЯ: Удаляем только если нужно показывать
      if (showWishlist || showOwners) {
        item.querySelector('.wishlist-warning')?.remove();
        item.querySelector('.owners-count')?.remove();
      }

      const tasks = [];

      if (showWishlist) {
        tasks.push(
          (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getWishlistCount)(cardId).then(count => {
            if (!item.isConnected) {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Card ${cardId} disconnected, skipping label`);
              return;
            }
            
            // ⭐ АДАПТИВНОЕ ПОЗИЦИОНИРОВАНИЕ ДЛЯ МОБИЛЬНЫХ
            let position = 'top';
            if (isMobile) {
              // На мобильных используем разные позиции для лучшей видимости
              if (context === 'userCards') {
                position = 'top';
              } else if (showOwners) {
                position = 'top';
              } else {
                position = 'top-right';
              }
            } else {
              position = (showOwners && context !== 'userCards') ? 'top' : 'top';
            }
            
            // ⭐ АДАПТИВНЫЙ ЦВЕТ ДЛЯ МОБИЛЬНЫХ (лучшая контрастность)
            const colorOptions = {
              color: count >= settings.wishlistWarning ? 
                (isMobile ? '#FF8C00' : '#FFA500') : // Более яркий оранжевый для мобильных
                (isMobile ? '#32CD32' : '#00FF00')   // Более яркий зеленый для мобильных
            };
            
            (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'wishlist-warning', `${count}`, `Хотят: ${count}`, 
                        position, 'wishlist', colorOptions, context);
                        
          }).catch(error => {
            // ⭐ БОЛЕЕ КОРОТКИЕ СООБЩЕНИЯ ОБ ОШИБКАХ ДЛЯ МОБИЛЬНЫХ
            const errorMsg = isMobile ? 
              `Wishlist error for card ${cardId}: ${error.message}` :
              `Error getting wishlist count for card ${cardId} in ${context}: ${error}`;
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(errorMsg);
          })
        );
      }

      if (showOwners) {
        tasks.push(
          (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getOwnersCount)(cardId).then(count => {
            if (!item.isConnected) {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Card ${cardId} disconnected, skipping label`);
              return;
            }
            
            // ⭐ АДАПТИВНОЕ ПОЗИЦИОНИРОВАНИЕ
            let position = showWishlist ? 'middle' : 'top';
            if (isMobile) {
              // На мобильных используем фиксированные позиции
              if (context === 'userCards') {
                position = 'bottom';
              } else if (showWishlist) {
                position = 'bottom';
              } else {
                position = 'top';
              }
            }
            
            (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'owners-count', `${count}`, `Владеют: ${count}`, 
                        position, 'owners', {}, context);
                        
          }).catch(error => {
            const errorMsg = isMobile ? 
              `Owners error for card ${cardId}: ${error.message}` :
              `Error getting owners count for card ${cardId} in ${context}: ${error}`;
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(errorMsg);
          })
        );
      }

      // ⭐ ОПТИМИЗАЦИЯ: Обрабатываем задачи последовательно на мобильных
      if (isMobile && tasks.length > 0) {
        // На мобильных выполняем последовательно для экономии ресурсов
        for (const task of tasks) {
          try {
            await task;
          } catch (error) {
            // Уже обработано в промисах
          }
        }
      } else if (tasks.length > 0) {
        // На десктопе - параллельно
        await Promise.all(tasks);
      }
      
      processedCount++;
      
    }); 

    // ⭐ ОЖИДАЕМ ВЫПОЛНЕНИЯ ПАКЕТА С АДАПТИВНОЙ ЗАДЕРЖКОЙ
    try {
      await Promise.all(promises);
    } catch (batchError) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Batch ${i/BATCH_SIZE + 1} failed:`, batchError);
    }

    // ⭐ АДАПТИВНАЯ ЗАДЕРЖКА МЕЖДУ ПАКЕТАМИ
    if (cardItems.length > BATCH_SIZE && i + BATCH_SIZE < cardItems.length) {
      const delay = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.getBatchDelay)();
     const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    await new Promise(r => setTimeout(r, isMobile ? 3000 : 3000));
    }
  } 
  
  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Finished processing ${processedCount}/${totalCards} cards in context "${context}"`);
};

// ⭐ ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ МОБИЛЬНОЙ ОПТИМИЗАЦИИ
const processCardsLazy = async (context, settings, observer = null) => {
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) return;
  
  const isMobile = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.isMobileDevice)();
  
  // ⭐ НА МОБИЛЬНЫХ: Обрабатываем только видимые карточки
  if (isMobile && typeof IntersectionObserver !== 'undefined') {
    return await processVisibleCards(context, settings, observer);
  }
  
  // ⭐ НА ДЕСКТОПЕ: Стандартная обработка
  return await processCards(context, settings);
};

// ⭐ LAZY LOADING ДЛЯ МОБИЛЬНЫХ (обработка только видимых карточек)
const processVisibleCards = async (context, settings, observer) => {
  const selector = _config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context];
  if (!selector) return;
  
  const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.getElements)(selector);
  if (!cardItems.length) return;
  
  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Lazy processing ${cardItems.length} cards for mobile`);
  
  // Создаем IntersectionObserver для обработки видимых карточек
  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        intersectionObserver.unobserve(item);
        processSingleCard(item, context, settings);
      }
    });
  }, {
    root: null,
    rootMargin: '200px', // Начинаем загружать заранее
    threshold: 0.1
  });
  
  // Наблюдаем за всеми карточками
  cardItems.forEach(item => {
    intersectionObserver.observe(item);
  });
  
  // ⭐ ОБРАБОТКА УЖЕ ВИДИМЫХ КАРТОЧЕК СРАЗУ
  const visibleCards = cardItems.filter(item => {
    const rect = item.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
  
  (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Processing ${visibleCards.length} immediately visible cards`);
  
  const BATCH_SIZE = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.getBatchSize)();
  for (let i = 0; i < visibleCards.length; i += BATCH_SIZE) {
    const batch = visibleCards.slice(i, i + BATCH_SIZE);
    const promises = batch.map(item => processSingleCard(item, context, settings));
    
    await Promise.all(promises);
    
    if (i + BATCH_SIZE < visibleCards.length) {
      await new Promise(r => setTimeout(r, (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.getBatchDelay)()));
    }
  }
  
  return () => intersectionObserver.disconnect();
};

// ⭐ ОБРАБОТКА ОДНОЙ КАРТОЧКИ
const processSingleCard = async (item, context, settings) => {
  if (!item.isConnected) return;
  
  let cardId = null;
  try {
    // Та же логика извлечения ID что и в processCards
    if (context === 'trade') {
      cardId = item.getAttribute('href')?.match(/\/cards\/(\d+)/)?.[1];
    } else if (context === 'tradeOffer') {
      cardId = item.getAttribute('data-card-id');
    } else if (context === 'pack') {
      cardId = item.getAttribute('data-id');
    } else if (context === 'deckView') {
      cardId = item.getAttribute('data-card-id');
    } else {
      cardId = item.getAttribute('data-card-id') || item.getAttribute('data-id');
    }
    
    if (!cardId) return;
  } catch (error) {
    return;
  }
  
  const showWishlist = settings.alwaysShowWishlist || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.wishlist;
  const showOwners = settings.alwaysShowOwners || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.owners;
  
  if (!showWishlist && !showOwners) return;
  
  // Удаляем старые метки
  item.querySelector('.wishlist-warning')?.remove();
  item.querySelector('.owners-count')?.remove();
  
  const tasks = [];
  const isMobile = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__.isMobileDevice)();
  
  if (showWishlist) {
    tasks.push(
      (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getWishlistCount)(cardId).then(count => {
        if (!item.isConnected) return;
        
        const position = isMobile ? 'top' : 'top';
        const colorOptions = {
          color: count >= settings.wishlistWarning ? 
            (isMobile ? '#FF8C00' : '#FFA500') : 
            (isMobile ? '#32CD32' : '#00FF00')
        };
        
        (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'wishlist-warning', `${count}`, `Хотят: ${count}`, 
                    position, 'wishlist', colorOptions, context);
      }).catch(() => { /* ignore */ })
    );
  }
  
  if (showOwners) {
    tasks.push(
      (0,_api_js__WEBPACK_IMPORTED_MODULE_1__.getOwnersCount)(cardId).then(count => {
        if (!item.isConnected) return;
        
        const position = isMobile ? (showWishlist ? 'bottom' : 'top') : 'middle';
        (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_2__.addTextLabel)(item, 'owners-count', `${count}`, `Владеют: ${count}`, 
                    position, 'owners', {}, context);
      }).catch(() => { /* ignore */ })
    );
  }
  
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

/***/ }),

/***/ "./config.js":
/*!*******************!*\
  !*** ./config.js ***!
  \*******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BASE_URL: () => (/* binding */ BASE_URL),
/* harmony export */   LOG_PREFIX: () => (/* binding */ LOG_PREFIX),
/* harmony export */   MAX_CONCURRENT_REQUESTS: () => (/* binding */ MAX_CONCURRENT_REQUESTS),
/* harmony export */   contextsSelectors: () => (/* binding */ contextsSelectors),
/* harmony export */   getBatchDelay: () => (/* binding */ getBatchDelay),
/* harmony export */   getBatchSize: () => (/* binding */ getBatchSize),
/* harmony export */   getCurrentContext: () => (/* binding */ getCurrentContext),
/* harmony export */   getDeviceType: () => (/* binding */ getDeviceType),
/* harmony export */   getMaxConcurrentRequests: () => (/* binding */ getMaxConcurrentRequests),
/* harmony export */   getOptimizedSettings: () => (/* binding */ getOptimizedSettings),
/* harmony export */   getRequestTimeout: () => (/* binding */ getRequestTimeout),
/* harmony export */   initialContextState: () => (/* binding */ initialContextState),
/* harmony export */   isMobileDevice: () => (/* binding */ isMobileDevice),
/* harmony export */   isTouchDevice: () => (/* binding */ isTouchDevice),
/* harmony export */   mobileSettings: () => (/* binding */ mobileSettings)
/* harmony export */ });
const BASE_URL = 'https://mangabuff.ru';
const LOG_PREFIX = '[MangaBuffExt]';

// ⭐ АДАПТИВНОЕ КОЛИЧЕСТВО ЗАПРОСОВ: меньше для мобильных
const getMaxConcurrentRequests = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 5 : 10; // 2 для мобильных, 5 для десктопа
};

const MAX_CONCURRENT_REQUESTS = getMaxConcurrentRequests();

// ⭐ ФУНКЦИЯ ОПРЕДЕЛЕНИЯ УСТРОЙСТВА
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

const initialContextState = {
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
const contextsSelectors = {
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
const getRequestTimeout = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 15000; // 15 секунд для мобильных (медленные сети)
    case 'tablet': return 10000; // 10 секунд для планшетов
    default: return 8000; // 8 секунд для десктопа
  }
};

// ⭐ АДАПТИВНЫЕ ЗАДЕРЖКИ МЕЖДУ ПАКЕТАМИ ЗАПРОСОВ
const getBatchDelay = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 1500; // 1.5 секунды для мобильных
    case 'tablet': return 1000; // 1 секунда для планшетов
    default: return 500; // 0.5 секунды для десктопа
  }
};

// ⭐ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ОПТИМАЛЬНОГО РАЗМЕРА ПАКЕТА
const getBatchSize = () => {
  const device = getDeviceType();
  switch(device) {
    case 'mobile': return 3; // 3 карточки за раз на мобильных
    case 'tablet': return 5; // 5 карточек на планшетах
    default: return 10; // 10 карточек на десктопе
  }
};

const getCurrentContext = () => {
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
const mobileSettings = {
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
const getOptimizedSettings = () => {
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

/***/ }),

/***/ "./contextHandlers.js":
/*!****************************!*\
  !*** ./contextHandlers.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleMarketCreatePage: () => (/* binding */ handleMarketCreatePage),
/* harmony export */   initPackPage: () => (/* binding */ initPackPage),
/* harmony export */   initStatsButtons: () => (/* binding */ initStatsButtons),
/* harmony export */   initUserCards: () => (/* binding */ initUserCards)
/* harmony export */ });
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./main.js */ "./main.js");




 

const initUserCards = async () => {
  const controlsContainer = document.querySelector('.card-controls.scroll-hidden');
  if (!controlsContainer) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('initUserCards: Controls container not found.');
      return;
  }
  controlsContainer.querySelector('.wishlist-toggle-btn')?.remove();

  const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('button', 'wishlist-toggle-btn');
  toggleBtn.style.marginLeft = '10px';
  controlsContainer.appendChild(toggleBtn);

  // ⭐ ДОБАВЛЯЕМ: Определяем мобильное устройство
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const updateUserCardButtonState = () => {
      (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)().then(currentSettings => {
          const currentContextState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState['userCards'] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState['userCards']; 
          if (currentSettings.alwaysShowWishlist) {
              toggleBtn.textContent = 'Желающие (всегда)';
              toggleBtn.disabled = true;
              toggleBtn.style.opacity = '0.7';
              if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards) _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist = true;
          } else {
              const isActive = currentContextState.wishlist;
              // ⭐ ИЗМЕНЯЕМ: Адаптируем текст для мобильных
              if (isMobile) {
                  toggleBtn.textContent = isActive ? 'Скрыть' : 'Желающие';
              } else {
                  toggleBtn.textContent = isActive ? 'Скрыть желающих' : 'Показать желающих';
              }
              toggleBtn.disabled = false;
              toggleBtn.style.opacity = '1';
          }
          
          // ⭐ ДОБАВЛЯЕМ: Увеличиваем кнопку для мобильных
          if (isMobile) {
              toggleBtn.style.padding = '10px 15px';
              toggleBtn.style.fontSize = '14px';
              toggleBtn.style.minHeight = '44px'; // Минимальная высота для касания
          }
      });
  };

  updateUserCardButtonState();

  toggleBtn.addEventListener('click', async () => {
    const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
    if (currentSettings.alwaysShowWishlist) return;

    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Загрузка...';

    if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards) {
         _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist = !_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards.wishlist;
    } else {
         _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards = { ..._config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState.userCards, wishlist: !_config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState.userCards.wishlist };
    }

    _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards); 
    await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('userCards', currentSettings); 
    updateUserCardButtonState(); 
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`UserCards: Toggled wishlist visibility: ${_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards?.wishlist}`);
  });

  const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.getElements)(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards);
  
  // ⭐ УДАЛЯЕМ: Весь код с правой кнопкой мыши
  // Старый код (удалить):
  // cardItems.forEach(item => {
  //   item.removeEventListener('contextmenu', handleUserCardContextMenu); 
  //   item.addEventListener('contextmenu', handleUserCardContextMenu);
  // });
  
  // ⭐ ВМЕСТО ЭТОГО: Добавляем кнопку "Создать лот" на каждую карточку
  if (isMobile) {
    cardItems.forEach(item => {
      // Удаляем старые кнопки если есть
      item.querySelector('.mobile-create-lot-btn')?.remove();
      
      // Создаем кнопку для создания лота
      const createLotBtn = document.createElement('button');
      createLotBtn.classList.add('mobile-create-lot-btn');
      createLotBtn.textContent = '📈 Лот';
      createLotBtn.title = 'Создать лот на маркете';
      
      // Стили для мобильной кнопки
      createLotBtn.style.cssText = `
        position: absolute;
        bottom: 5px;
        left: 5px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        z-index: 20;
        opacity: 0.9;
        transition: opacity 0.2s;
        min-height: 30px;
        min-width: 60px;
      `;
      
      createLotBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        await handleCreateLotFromCard(item);
      });
      
      // Добавляем кнопку на карточку
      if (getComputedStyle(item).position === 'static') {
        item.style.position = 'relative';
      }
      item.appendChild(createLotBtn);
    });
  }

  const initialShowWishlist = settings.alwaysShowWishlist || _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState.userCards?.wishlist;
  if (initialShowWishlist) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('initUserCards: Initial wishlist processing needed.');
    _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.userCards);
    await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('userCards', settings);
  }
};

// ⭐ НОВАЯ ФУНКЦИЯ: Заменяет handleUserCardContextMenu
const handleCreateLotFromCard = async (cardItem) => {
  const lockButton = cardItem.querySelector('.lock-card-btn');
  const imageDiv = cardItem.querySelector('.manga-cards__image');

  if (!lockButton) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('CreateLot: Lock button (.lock-card-btn) not found.');
    alert('Не удалось найти данные карты');
    return;
  }
  if (!imageDiv) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('CreateLot: Image div (.manga-cards__image) not found.');
    alert('Не удалось найти изображение карты');
    return;
  }

  const cardInstanceId = lockButton.getAttribute('data-id');
  const bgImageStyle = imageDiv.style.backgroundImage;
  const urlMatch = bgImageStyle.match(/url\("?(.+?)"?\)/);
  const imageUrl = urlMatch ? urlMatch[1] : null;

  if (!cardInstanceId) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('CreateLot: Missing data-id on lock button.');
    alert('Ошибка: ID карты не найден');
    return;
  }
  if (!imageUrl) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('CreateLot: Could not extract image URL from style:', bgImageStyle);
    alert('Ошибка: Изображение карты не найдено');
    return;
  }

  (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`CreateLot: Selected card instance ID: ${cardInstanceId}, Image: ${imageUrl}`);

  const dataToSave = {
    instanceId: cardInstanceId,
    imageUrl: imageUrl
  };

  try {
    // Показываем индикатор загрузки
    const originalText = lockButton.textContent;
    lockButton.textContent = '⏳...';
    lockButton.disabled = true;
    
    await chrome.storage.local.set({ selectedMarketCardData: dataToSave });
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('CreateLot: Saved card data to local storage:', dataToSave);
    
    // Подтверждение пользователя (опционально)
    if (confirm('Перейти к созданию лота на маркете?')) {
      window.location.href = `${_config_js__WEBPACK_IMPORTED_MODULE_3__.BASE_URL}/market/create`;
    } else {
      // Восстанавливаем кнопку если пользователь передумал
      lockButton.textContent = originalText;
      lockButton.disabled = false;
      await chrome.storage.local.remove('selectedMarketCardData');
    }
    
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)('CreateLot: Error saving data:', error);
    alert('Не удалось сохранить данные карты для создания лота.');
    lockButton.textContent = '❌ Ошибка';
    setTimeout(() => {
      lockButton.textContent = originalText;
      lockButton.disabled = false;
    }, 2000);
  }
};

// ⭐ УДАЛЯЕМ: Старую функцию handleUserCardContextMenu полностью
// const handleUserCardContextMenu = async (e) => { ... }

const handleMarketCreatePage = async () => {
  // ... существующий код БЕЗ ИЗМЕНЕНИЙ ...
  // (оставляем как есть, он нужен для автоматического заполнения)
};

const initStatsButtons = async (context, targetSelector, buttonClass) => {
    const targetDiv = document.querySelector(targetSelector);
    if (!targetDiv) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)(`initStatsButtons: Target selector '${targetSelector}' not found for context '${context}'.`);
        return;
    }
    
    // ⭐ ДОБАВЛЯЕМ: Определяем мобильное устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
    const currentContextState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context]; 

    const buttonsConfig = [
      { name: 'wishlist', text: 'Желают', activeClass: `${buttonClass}--active`, dataAttr: `data-${context}-wishlist-btn` },
      { name: 'owners', text: 'Владеют', activeClass: `${buttonClass}--active`, dataAttr: `data-${context}-owners-btn` }
    ];

    let nextSiblingElement = null;
    if (context === 'tradeOffer') {
        const possibleButtons = targetDiv.querySelectorAll('button, a.button, .button');
        nextSiblingElement = Array.from(possibleButtons).find(el => el.textContent.trim().includes('Анимированные'));
    }

    buttonsConfig.forEach(({ name, text, activeClass, dataAttr }) => {
      const alwaysShowSetting = name === 'wishlist' ? settings.alwaysShowWishlist : settings.alwaysShowOwners;
      const existingButton = targetDiv.querySelector(`[${dataAttr}]`);

      let btn = existingButton; 

      if (!btn) {
        btn = document.createElement('button');
        btn.classList.add(...buttonClass.split(' ').filter(Boolean), `${context}-${name}-btn`);
        btn.setAttribute(dataAttr, 'true');
        btn.style.display = 'inline-block';
        btn.style.verticalAlign = 'middle';
        btn.style.transition = 'background-color 0.3s ease, opacity 0.3s ease'; 
        btn.style.marginLeft = '5px';
        
        // ⭐ ДОБАВЛЯЕМ: Мобильные стили для кнопок
        if (isMobile) {
          btn.style.padding = '8px 12px';
          btn.style.fontSize = '14px';
          btn.style.minHeight = '36px';
          btn.style.minWidth = '90px';
          btn.style.margin = '4px';
          // Короткие тексты для мобильных
          const shortText = name === 'wishlist' ? 'Хотят' : 'Владеют';
          btn.textContent = alwaysShowSetting ? `${shortText} (всегда)` : `Показать ${shortText.toLowerCase()}`;
        }

        if (nextSiblingElement) {
             targetDiv.insertBefore(btn, nextSiblingElement);
        } else {
             targetDiv.appendChild(btn); 
        }

        btn.addEventListener('click', async () => {
          const currentSettingsClick = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
          const currentAlwaysShow = name === 'wishlist' ? currentSettingsClick.alwaysShowWishlist : currentSettingsClick.alwaysShowOwners;
          if (currentAlwaysShow) return; 

          btn.disabled = true;
          btn.textContent = '...';

          if (_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]) {
              _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name] = !_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name];
          } else {
              _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] = { ..._config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context], [name]: !_config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context][name] };
          }
          const isActive = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context][name]; 

          updateButtonAppearance(btn, isActive, name, activeClass, text, currentAlwaysShow); 

          _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context]);
          (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, currentSettingsClick)
            .catch(err => (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logError)(`Error processing cards after ${name} toggle in ${context}:`, err))
            .finally(() => {
                 btn.disabled = false;
                 updateButtonAppearance(btn, _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.[name], name, activeClass, text, currentAlwaysShow);
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`${context}: Toggled ${name} visibility: ${_main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context]?.[name]}`);
          });
        });
      }

      updateButtonAppearance(btn, currentContextState[name], name, activeClass, text, alwaysShowSetting);
    });

    const shouldProcessInitially = (settings.alwaysShowWishlist || currentContextState.wishlist) || (settings.alwaysShowOwners || currentContextState.owners);
    if (shouldProcessInitially) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)(`initStatsButtons: Initial processing needed for ${context}.`);
      _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors[context]); 
      await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, settings); 
    }
};

const updateButtonAppearance = (btn, isActive, type, activeClass, defaultText, alwaysShow) => {
    if (!btn) return; 
    
    // ⭐ ДОБАВЛЯЕМ: Определяем мобильное устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const label = type === 'wishlist' ? 'Желают' : 'Владеют';
    const shortLabel = type === 'wishlist' ? 'Хотят' : 'Владеют'; // Короткая версия для мобильных
    
    if (alwaysShow) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        // ⭐ АДАПТИРУЕМ: Текст для мобильных
        btn.textContent = isMobile ? `${shortLabel} (всегда)` : `${label} (всегда)`;
        btn.classList.remove(activeClass); 
        btn.style.backgroundColor = '';
        btn.style.color = '';
        btn.style.borderColor = ''; 
    } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        if (isActive) {
            btn.classList.add(activeClass);
            btn.style.backgroundColor = '#8e44ad'; 
            btn.style.color = '#FFFFFF';
            btn.style.borderColor = '#8e44ad';
            // ⭐ АДАПТИРУЕМ: Текст для мобильных
            btn.textContent = isMobile ? `Скрыть ${shortLabel.toLowerCase()}` : `Скрыть ${label.toLowerCase()}`;
        } else {
            btn.classList.remove(activeClass);
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.borderColor = '';
            // ⭐ АДАПТИРУЕМ: Текст для мобильных
            btn.textContent = isMobile ? `Показать ${shortLabel.toLowerCase()}` : `Показать ${label.toLowerCase()}`;
        }
    }
}


const initPackPage = async () => {
  const packContainer = document.querySelector('.lootbox__inner');
  if (!packContainer) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Pack container (.lootbox__inner) not found');
    return;
  }
  const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)();
  const context = 'pack';
  const currentPackState = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context];

  const processExistingCards = async () => {
      if (settings.alwaysShowWishlist || currentPackState.wishlist) {
          const initialCards = packContainer.querySelectorAll(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
          if (initialCards.length > 0) {
              _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)('pack', settings);
          }
      } else {
           const existingLabels = packContainer.querySelectorAll('.wishlist-warning, .owners-count');
           existingLabels.forEach(label => label.remove());
      }
  };

  await processExistingCards();

  const observerCallback = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.debounce)(async (mutations) => {
      if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.isExtensionContextValid)()) {
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Observer callback skipped, extension context lost.');
          return;
      }
      let cardsChanged = false;
      for (const mutation of mutations) {
          if (mutation.type === 'childList') {
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack))) {
                  cardsChanged = true;
                  break;
              }
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.querySelector?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.querySelector?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack))) {
                   cardsChanged = true;
                   break;
              }

          } else if (mutation.type === 'attributes' && (mutation.attributeName === 'data-id' || mutation.attributeName === 'class') && mutation.target.matches?.(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack)) {
              cardsChanged = true;
              break;
          }
      }

      if (cardsChanged) {
          const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_0__.getSettings)(); 
          const currentPackStateUpdated = _main_js__WEBPACK_IMPORTED_MODULE_4__.contextState[context] || _config_js__WEBPACK_IMPORTED_MODULE_3__.initialContextState[context]; 
          const shouldShowLabels = currentSettings.alwaysShowWishlist || currentPackStateUpdated.wishlist;

          if (shouldShowLabels) {
              _utils_js__WEBPACK_IMPORTED_MODULE_2__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_1__.processCards)(context, currentSettings); 
          } else {
              const cardItems = (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.getElements)(_config_js__WEBPACK_IMPORTED_MODULE_3__.contextsSelectors.pack);
              cardItems.forEach(item => {
                  item.querySelector('.wishlist-warning')?.remove();
                  item.querySelector('.owners-count')?.remove(); 
              });
          }
      }
  }, 300); 

  if (!packContainer._extensionObserver) {
      const observer = new MutationObserver(observerCallback);
      observer.observe(packContainer, {
          childList: true, 
          subtree: true,   
          attributes: true, 
          attributeFilter: ['data-id', 'class'] 
      });
      packContainer._extensionObserver = observer; 
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.log)('PackPage: Setup observer for pack container');
  } else {
       (0,_utils_js__WEBPACK_IMPORTED_MODULE_2__.logWarn)('PackPage: Observer already exists for pack container.');
  }
};

/***/ }),

/***/ "./domUtils.js":
/*!*********************!*\
  !*** ./domUtils.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addExtensionSettingsButton: () => (/* binding */ addExtensionSettingsButton),
/* harmony export */   addMobileOptimizations: () => (/* binding */ addMobileOptimizations),
/* harmony export */   addTextLabel: () => (/* binding */ addTextLabel)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");


const addTextLabel = (container, className, text, title, position, type, options = {}, context) => {
  if (!container || !(container instanceof HTMLElement)) {
      return;
  }

  try {
    // ⭐ ДОБАВИТЬ: Определение мобильного устройства
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const existingLabel = container.querySelector(`.${className}`);
    if (existingLabel) existingLabel.remove();

    const div = document.createElement('div');
    div.classList.add(className);
    div.title = title;

    const svgIconContainer = document.createElement('span');
    svgIconContainer.style.display = 'inline-flex';
    svgIconContainer.style.alignItems = 'center';

    let svgString = '';
    // ⭐ УВЕЛИЧИТЬ: Иконки для мобильных
    const iconSize = isMobile ? '14' : '12';
    
    if (type === 'wishlist') {
      svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="currentColor" style="vertical-align: middle;">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>`;
    } else if (type === 'owners') {
      svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="currentColor" style="vertical-align: middle;">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>`;
    }
    svgIconContainer.innerHTML = svgString;

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    textSpan.style.lineHeight = '1';

    div.appendChild(svgIconContainer);
    div.appendChild(textSpan);

    const isUserCards = context === 'userCards';
    const isDeckView = context === 'deckView';
    
    // ⭐ АДАПТИРОВАТЬ: Позиционирование для мобильных
    const positionStyle = isUserCards ? 'left: 5px;' : 'right: 5px;';
    
    // ⭐ ИЗМЕНИТЬ: Больший отступ для мобильных
    let topPosition;
    if (isMobile) {
      // На мобильных используем фиксированные позиции
      if (position === 'top') {
        topPosition = '8px';
      } else if (position === 'middle') {
        topPosition = '35px';
      } else if (position === 'bottom') {
        topPosition = '60px';
      } else {
        topPosition = '8px';
      }
    } else {
      // На десктопе - оригинальные значения
      topPosition = (position === 'top') ? '5px' : '25px';
    }
    
    // ⭐ АДАПТИВНЫЕ СТИЛИ
    const fontSize = isMobile ? '14px' : '12px';
    const padding = isMobile ? '6px 10px' : '2px 5px';
    const borderRadius = isMobile ? '6px' : '3px';
    const backgroundColor = isMobile ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)';
    const minHeight = isMobile ? '32px' : 'auto';
    const minWidth = isMobile ? '40px' : 'auto';
    const zIndex = isMobile ? '1000' : '10';
    
    const deckViewStyles = isDeckView ? `
      z-index: 1000;
      font-size: 14px;
      padding: 3px 6px;
      background-color: rgba(0, 0, 0, 0.8);
      border: 1px solid ${options.color || '#FFFFFF'};
    ` : '';

    // ⭐ ОСНОВНЫЕ СТИЛИ С АДАПТАЦИЕЙ
    div.style.cssText = `
      position: absolute;
      top: ${topPosition};
      ${positionStyle}
      color: ${options.color || '#FFFFFF'};
      font-size: ${fontSize};
      background-color: ${backgroundColor};
      padding: ${padding};
      border-radius: ${borderRadius};
      z-index: ${zIndex};
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: ${minHeight};
      min-width: ${minWidth};
      ${deckViewStyles}
      ${isMobile ? 'box-shadow: 0 2px 8px rgba(0,0,0,0.3);' : ''}
      ${isMobile ? '-webkit-tap-highlight-color: transparent;' : ''}
    `;

    // ⭐ ДОБАВИТЬ: Специальные стили для разных контекстов на мобильных
    if (isMobile) {
      if (context === 'userCards') {
        // Для карточек пользователя делаем метки слева
        div.style.left = '8px';
        div.style.right = 'auto';
      } else if (context === 'pack') {
        // Для открытия паков делаем метки более заметными
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        div.style.border = `1px solid ${options.color || '#FFFFFF'}`;
      }
      
      // ⭐ УВЕЛИЧИВАЕМ ОБЛАСТЬ КАСАНИЯ
      div.addEventListener('touchstart', function() {
        this.style.opacity = '0.8';
      });
      
      div.addEventListener('touchend', function() {
        this.style.opacity = '1';
      });
    }

    if (isDeckView) {
         container.style.position = 'relative';
    } else {
         if (getComputedStyle(container).position === 'static') {
             container.style.position = 'relative';
         }
    }

    container.appendChild(div);
    
    // ⭐ ДОБАВИТЬ: Логирование для отладки
    if (isMobile) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Added mobile label "${className}" with size ${fontSize} at ${topPosition}`);
    }

  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error adding label "${className}" in context "${context}":`, error);
      // ⭐ НЕ ЛОГИРУЕМ ВЕСЬ CONTAINER НА МОБИЛЬНЫХ
      if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Container:', container);
      }
  }
};


const addExtensionSettingsButton = () => {
  try {
    const menu = document.querySelector('.dropdown__content .menu--profile');
    if (!menu || menu.querySelector('.menu__item--extension-settings')) return;
    
    // ⭐ ДОБАВИТЬ: Определение мобильного устройства
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const settingsButton = document.createElement('a');
    settingsButton.classList.add('menu__item', 'menu__item--extension-settings');
    settingsButton.target = '_blank';
    settingsButton.href = chrome.runtime.getURL('interface.html');
    
    // ⭐ АДАПТИРОВАТЬ: Размер иконки для мобильных
    const iconSize = isMobile ? '18' : '16';
    const iconMargin = isMobile ? '10px' : '8px';
    const fontSize = isMobile ? '16px' : 'inherit';
    
    settingsButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="currentColor" style="vertical-align: middle; margin-right: ${iconMargin};">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
      </svg>
      Настройки расширения`;
    
    // ⭐ ДОБАВИТЬ: Стили для мобильных
    if (isMobile) {
      settingsButton.style.fontSize = fontSize;
      settingsButton.style.padding = '12px 16px';
      settingsButton.style.minHeight = '48px';
      settingsButton.style.display = 'flex';
      settingsButton.style.alignItems = 'center';
    }
    
    menu.appendChild(settingsButton);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Added extension settings button ${isMobile ? '(mobile adapted)' : ''}`);
    
  } catch (error) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Error adding settings button:', error);
  }
};

// ⭐ ДОБАВИТЬ: Новую функцию для мобильной оптимизации
const addMobileOptimizations = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (!isMobile) return;
  
  try {
    // Предотвращаем зум при двойном тапе на метках
    document.addEventListener('touchstart', function(event) {
      if (event.target.classList.contains('wishlist-warning') || 
          event.target.classList.contains('owners-count')) {
        event.preventDefault();
      }
    }, { passive: false });
    
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)('Applied mobile touch optimizations');
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Error applying mobile optimizations:', error);
  }
};

/***/ }),

/***/ "./main.js":
/*!*****************!*\
  !*** ./main.js ***!
  \*****************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   contextState: () => (/* binding */ contextState)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _domUtils_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./domUtils.js */ "./domUtils.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./contextHandlers.js */ "./contextHandlers.js");
/* harmony import */ var _observer_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./observer.js */ "./observer.js");
/* harmony import */ var _mineHandler_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./mineHandler.js */ "./mineHandler.js");










let contextState = {};
let currentObserver = null;

// ⭐ ДОБАВИТЬ: Определение мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const cleanupExtensionFeatures = () => {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cleaning up extension features...');

    if (currentObserver) {
        currentObserver.disconnect();
        currentObserver = null;
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Observer disconnected.');
    }

    document.getElementById('auto-mine-counter')?.remove();
    document.querySelector('.wishlist-toggle-btn')?.remove();
    
    // ⭐ ОПТИМИЗАЦИЯ: Удаляем мобильные кнопки создания лота
    if (isMobile) {
        document.querySelectorAll('.mobile-create-lot-btn').forEach(btn => btn.remove());
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Removed mobile create-lot buttons.');
    }
    
    const statButtonSelectors = [
        '.tradeOffer-wishlist-btn', '.tradeOffer-owners-btn',
        '.remelt-wishlist-btn', '.remelt-owners-btn',
        '.market-wishlist-btn', '.market-owners-btn',
        '.split-wishlist-btn', '.split-owners-btn',
        '.deckCreate-wishlist-btn', '.deckCreate-owners-btn',
        '.marketCreate-wishlist-btn', '.marketCreate-owners-btn',
        '.marketRequestCreate-wishlist-btn', '.marketRequestCreate-owners-btn',
    ];
    statButtonSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(btn => btn.remove());
    });
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Removed dynamic buttons.');

    const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
    oldLabels.forEach(label => label.remove());
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Removed ${oldLabels.length} labels.`);

    _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.clear();
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cleared cached elements.');

};

const initializeObserver = (context) => {
     // ⭐ ОПТИМИЗАЦИЯ: На мобильных можно отключить observer для некоторых контекстов
     if (isMobile && ['pack', 'marketRequestView', 'minePage', 'userCards'].includes(context)) {
         (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Skipping observer for ${context} on mobile device`);
         return;
     }
     
     if (context !== 'pack' && context !== 'marketRequestView' && context !== 'minePage') {
         (0,_observer_js__WEBPACK_IMPORTED_MODULE_7__.setupObserver)(context, obs => { currentObserver = obs; });
     }
}

const initMinePage = async () => {
    const mineButtonSelector = '.main-mine__game-tap';
    const mineButton = await (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.waitForElements)(mineButtonSelector, 5000, true);
    const counterId = 'auto-mine-counter';

    if (!mineButton) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Mine button ('${mineButtonSelector}') not found after waiting.`);
        return;
    }
     if (document.getElementById(counterId)) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Mine counter ('#${counterId}') already exists.`);
        return; 
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Initializing mine page (Burst Mode)...');

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
    const hitsCount = settings.mineHitCount;

    const counterElement = document.createElement('div');
    counterElement.id = counterId;
    counterElement.textContent = `Удар x${hitsCount}`;
    counterElement.style.textAlign = 'center';
    counterElement.style.marginTop = '10px';
    counterElement.style.fontSize = '14px';
    counterElement.style.fontWeight = 'bold';
    counterElement.style.color = '#FFF';
    counterElement.style.textShadow = '1px 1px 2px black';
    counterElement.style.minHeight = '1.2em'; 
    
    // ⭐ АДАПТАЦИЯ: Увеличиваем шрифт для мобильных
    if (isMobile) {
        counterElement.style.fontSize = '16px';
        counterElement.style.marginTop = '15px';
        counterElement.style.padding = '5px';
    }

    mineButton.parentNode.insertBefore(counterElement, mineButton.nextSibling);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Mine counter element added.');

    let isMining = false;

    const updateButtonState = (disabled) => {
        mineButton.disabled = disabled;
        mineButton.style.opacity = disabled ? '0.6' : '1';
        mineButton.style.cursor = disabled ? 'wait' : 'pointer';
        isMining = disabled;
        
        // ⭐ АДАПТАЦИЯ: Увеличиваем кнопку на мобильных
        if (isMobile) {
            mineButton.style.minHeight = '60px';
            mineButton.style.fontSize = '18px';
            mineButton.style.fontWeight = 'bold';
        }
    };

    const updateCounter = (current, max, message = null) => {
        if (message) {
            counterElement.textContent = message;
        } else {
            counterElement.textContent = `Статус: ${current}/${max}`;
        }
        
        // ⭐ АДАПТАЦИЯ: Упрощаем сообщения на мобильных
        if (isMobile && message && message.length > 40) {
            counterElement.textContent = message.substring(0, 40) + '...';
        }
    };

    mineButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isMining) { 
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Mining process already running.'); 
            if (isMobile) alert('Уже добывается...');
            return; 
        }
        
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { 
            alert('Контекст расширения недействителен.'); 
            return; 
        }
        
        if (!_api_js__WEBPACK_IMPORTED_MODULE_2__.csrfToken) { 
            alert('CSRF токен не найден.'); 
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Mining start blocked: CSRF token is null or empty.'); 
            return; 
        }

        const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
        const currentHitsCount = currentSettings.mineHitCount;

        updateButtonState(true);
        updateCounter(0, currentHitsCount, `Отправка ${currentHitsCount} ударов...`);
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Starting mining burst from button click...');

        try {
            await (0,_mineHandler_js__WEBPACK_IMPORTED_MODULE_8__.startMiningProcess)(updateButtonState, updateCounter);
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('startMiningProcess (burst) finished.');
        } catch (error) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Critical error during startMiningProcess (burst) execution:', error);
            updateButtonState(false);
            updateCounter(0, currentHitsCount, '❌ Критическая ошибка');
            
            // ⭐ АДАПТАЦИЯ: Короткие алерты на мобильных
            const errorMsg = isMobile ? 
                'Ошибка добычи. См. консоль.' : 
                `Произошла критическая ошибка во время добычи: ${error.message || 'См. консоль.'}`;
            alert(errorMsg);
        }
    });

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Mine button click handler (burst mode) set.');
};

const initPage = async () => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Extension context is not valid. Aborting initialization.');
        return;
    }
    
    // ⭐ ДОБАВИТЬ: Логирование типа устройства
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Starting page initialization on ${isMobile ? 'MOBILE' : 'DESKTOP'} device...`);
    
    // ⭐ ОПТИМИЗАЦИЯ: Меньше логирования на мобильных для экономии памяти
    if (!isMobile) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('User agent:', navigator.userAgent);
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Screen size:', { width: window.innerWidth, height: window.innerHeight });
    }

    (0,_domUtils_js__WEBPACK_IMPORTED_MODULE_4__.addExtensionSettingsButton)();

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
    
    // ⭐ ОПТИМИЗАЦИЯ: Меньше деталей в логах на мобильных
    if (!isMobile) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Settings loaded in initPage:', settings);
    } else {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Settings loaded (mobile mode)');
    }

    if (!settings.extensionEnabled) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is globally disabled via settings. Initialization stopped.');
        cleanupExtensionFeatures();
        return;
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is enabled, proceeding with initialization.');
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    if (token) {
        (0,_api_js__WEBPACK_IMPORTED_MODULE_2__.setCsrfToken)(token);
    } else {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('CSRF token meta tag not found!');
    }

    const context = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__.getCurrentContext)();
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Current context detected:', context);

    if (!context) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('No specific context detected. Initialization finished.');
        return;
    }

    if (context !== 'minePage') {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Initializing context: ${context}`);
        let effectiveInitialContextState = {};
        try {
            const { userContextStates } = await chrome.storage.sync.get(['userContextStates']);
            const savedStates = userContextStates || {};
            effectiveInitialContextState = {
                ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}),
                ...(savedStates[context] || {})
            };
            contextState = { ...contextState, [context]: { ...effectiveInitialContextState } };
            
            // ⭐ ОПТИМИЗАЦИЯ: Меньше логирования состояния на мобильных
            if (!isMobile) {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Current global contextState after init:`, contextState);
            }

            try {
                 switch (context) {
                      case 'userCards': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initUserCards)(); break;
                      case 'marketCreate':
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.card-filter-form__lock-status', 'card-filter-form__lock');
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.handleMarketCreatePage)();
                          break;
                      case 'trade':
                          if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                              _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors.trade);
                              await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)('trade', settings);
                          }
                          break;
                      case 'pack': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initPackPage)(); break;
                      case 'deckView':
                         if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                            _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors.deckView);
                            await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)('deckView', settings);
                         }
                         break;
                      case 'tradeOffer': await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.trade__rank-wrapper .trade__rank', 'trade__type-card-button'); break;
                      case 'remelt':
                      case 'market':
                      case 'split':
                      case 'deckCreate':
                      case 'marketRequestCreate':
                          await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, '.card-filter-form__lock-status', 'card-filter-form__lock');
                          break;
                      case 'marketRequestView':
                         if (settings.alwaysShowWishlist || contextState[context]?.wishlist || settings.alwaysShowOwners || contextState[context]?.owners) {
                             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Processing cards for ${context}`);
                             _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context]);
                             await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings);
                         }
                         break;
                      default: (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`No specific initialization logic for context: ${context}`);
                 }
            } catch (error) { 
                // ⭐ АДАПТАЦИЯ: Короткие сообщения об ошибках на мобильных
                const errorMsg = isMobile ? 
                    `Error in ${context}: ${error.message.substring(0, 50)}` :
                    `Error during context initialization for ${context}: ${error}`;
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)(errorMsg); 
            }

            initializeObserver(context);

            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Page initialization finished for context:', context);
        } catch (storageError) {
             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Failed to load settings or userContextStates during initPage:', storageError);
             contextState = { ...contextState, [context]: { ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}) } };
             (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Initialized ${context} with default state due to storage error.`);
             if (!isMobile) {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Current global contextState after storage error:`, contextState);
             }
        }
    } else {
        // ⭐ ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ШАХТЫ
        await initMinePage();
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Initialization for context '${context}' finished (added buttons/elements).`);
    }
};

// ⭐ ОПТИМИЗАЦИЯ: Debounce initPage для мобильных чтобы избежать множественных вызовов
const debouncedInitPage = (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.debounce)(initPage, isMobile ? 500 : 100);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', debouncedInitPage);
} else {
    debouncedInitPage();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { 
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Received message, but extension context is invalid.'); 
        return false; 
    }
    
    // ⭐ ОПТИМИЗАЦИЯ: Меньше логирования сообщений на мобильных
    if (!isMobile) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Received message: ${message.action}`, message);
    }

    if (message.action === 'clearWishlistCache') {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Processing clearWishlistCache message...');
        _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.clear();
        _api_js__WEBPACK_IMPORTED_MODULE_2__.pendingRequests.clear();
        (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)().then(settings => {
            if (settings.extensionEnabled) {
                const context = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__.getCurrentContext)();
                if (context && _config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context]  && context !== 'minePage') {
                   const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
                   oldLabels.forEach(label => label.remove());
                   (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Removed ${oldLabels.length} old labels.`);
                   
                   // ⭐ ОПТИМИЗАЦИЯ: Пропускаем переобработку на мобильных если не активно
                   if (isMobile && !settings.alwaysShowWishlist && !settings.alwaysShowOwners) {
                       (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Skipping reprocessing on mobile - labels not active');
                       sendResponse({ status: 'cache_cleared_on_page', mobile_optimized: true });
                       return;
                   }
                   
                   (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Reprocessing context after cache clear...');
                   const currentState = contextState[context] || {};
                   const effectiveState = { ...(_config_js__WEBPACK_IMPORTED_MODULE_0__.initialContextState[context] || {}), ...currentState };
                   contextState = { ...contextState, [context]: effectiveState };
                   
                   if (context === 'userCards') { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initUserCards)(); }
                   else if (['tradeOffer', 'remelt', 'market', 'split', 'deckCreate', 'marketCreate', 'marketRequestCreate'].includes(context)) {
                      const buttonConfigMap = {
                         'tradeOffer': { selector: '.trade__rank-wrapper .trade__rank', class: 'trade__type-card-button' },
                         'remelt': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'market': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'split': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'deckCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'marketCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                         'marketRequestCreate': { selector: '.card-filter-form__lock-status', class: 'card-filter-form__lock' },
                      };
                      const buttonConfig = buttonConfigMap[context];
                      if (buttonConfig) { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initStatsButtons)(context, buttonConfig.selector, buttonConfig.class); }
                      else { 
                          (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Button config not found for ${context}...`); 
                          (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings); 
                      }
                   } else if (context === 'pack') { (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_6__.initPackPage)(); }
                   else if (context === 'trade' || context === 'deckView' || context === 'marketRequestView') {
                        _utils_js__WEBPACK_IMPORTED_MODULE_1__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_0__.contextsSelectors[context]);
                        (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_5__.processCards)(context, settings);
                   }
                   else { (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)(`Unhandled context ${context} in clear cache reprocessing.`); }
                } else {
                    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`No active context requiring card reprocessing after cache clear. Current context: ${context}`);
                }
            } else {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Cache cleared, but extension is globally disabled. No reprocessing needed.');
                 const oldLabels = document.querySelectorAll('.wishlist-warning, .owners-count');
                 oldLabels.forEach(label => label.remove());
            }
        }).catch(error => (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logError)('Error getting settings during cache clear:', error));
        sendResponse({ status: 'cache_cleared_on_page' });
        return true;
    } else {
          sendResponse({ status: 'unknown_action_on_page', received: message.action });
    }
    return true;
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'sync') {
        // ⭐ ОПТИМИЗАЦИЯ: Меньше логирования на мобильных
        if (!isMobile) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Detected change in sync settings:', changes);
        }
        
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.isExtensionContextValid)()) { 
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.logWarn)('Settings changed, but context invalid...'); 
            return; 
        }

        if (changes.extensionEnabled) {
            const newValue = changes.extensionEnabled.newValue;
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)(`Global enable switch changed to: ${newValue}`);
            if (newValue) {
                await initPage();
            } else {
                cleanupExtensionFeatures();
            }
        } else {
            const changedKeys = Object.keys(changes);
            const relevantKeys = ['wishlistStyle', 'wishlistWarning', 'alwaysShowWishlist', 'alwaysShowOwners', 'userContextStates', 'mineHitCount'];
            const otherSettingsChanged = changedKeys.some(key => relevantKeys.includes(key));

            if (otherSettingsChanged) {
                 (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Detected change in other relevant sync settings.');
                 const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_3__.getSettings)();
                 if (settings.extensionEnabled) {
                     (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Extension is enabled, re-initializing due to setting change.');
                     await initPage();
                 } else {
                      (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Other settings changed, but extension is disabled. No action needed.');
                 }
            }
        }
    }
});

// ⭐ ДОБАВИТЬ: Mobile-specific optimizations
if (isMobile) {
    // Предотвращаем множественные тапы
    let lastTapTime = 0;
    const tapDelay = 500; // 500ms между тапами
    
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('wishlist-toggle-btn') || 
            event.target.classList.contains('mobile-create-lot-btn') ||
            event.target.closest('.wishlist-toggle-btn') ||
            event.target.closest('.mobile-create-lot-btn')) {
            
            const currentTime = new Date().getTime();
            const timeSinceLastTap = currentTime - lastTapTime;
            
            if (timeSinceLastTap < tapDelay) {
                event.preventDefault();
                event.stopPropagation();
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Prevented rapid tap on mobile');
                return;
            }
            
            lastTapTime = currentTime;
        }
    }, true);
    
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_1__.log)('Applied mobile tap prevention');
}

/***/ }),

/***/ "./mineHandler.js":
/*!************************!*\
  !*** ./mineHandler.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   startMiningProcess: () => (/* binding */ startMiningProcess)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./api.js */ "./api.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./settings.js */ "./settings.js");


 

const MINE_HIT_URL = "https://mangabuff.ru/mine/hit";

const sendMineHitRequest = async () => {
    if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) throw new Error("Extension context lost");
    if (!_api_js__WEBPACK_IMPORTED_MODULE_1__.csrfToken) throw new Error("CSRF token is missing");
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'mineHit',
            url: MINE_HIT_URL,
            csrfToken: _api_js__WEBPACK_IMPORTED_MODULE_1__.csrfToken
        });
        if (!response) { throw new Error(`No response received...`); }
        if (!response.success) {
            const error = new Error(response.error || 'Unknown background error');
            error.status = response.status;
            error.data = response.data;
            throw error;
        }
        return response.data;
    } catch (error) {
        (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)(`Error sending message for action mineHit:`, error);
        throw error;
    }
};

const startMiningProcess = async (updateButtonStateCallback, updateCounterCallback) => {

    const settings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_2__.getSettings)();
    const hitsToSend = settings.mineHitCount; 

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`🚀 Starting mining burst of ${hitsToSend} hits...`);

    updateCounterCallback(0, hitsToSend, `Отправка ${hitsToSend} ударов...`);
    updateButtonStateCallback(true);

    const hitPromises = [];
    for (let i = 0; i < hitsToSend; i++) { 
        hitPromises.push(sendMineHitRequest());
    }

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Initiated ${hitPromises.length} hit requests.`);

    const results = await Promise.allSettled(hitPromises);
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Finished processing all ${results.length} hit requests.`);

    let successfulHits = 0;
    let firstErrorMessage = null;
    let rateLimitHit = false;

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successfulHits++;
        } else {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`❌ Hit ${index + 1} failed. Reason:`, result.reason?.message || result.reason);
            if (!firstErrorMessage) {
                firstErrorMessage = result.reason?.message || 'Неизвестная ошибка';
            }
            if (result.reason?.status === 403 || result.reason?.status === 429 || result.reason?.message?.includes('closed') || result.reason?.message?.includes('закрыта')) {
                 rateLimitHit = true;
            }
        }
    });

    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`📊 Mining burst result: ${successfulHits} successful / ${hitsToSend - successfulHits} failed.`); 

    let finalMessage = '';
    if (successfulHits === hitsToSend) { 
        finalMessage = `✔️ Успешно (${successfulHits}/${hitsToSend})`; 
    } else if (rateLimitHit) {
        finalMessage = `❌ Шахта закрыта (${successfulHits}/${hitsToSend})`; 
    } else if (successfulHits > 0) {
        finalMessage = `⚠️ Частично (${successfulHits}/${hitsToSend}). Ошибка: ${firstErrorMessage}`; 
    } else {
        finalMessage = `❌ Ошибка (${successfulHits}/${hitsToSend}): ${firstErrorMessage}`; 
    }

    updateButtonStateCallback(false);
    updateCounterCallback(successfulHits, hitsToSend, finalMessage); 
};

/***/ }),

/***/ "./observer.js":
/*!*********************!*\
  !*** ./observer.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setupObserver: () => (/* binding */ setupObserver)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./config.js */ "./config.js");
/* harmony import */ var _settings_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./settings.js */ "./settings.js");
/* harmony import */ var _cardProcessor_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./cardProcessor.js */ "./cardProcessor.js");
/* harmony import */ var _contextHandlers_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./contextHandlers.js */ "./contextHandlers.js");
/* harmony import */ var _main_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./main.js */ "./main.js");







const setupObserver = (context, observerCreatedCallback) => {
  if (!context || !_config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context]) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Not set up - invalid context or no selector defined: ${context}`);
    return;
  }

  let targetSelector;
  switch (context) {
      case 'tradeOffer': targetSelector = '.trade__inventory-list'; break;
      case 'pack': return;
      case 'deckView': targetSelector = '.deck__items'; break;
      case 'userCards': targetSelector = '.manga-cards'; break;
      case 'trade': targetSelector = '.trade__main'; break;
      case 'remelt':
      case 'market':
      case 'split':
      case 'deckCreate':
      case 'marketCreate':
      case 'marketRequestCreate': targetSelector = '.card-filter-list__items'; break;
      default:
          (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: No target selector defined for context ${context}.`);
          return;
  }

  const targetNode = document.querySelector(targetSelector);
  if (!targetNode) {
      (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Target node not found with selector: ${targetSelector} for context ${context}`);
      setTimeout(() => {
          const delayedNode = document.querySelector(targetSelector);
          if (delayedNode) {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Target node ${targetSelector} found after delay. Setting up observer.`);
              observeNode(delayedNode, context, observerCreatedCallback);
          } else {
              (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)(`Observer: Target node ${targetSelector} still not found after delay.`);
          }
      }, 1000);
      return;
  }

  observeNode(targetNode, context, observerCreatedCallback);
};

const observeNode = (targetNode, context, observerCreatedCallback) => {
    const observerCallback = (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.debounce)(async (mutations) => {
        if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logWarn)('Observer: Extension context lost, skipping mutation processing.');
            return;
        }

        let cardListChanged = false;
        const cardSelector = _config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context];

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const addedNodesMatch = Array.from(mutation.addedNodes).some(node => node.matches?.(cardSelector));
                const removedNodesMatch = Array.from(mutation.removedNodes).some(node => node.matches?.(cardSelector));

                if (addedNodesMatch || removedNodesMatch) {
                    cardListChanged = true;
                    break;
                }
                if (context === 'userCards' && (mutation.target === targetNode || mutation.target.closest(targetSelector))) {
                     if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                         cardListChanged = true;
                         break;
                     }
                }
                 if (context === 'trade' && mutation.target === targetNode) {
                     if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                         cardListChanged = true;
                         break;
                     }
                 }
            }
        }

        if (cardListChanged) {
            (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Detected card list change in context: ${context}. Reprocessing.`);
            const currentSettings = await (0,_settings_js__WEBPACK_IMPORTED_MODULE_2__.getSettings)();

            if (context === 'userCards') {
                await (0,_contextHandlers_js__WEBPACK_IMPORTED_MODULE_4__.initUserCards)();
            }

            const needsProcessing = (_main_js__WEBPACK_IMPORTED_MODULE_5__.contextState[context]?.wishlist || currentSettings.alwaysShowWishlist)
                                 || (_main_js__WEBPACK_IMPORTED_MODULE_5__.contextState[context]?.owners || currentSettings.alwaysShowOwners);

            if (needsProcessing) {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Reprocessing cards for ${context} as labels are active.`);
                _utils_js__WEBPACK_IMPORTED_MODULE_0__.cachedElements.delete(_config_js__WEBPACK_IMPORTED_MODULE_1__.contextsSelectors[context]);
                await (0,_cardProcessor_js__WEBPACK_IMPORTED_MODULE_3__.processCards)(context, currentSettings);
            } else {
                (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Card list changed, but no labels are active for context ${context}. No reprocessing needed.`);
                const oldLabels = targetNode.querySelectorAll('.wishlist-warning, .owners-count');
                oldLabels.forEach(label => label.remove());
            }
        }
    }, 750);

    const observer = new MutationObserver(observerCallback);
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
    });

    if (typeof observerCreatedCallback === 'function') {
        observerCreatedCallback(observer);
    }
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.log)(`Observer: Setup observer for context ${context} on target: ${targetSelector}`);
}

/***/ }),

/***/ "./settings.js":
/*!*********************!*\
  !*** ./settings.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSettings: () => (/* binding */ getSettings)
/* harmony export */ });
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils.js */ "./utils.js");


const defaultSettings = {
  extensionEnabled: true,
  wishlistWarning: 10,
  wishlistStyle: 'style-1',
  alwaysShowWishlist: false,
  alwaysShowOwners: false,
  mineHitCount: 100
};

const getSettings = async () => {
  if (!(0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.isExtensionContextValid)()) {
    return Promise.resolve({ ...defaultSettings });
  }
  try {
    const settings = await chrome.storage.sync.get(Object.keys(defaultSettings));
    const mergedSettings = { ...defaultSettings, ...settings };
    return mergedSettings;
  } catch (error) {
    (0,_utils_js__WEBPACK_IMPORTED_MODULE_0__.logError)('Failed to load settings from storage:', error);
    return { ...defaultSettings };
  }
};

/***/ }),

/***/ "./utils.js":
/*!******************!*\
  !*** ./utils.js ***!
  \******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cachedElements: () => (/* binding */ cachedElements),
/* harmony export */   debounce: () => (/* binding */ debounce),
/* harmony export */   getElements: () => (/* binding */ getElements),
/* harmony export */   getScreenInfo: () => (/* binding */ getScreenInfo),
/* harmony export */   isExtensionContextValid: () => (/* binding */ isExtensionContextValid),
/* harmony export */   isMobileDevice: () => (/* binding */ isMobileDevice),
/* harmony export */   isTouchDevice: () => (/* binding */ isTouchDevice),
/* harmony export */   log: () => (/* binding */ log),
/* harmony export */   logError: () => (/* binding */ logError),
/* harmony export */   logWarn: () => (/* binding */ logWarn),
/* harmony export */   measurePerformance: () => (/* binding */ measurePerformance),
/* harmony export */   optimizeForMobile: () => (/* binding */ optimizeForMobile),
/* harmony export */   safeRemove: () => (/* binding */ safeRemove),
/* harmony export */   throttle: () => (/* binding */ throttle),
/* harmony export */   waitForElements: () => (/* binding */ waitForElements)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ "./config.js");


const cachedElements = new Map();

// ⭐ ДОБАВИТЬ: Определение мобильного устройства
const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ⭐ ОПТИМИЗАЦИЯ: Адаптивное логирование для мобильных
const log = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // На мобильных логируем только важные сообщения (для экономии памяти)
    if (!isMobile || message.includes('Error') || message.includes('Warn') || 
        message.includes('Detected') || message.includes('Processing')) {
        console.log(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);
    }
};

const logWarn = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // На мобильных сокращаем сообщения
    if (isMobile && args.length > 0) {
        // Берем только первый аргумент для экономии памяти
        console.warn(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, args[0]);
    } else {
        console.warn(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);
    }
};

const logError = (message, ...args) => {
    const isMobile = isMobileDevice();
    
    // Всегда логируем ошибки, но на мобильных - кратко
    if (isMobile) {
        // Сокращаем длинные сообщения об ошибках
        const shortMessage = message.length > 100 ? message.substring(0, 100) + '...' : message;
        
        // Логируем только первые 2 аргумента
        const limitedArgs = args.slice(0, 2);
        console.error(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${shortMessage}`, ...limitedArgs);
    } else {
        console.error(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${message}`, ...args);
    }
};

const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime.id;
  } catch (e) {
    const isMobile = isMobileDevice();
    const errorMsg = isMobile ? 'Extension context invalidated' : `Extension context invalidated: ${e}`;
    logError(errorMsg);
    return false;
  }
};

const getElements = (selector) => {
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

const debounce = (func, wait) => {
  let timeout;
  const isMobile = isMobileDevice();
  
  // ⭐ ОПТИМИЗАЦИЯ: На мобильных увеличиваем задержку по умолчанию
  const effectiveWait = isMobile ? Math.max(wait, 300) : wait;
  
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(undefined, args), effectiveWait);
  };
};

const waitForElements = (selector, timeout, single = false) => {
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
const getScreenInfo = () => {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: isMobileDevice(),
        pixelRatio: window.devicePixelRatio || 1,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
};

const isTouchDevice = () => {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
};

const optimizeForMobile = (element) => {
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

const throttle = (func, limit) => {
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
const safeRemove = (element) => {
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
const measurePerformance = (name, func) => {
    if (!isMobileDevice()) {
        // На десктопе - полное измерение
        console.time(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${name}`);
        const result = func();
        console.timeEnd(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.LOG_PREFIX} ${name}`);
        return result;
    } else {
        // На мобильных - просто выполняем (измерения тратят ресурсы)
        return func();
    }
};

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./main.js");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUNBLGdEQUFnRCxhQUFhO1dBQzdEOzs7OztVRU5BO1VBQ0E7VUFDQTtVQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL2FwaS5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vY2FyZFByb2Nlc3Nvci5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vY29uZmlnLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9jb250ZXh0SGFuZGxlcnMuanMiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL2RvbVV0aWxzLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9tYWluLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi9taW5lSGFuZGxlci5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uLy4vb2JzZXJ2ZXIuanMiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi8uL3NldHRpbmdzLmpzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vLi91dGlscy5qcyIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9tYW5nYWJ1ZmYtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vbWFuZ2FidWZmLWV4dGVuc2lvbi93ZWJwYWNrL2JlZm9yZS1zdGFydHVwIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vd2VicGFjay9zdGFydHVwIiwid2VicGFjazovL21hbmdhYnVmZi1leHRlbnNpb24vd2VicGFjay9hZnRlci1zdGFydHVwIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGFwaS5qcyAo0KEg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQldCZINCf0J4g0J/QkNCT0JjQndCQ0KbQmNCYKVxyXG5pbXBvcnQgeyBpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCwgbG9nLCBsb2dXYXJuLCBsb2dFcnJvciB9IGZyb20gJy4vdXRpbHMuanMnO1xyXG5pbXBvcnQgeyBNQVhfQ09OQ1VSUkVOVF9SRVFVRVNUUyB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBwZW5kaW5nUmVxdWVzdHMgPSBuZXcgTWFwKCk7XHJcbmV4cG9ydCBsZXQgYWN0aXZlUmVxdWVzdHMgPSAwO1xyXG5leHBvcnQgbGV0IGNzcmZUb2tlbiA9IG51bGw7XHJcblxyXG5leHBvcnQgY29uc3Qgc2V0Q3NyZlRva2VuID0gKHRva2VuKSA9PiB7XHJcbiAgICBjc3JmVG9rZW4gPSB0b2tlbjtcclxufVxyXG5cclxuY29uc3QgZ2V0TGFzdFBhZ2VOdW1iZXIgPSAoZG9jKSA9PiB7XHJcbiAgICBjb25zdCBwYWdpbmF0aW9uQnV0dG9ucyA9IGRvYy5xdWVyeVNlbGVjdG9yQWxsKCd1bC5wYWdpbmF0aW9uIGxpLnBhZ2luYXRpb25fX2J1dHRvbiBhW2hyZWYqPVwicGFnZT1cIl0nKTtcclxuICAgIGxldCBtYXhQYWdlID0gMTtcclxuICAgIHBhZ2luYXRpb25CdXR0b25zLmZvckVhY2gobGluayA9PiB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKTtcclxuICAgICAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvcGFnZT0oXFxkKykvKTtcclxuICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcclxuICAgICAgICAgICAgY29uc3QgcGFnZU51bSA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XHJcbiAgICAgICAgICAgIGlmICghaXNOYU4ocGFnZU51bSkgJiYgcGFnZU51bSA+IG1heFBhZ2UpIHtcclxuICAgICAgICAgICAgICAgIG1heFBhZ2UgPSBwYWdlTnVtO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbWF4UGFnZTtcclxufTtcclxuXHJcbmNvbnN0IGNvdW50SXRlbXNPblBhZ2UgPSAoZG9jLCB0eXBlKSA9PiB7XHJcbiAgICBjb25zdCBzZWxlY3RvciA9IHR5cGUgPT09ICd3aXNobGlzdCcgPyAnLnByb2ZpbGVfX2ZyaWVuZHMtaXRlbScgOiAnLmNhcmQtc2hvd19fb3duZXInO1xyXG4gICAgcmV0dXJuIGRvYy5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKS5sZW5ndGg7XHJcbn07XHJcblxyXG5jb25zdCBnZXRVc2VyQ291bnQgPSBhc3luYyAodHlwZSwgY2FyZElkLCByZXRyaWVzID0gMikgPT4ge1xyXG4gIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgcmV0dXJuIDA7XHJcblxyXG4gIGNvbnN0IGNhY2hlS2V5ID0gYCR7dHlwZX1fJHtjYXJkSWR9YDtcclxuICBpZiAoIWNzcmZUb2tlbikge1xyXG4gICAgICBjc3JmVG9rZW4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJjc3JmLXRva2VuXCJdJyk/LmdldEF0dHJpYnV0ZSgnY29udGVudCcpIHx8ICcnO1xyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGNhY2hlZCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbY2FjaGVLZXldKS50aGVuKHIgPT4gcltjYWNoZUtleV0pO1xyXG4gICAgaWYgKGNhY2hlZCAmJiBEYXRlLm5vdygpIC0gY2FjaGVkLnRpbWVzdGFtcCA8IDI0ICogNjAgKiA2MCAqIDEwMDApIHtcclxuICAgICAgcmV0dXJuIGNhY2hlZC5jb3VudDtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBsb2dFcnJvcihgRXJyb3IgYWNjZXNzaW5nIGxvY2FsIHN0b3JhZ2UgZm9yIGNhY2hlIGtleSAke2NhY2hlS2V5fTpgLCBlcnJvcik7XHJcbiAgfVxyXG5cclxuICBpZiAocGVuZGluZ1JlcXVlc3RzLmhhcyhjYWNoZUtleSkpIHtcclxuICAgIHJldHVybiBwZW5kaW5nUmVxdWVzdHMuZ2V0KGNhY2hlS2V5KTtcclxuICB9XHJcblxyXG4gIGxvZyhgR2V0dGluZyBPUFRJTUlaRUQgJHt0eXBlfSBjb3VudCBmb3IgY2FyZCAke2NhcmRJZH1gKTtcclxuICBjb25zdCByZXF1ZXN0UHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XHJcbiAgICB3aGlsZSAoYWN0aXZlUmVxdWVzdHMgPj0gTUFYX0NPTkNVUlJFTlRfUkVRVUVTVFMpIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgNTAwMDApKTtcclxuICAgIH1cclxuICAgIGFjdGl2ZVJlcXVlc3RzKys7XHJcblxyXG4gICAgbGV0IHRvdGFsID0gMDsgXHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHRocm93IG5ldyBFcnJvcignRXh0ZW5zaW9uIGNvbnRleHQgbG9zdCBiZWZvcmUgZmlyc3QgcGFnZSBmZXRjaCcpO1xyXG5cclxuICAgICAgICBsZXQgcmVzcG9uc2VQYWdlMSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICAgICAgYWN0aW9uOiBgZmV0Y2gke3R5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0eXBlLnNsaWNlKDEpfUNvdW50YCxcclxuICAgICAgICAgICAgY2FyZElkLFxyXG4gICAgICAgICAgICBwYWdlOiAxLCBcclxuICAgICAgICAgICAgY3NyZlRva2VuXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmICghcmVzcG9uc2VQYWdlMSB8fCAhcmVzcG9uc2VQYWdlMS5zdWNjZXNzIHx8ICFyZXNwb25zZVBhZ2UxLnRleHQpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlUGFnZTE/LmVycm9yPy5pbmNsdWRlcygnNDA0JykpIHtcclxuICAgICAgICAgICAgICAgICBsb2coYENhcmQgJHtjYXJkSWR9IG5vdCBmb3VuZCBmb3IgJHt0eXBlfSAoNDA0IG9uIHBhZ2UgMSkuIENvdW50IGlzIDAuYCk7XHJcbiAgICAgICAgICAgICAgICAgdG90YWwgPSAwO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbG9nV2FybihgRmFpbGVkIHRvIGZldGNoIHBhZ2UgMSBmb3IgJHt0eXBlfSBjb3VudCwgY2FyZCAke2NhcmRJZH06YCwgcmVzcG9uc2VQYWdlMT8uZXJyb3IgfHwgJ05vIHJlc3BvbnNlIG9yIHRleHQnKTtcclxuICAgICAgICAgICAgICAgICBpZiAocmV0cmllcyA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgbG9nV2FybihgUmV0cnlpbmcgZmV0Y2ggZm9yIGNhcmQgJHtjYXJkSWR9IChwYWdlIDEpLCByZXRyaWVzIGxlZnQ6ICR7cmV0cmllcyAtIDF9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZVJlcXVlc3RzLS07XHJcbiAgICAgICAgICAgICAgICAgICAgIHBlbmRpbmdSZXF1ZXN0cy5kZWxldGUoY2FjaGVLZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0VXNlckNvdW50KHR5cGUsIGNhcmRJZCwgcmV0cmllcyAtIDEpOyBcclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggcGFnZSAxIGFmdGVyIHJldHJpZXMgZm9yIGNhcmQgJHtjYXJkSWR9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBkb2NQYWdlMSA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcocmVzcG9uc2VQYWdlMS50ZXh0LCAndGV4dC9odG1sJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvdW50UGVyUGFnZSA9IGNvdW50SXRlbXNPblBhZ2UoZG9jUGFnZTEsIHR5cGUpO1xyXG4gICAgICAgICAgICBjb25zdCBsYXN0UGFnZU51bSA9IGdldExhc3RQYWdlTnVtYmVyKGRvY1BhZ2UxKTtcclxuICAgICAgICAgICAgbG9nKGBQYWdlIDEgZmV0Y2hlZDogY291bnRQZXJQYWdlPSR7Y291bnRQZXJQYWdlfSwgbGFzdFBhZ2VOdW09JHtsYXN0UGFnZU51bX1gKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChsYXN0UGFnZU51bSA8PSAxKSB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbCA9IGNvdW50UGVyUGFnZTtcclxuICAgICAgICAgICAgICAgIGxvZyhgT25seSBvbmUgcGFnZSBmb3VuZC4gVG90YWwgJHt0eXBlfSBjb3VudDogJHt0b3RhbH1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgdGhyb3cgbmV3IEVycm9yKCdFeHRlbnNpb24gY29udGV4dCBsb3N0IGJlZm9yZSBsYXN0IHBhZ2UgZmV0Y2gnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgbG9nKGBGZXRjaGluZyBsYXN0IHBhZ2UgKCR7bGFzdFBhZ2VOdW19KSBmb3IgY2FyZCAke2NhcmRJZH1gKTtcclxuICAgICAgICAgICAgICAgICBsZXQgcmVzcG9uc2VMYXN0UGFnZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiBgZmV0Y2gke3R5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0eXBlLnNsaWNlKDEpfUNvdW50YCxcclxuICAgICAgICAgICAgICAgICAgICAgY2FyZElkLFxyXG4gICAgICAgICAgICAgICAgICAgICBwYWdlOiBsYXN0UGFnZU51bSwgXHJcbiAgICAgICAgICAgICAgICAgICAgIGNzcmZUb2tlblxyXG4gICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICBpZiAoIXJlc3BvbnNlTGFzdFBhZ2UgfHwgIXJlc3BvbnNlTGFzdFBhZ2Uuc3VjY2VzcyB8fCAhcmVzcG9uc2VMYXN0UGFnZS50ZXh0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGxvZ1dhcm4oYEZhaWxlZCB0byBmZXRjaCBsYXN0IHBhZ2UgKCR7bGFzdFBhZ2VOdW19KSBmb3IgJHt0eXBlfSBjb3VudCwgY2FyZCAke2NhcmRJZH06YCwgcmVzcG9uc2VMYXN0UGFnZT8uZXJyb3IgfHwgJ05vIHJlc3BvbnNlIG9yIHRleHQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgIHRvdGFsID0gMDsgXHJcbiAgICAgICAgICAgICAgICAgICAgICBsb2dXYXJuKGBDb3VsZCBub3QgY2FsY3VsYXRlIHRvdGFsIGNvdW50IGFjY3VyYXRlbHkgZHVlIHRvIGxhc3QgcGFnZSBmZXRjaCBlcnJvci5gKTtcclxuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICBjb25zdCBkb2NMYXN0UGFnZSA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcocmVzcG9uc2VMYXN0UGFnZS50ZXh0LCAndGV4dC9odG1sJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvdW50T25MYXN0UGFnZSA9IGNvdW50SXRlbXNPblBhZ2UoZG9jTGFzdFBhZ2UsIHR5cGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICBsb2coYExhc3QgcGFnZSAoJHtsYXN0UGFnZU51bX0pIGZldGNoZWQ6IGNvdW50T25MYXN0UGFnZT0ke2NvdW50T25MYXN0UGFnZX1gKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgIHRvdGFsID0gKGNvdW50UGVyUGFnZSAqIChsYXN0UGFnZU51bSAtIDEpKSArIGNvdW50T25MYXN0UGFnZTtcclxuICAgICAgICAgICAgICAgICAgICAgbG9nKGBDYWxjdWxhdGVkIHRvdGFsICR7dHlwZX0gY291bnQ6ICgke2NvdW50UGVyUGFnZX0gKiAke2xhc3RQYWdlTnVtIC0gMX0pICsgJHtjb3VudE9uTGFzdFBhZ2V9ID0gJHt0b3RhbH1gKTtcclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICBpZiAoaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSAmJiB0b3RhbCA+PSAwKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBbY2FjaGVLZXldOiB7IGNvdW50OiB0b3RhbCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0gfSk7XHJcbiAgICAgICAgICAgIGxvZyhgRmV0Y2hlZCAoT3B0aW1pemVkKSBhbmQgY2FjaGVkICR7dHlwZX0gY291bnQgZm9yIGNhcmQgJHtjYXJkSWR9OiAke3RvdGFsfWApO1xyXG4gICAgICAgICAgfSBjYXRjaCAoc3RvcmFnZUVycm9yKSB7XHJcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzZXR0aW5nIGxvY2FsIHN0b3JhZ2UgZm9yIGNhY2hlIGtleSAke2NhY2hlS2V5fTpgLCBzdG9yYWdlRXJyb3IpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKHRvdGFsIDwgMCkge1xyXG4gICAgICAgICAgbG9nV2FybihgRmV0Y2ggcmVzdWx0ZWQgaW4gaW52YWxpZCBjb3VudCAoJHt0b3RhbH0pIGZvciAke3R5cGV9LCBjYXJkICR7Y2FyZElkfS4gTm90IGNhY2hpbmcuYCk7XHJcbiAgICAgICAgICB0b3RhbCA9IDA7IFxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0b3RhbDsgXHJcblxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBsb2dFcnJvcihgVW5oYW5kbGVkIGVycm9yIGR1cmluZyBPUFRJTUlaRUQgJHt0eXBlfSBjb3VudCBmZXRjaCBmb3IgY2FyZCAke2NhcmRJZH06YCwgZXJyb3IpO1xyXG4gICAgICAgIGlmIChyZXRyaWVzID4gMCAmJiBlcnJvci5tZXNzYWdlICE9PSAnRXh0ZW5zaW9uIGNvbnRleHQgbG9zdCBiZWZvcmUgZmlyc3QgcGFnZSBmZXRjaCcgJiYgZXJyb3IubWVzc2FnZSAhPT0gJ0V4dGVuc2lvbiBjb250ZXh0IGxvc3QgYmVmb3JlIGxhc3QgcGFnZSBmZXRjaCcpIHtcclxuICAgICAgICAgICAgbG9nV2FybihgUmV0cnlpbmcgZW50aXJlIG9wdGltaXplZCBmZXRjaCBmb3IgY2FyZCAke2NhcmRJZH0gZHVlIHRvIGVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgICAgIGFjdGl2ZVJlcXVlc3RzLS07XHJcbiAgICAgICAgICAgIHBlbmRpbmdSZXF1ZXN0cy5kZWxldGUoY2FjaGVLZXkpO1xyXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0VXNlckNvdW50KHR5cGUsIGNhcmRJZCwgcmV0cmllcyAtIDEpOyBcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIDA7IFxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgYWN0aXZlUmVxdWVzdHMtLTtcclxuICAgICAgcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShjYWNoZUtleSk7XHJcbiAgICB9XHJcbiAgfSkoKTtcclxuXHJcbiAgcGVuZGluZ1JlcXVlc3RzLnNldChjYWNoZUtleSwgcmVxdWVzdFByb21pc2UpO1xyXG4gIHJldHVybiByZXF1ZXN0UHJvbWlzZTtcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBnZXRXaXNobGlzdENvdW50ID0gY2FyZElkID0+IGdldFVzZXJDb3VudCgnd2lzaGxpc3QnLCBjYXJkSWQpO1xyXG5leHBvcnQgY29uc3QgZ2V0T3duZXJzQ291bnQgPSBjYXJkSWQgPT4gZ2V0VXNlckNvdW50KCdvd25lcnMnLCBjYXJkSWQpOyIsIi8vIGNhcmRQcm9jZXNzb3IuanMgKNCQ0JTQkNCf0KLQmNCg0J7QktCQ0J3QndCr0Jkg0JTQm9CvINCc0J7QkdCY0JvQrNCd0KvQpSlcclxuaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGdldEVsZW1lbnRzLCBsb2csIGxvZ1dhcm4sIGxvZ0Vycm9yIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7IGdldFdpc2hsaXN0Q291bnQsIGdldE93bmVyc0NvdW50IH0gZnJvbSAnLi9hcGkuanMnO1xyXG5pbXBvcnQgeyBhZGRUZXh0TGFiZWwgfSBmcm9tICcuL2RvbVV0aWxzLmpzJztcclxuaW1wb3J0IHsgY29udGV4dHNTZWxlY3RvcnMsIGdldEJhdGNoU2l6ZSwgZ2V0QmF0Y2hEZWxheSwgZ2V0T3B0aW1pemVkU2V0dGluZ3MsIGlzTW9iaWxlRGV2aWNlIH0gZnJvbSAnLi9jb25maWcuanMnO1xyXG5pbXBvcnQgeyBjb250ZXh0U3RhdGUgfSBmcm9tICcuL21haW4uanMnOyBcclxuXHJcbi8vINCe0LHRgNCw0LHQvtGC0LrQsCDQutCw0YDRglxyXG5leHBvcnQgY29uc3QgcHJvY2Vzc0NhcmRzID0gYXN5bmMgKGNvbnRleHQsIHNldHRpbmdzKSA9PiB7IFxyXG4gIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkge1xyXG4gICAgbG9nV2FybigncHJvY2Vzc0NhcmRzOiBFeHRlbnNpb24gY29udGV4dCBpbnZhbGlkLCBza2lwcGluZycpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgc2VsZWN0b3IgPSBjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XTtcclxuICBpZiAoIXNlbGVjdG9yKSB7XHJcbiAgICBsb2dXYXJuKGBObyBzZWxlY3RvciBkZWZpbmVkIGZvciBjb250ZXh0OiAke2NvbnRleHR9YCk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhzZWxlY3Rvcik7XHJcbiAgaWYgKCFjYXJkSXRlbXMubGVuZ3RoKSB7XHJcbiAgICBsb2coYE5vIGNhcmRzIGZvdW5kIGZvciBzZWxlY3RvcjogJHtzZWxlY3Rvcn1gKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8vIOKtkCDQkNCU0JDQn9Ci0JjQktCd0KvQmSDQoNCQ0JfQnNCV0KAg0J/QkNCa0JXQotCQXHJcbiAgY29uc3QgQkFUQ0hfU0laRSA9IGdldEJhdGNoU2l6ZSgpO1xyXG4gIGNvbnN0IG9wdGltaXplZFNldHRpbmdzID0gZ2V0T3B0aW1pemVkU2V0dGluZ3MoKTtcclxuICBjb25zdCBpc01vYmlsZSA9IGlzTW9iaWxlRGV2aWNlKCk7XHJcbiAgXHJcbiAgbG9nKGBQcm9jZXNzaW5nICR7Y2FyZEl0ZW1zLmxlbmd0aH0gY2FyZHMgaW4gY29udGV4dCBcIiR7Y29udGV4dH1cIiAoYmF0Y2ggc2l6ZTogJHtCQVRDSF9TSVpFfSwgZGV2aWNlOiAke2lzTW9iaWxlID8gJ21vYmlsZScgOiAnZGVza3RvcCd9KWApO1xyXG5cclxuICAvLyDirZAg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQryDQlNCb0K8g0JzQntCR0JjQm9Cs0J3Qq9ClOiDQvNC10L3RjNGI0LUg0L/QsNGA0LDQu9C70LXQu9GM0L3Ri9GFINC30LDQv9GA0L7RgdC+0LJcclxuICBsZXQgcHJvY2Vzc2VkQ291bnQgPSAwO1xyXG4gIGNvbnN0IHRvdGFsQ2FyZHMgPSBjYXJkSXRlbXMubGVuZ3RoO1xyXG5cclxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcmRJdGVtcy5sZW5ndGg7IGkgKz0gQkFUQ0hfU0laRSkge1xyXG4gICAgY29uc3QgYmF0Y2ggPSBjYXJkSXRlbXMuc2xpY2UoaSwgaSArIEJBVENIX1NJWkUpO1xyXG4gICAgXHJcbiAgICAvLyDirZAg0JvQntCT0JjQoNCe0JLQkNCd0JjQlSDQn9Cg0J7Qk9Cg0JXQodCh0JAg0JTQm9CvINCc0J7QkdCY0JvQrNCd0KvQpVxyXG4gICAgaWYgKGlzTW9iaWxlICYmIHByb2Nlc3NlZENvdW50ICUgNSA9PT0gMCkge1xyXG4gICAgICBsb2coYE1vYmlsZSBwcm9ncmVzczogJHtwcm9jZXNzZWRDb3VudH0vJHt0b3RhbENhcmRzfSBjYXJkcyBwcm9jZXNzZWRgKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgcHJvbWlzZXMgPSBiYXRjaC5tYXAoYXN5bmMgKGl0ZW0pID0+IHtcclxuICAgICAgbGV0IGNhcmRJZCA9IG51bGw7XHJcbiAgICAgIHRyeSB7IFxyXG4gICAgICAgIC8vIOKtkCDQo9Cd0JjQktCV0KDQodCQ0JvQrNCd0J7QlSDQn9Ce0JvQo9Cn0JXQndCY0JUgSUQg0KEg0J/QoNCY0J7QoNCY0KLQldCi0J7QnCDQlNCb0K8g0JzQntCR0JjQm9Cs0J3Qq9ClXHJcbiAgICAgICAgaWYgKGNvbnRleHQgPT09ICd0cmFkZScpIHtcclxuICAgICAgICAgIGNhcmRJZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdocmVmJyk/Lm1hdGNoKC9cXC9jYXJkc1xcLyhcXGQrKS8pPy5bMV07XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSAndHJhZGVPZmZlcicpIHtcclxuICAgICAgICAgIGNhcmRJZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLWNhcmQtaWQnKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQgPT09ICdwYWNrJykge1xyXG4gICAgICAgICAgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcclxuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQgPT09ICdkZWNrVmlldycpIHtcclxuICAgICAgICAgIGNhcmRJZCA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLWNhcmQtaWQnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8g0J/RgNC+0LHRg9C10Lwg0YDQsNC30L3Ri9C1INCw0YLRgNC40LHRg9GC0Ysg0LTQu9GPINC80L7QsdC40LvRjNC90L7QuSDRgdC+0LLQvNC10YHRgtC40LzQvtGB0YLQuFxyXG4gICAgICAgICAgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2FyZC1pZCcpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgaXRlbS5nZXRBdHRyaWJ1dGUoJ2lkJyk/LnJlcGxhY2UoJ2NhcmQtJywgJycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCFjYXJkSWQpIHsgXHJcbiAgICAgICAgICAvLyDirZAg0JTQntCf0J7Qm9Cd0JjQotCV0JvQrNCd0KvQlSDQn9Ce0J/Qq9Ci0JrQmCDQlNCb0K8g0JzQntCR0JjQm9Cs0J3Qq9ClXHJcbiAgICAgICAgICBpZiAoaXNNb2JpbGUpIHtcclxuICAgICAgICAgICAgLy8g0J/RgNC+0LHRg9C10Lwg0L3QsNC50YLQuCBJRCDQsiDQtNC+0YfQtdGA0L3QuNGFINGN0LvQtdC80LXQvdGC0LDRhVxyXG4gICAgICAgICAgICBjb25zdCBpZEVsZW1lbnQgPSBpdGVtLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWNhcmQtaWRdLCBbZGF0YS1pZF0nKTtcclxuICAgICAgICAgICAgaWYgKGlkRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgIGNhcmRJZCA9IGlkRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2FyZC1pZCcpIHx8IGlkRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhcmQgSUQgbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChpZEVycm9yKSB7XHJcbiAgICAgICAgbG9nV2FybihgU2tpcHBpbmcgaXRlbSBpbiAke2NvbnRleHR9IGR1ZSB0byBJRCBlcnJvcjpgLCBpZEVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICAgIC8vIOKtkCDQndCVINCb0J7Qk9CY0KDQo9CV0Jwg0JLQldCh0KwgSFRNTCDQndCQINCc0J7QkdCY0JvQrNCd0KvQpSDQlNCb0K8g0K3QmtCe0J3QntCc0JjQmCDQn9CQ0JzQr9Ci0JhcclxuICAgICAgICBpZiAoIWlzTW9iaWxlKSB7XHJcbiAgICAgICAgICBsb2dXYXJuKCdJdGVtIEhUTUw6JywgaXRlbS5vdXRlckhUTUwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHNob3dXaXNobGlzdCA9IHNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lndpc2hsaXN0O1xyXG4gICAgICBjb25zdCBzaG93T3duZXJzID0gc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycyB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lm93bmVycztcclxuXHJcbiAgICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQo9C00LDQu9GP0LXQvCDRgtC+0LvRjNC60L4g0LXRgdC70Lgg0L3Rg9C20L3QviDQv9C+0LrQsNC30YvQstCw0YLRjFxyXG4gICAgICBpZiAoc2hvd1dpc2hsaXN0IHx8IHNob3dPd25lcnMpIHtcclxuICAgICAgICBpdGVtLnF1ZXJ5U2VsZWN0b3IoJy53aXNobGlzdC13YXJuaW5nJyk/LnJlbW92ZSgpO1xyXG4gICAgICAgIGl0ZW0ucXVlcnlTZWxlY3RvcignLm93bmVycy1jb3VudCcpPy5yZW1vdmUoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgdGFza3MgPSBbXTtcclxuXHJcbiAgICAgIGlmIChzaG93V2lzaGxpc3QpIHtcclxuICAgICAgICB0YXNrcy5wdXNoKFxyXG4gICAgICAgICAgZ2V0V2lzaGxpc3RDb3VudChjYXJkSWQpLnRoZW4oY291bnQgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIWl0ZW0uaXNDb25uZWN0ZWQpIHtcclxuICAgICAgICAgICAgICBsb2dXYXJuKGBDYXJkICR7Y2FyZElkfSBkaXNjb25uZWN0ZWQsIHNraXBwaW5nIGxhYmVsYCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyDirZAg0JDQlNCQ0J/QotCY0JLQndCe0JUg0J/QntCX0JjQptCY0J7QndCY0KDQntCS0JDQndCY0JUg0JTQm9CvINCc0J7QkdCY0JvQrNCd0KvQpVxyXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSAndG9wJztcclxuICAgICAgICAgICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgICAgICAgICAgLy8g0J3QsCDQvNC+0LHQuNC70YzQvdGL0YUg0LjRgdC/0L7Qu9GM0LfRg9C10Lwg0YDQsNC30L3Ri9C1INC/0L7Qt9C40YbQuNC4INC00LvRjyDQu9GD0YfRiNC10Lkg0LLQuNC00LjQvNC+0YHRgtC4XHJcbiAgICAgICAgICAgICAgaWYgKGNvbnRleHQgPT09ICd1c2VyQ2FyZHMnKSB7XHJcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiA9ICd0b3AnO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2hvd093bmVycykge1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAndG9wJztcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAndG9wLXJpZ2h0JztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgcG9zaXRpb24gPSAoc2hvd093bmVycyAmJiBjb250ZXh0ICE9PSAndXNlckNhcmRzJykgPyAndG9wJyA6ICd0b3AnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyDirZAg0JDQlNCQ0J/QotCY0JLQndCr0Jkg0KbQktCV0KIg0JTQm9CvINCc0J7QkdCY0JvQrNCd0KvQpSAo0LvRg9GH0YjQsNGPINC60L7QvdGC0YDQsNGB0YLQvdC+0YHRgtGMKVxyXG4gICAgICAgICAgICBjb25zdCBjb2xvck9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgICAgY29sb3I6IGNvdW50ID49IHNldHRpbmdzLndpc2hsaXN0V2FybmluZyA/IFxyXG4gICAgICAgICAgICAgICAgKGlzTW9iaWxlID8gJyNGRjhDMDAnIDogJyNGRkE1MDAnKSA6IC8vINCR0L7Qu9C10LUg0Y/RgNC60LjQuSDQvtGA0LDQvdC20LXQstGL0Lkg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICAgICAgICAgICAgKGlzTW9iaWxlID8gJyMzMkNEMzInIDogJyMwMEZGMDAnKSAgIC8vINCR0L7Qu9C10LUg0Y/RgNC60LjQuSDQt9C10LvQtdC90YvQuSDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhZGRUZXh0TGFiZWwoaXRlbSwgJ3dpc2hsaXN0LXdhcm5pbmcnLCBgJHtjb3VudH1gLCBg0KXQvtGC0Y/RgjogJHtjb3VudH1gLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24sICd3aXNobGlzdCcsIGNvbG9yT3B0aW9ucywgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgICAgICAvLyDirZAg0JHQntCb0JXQlSDQmtCe0KDQntCi0JrQmNCVINCh0J7QntCR0KnQldCd0JjQryDQntCRINCe0KjQmNCR0JrQkNClINCU0JvQryDQnNCe0JHQmNCb0KzQndCr0KVcclxuICAgICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBpc01vYmlsZSA/IFxyXG4gICAgICAgICAgICAgIGBXaXNobGlzdCBlcnJvciBmb3IgY2FyZCAke2NhcmRJZH06ICR7ZXJyb3IubWVzc2FnZX1gIDpcclxuICAgICAgICAgICAgICBgRXJyb3IgZ2V0dGluZyB3aXNobGlzdCBjb3VudCBmb3IgY2FyZCAke2NhcmRJZH0gaW4gJHtjb250ZXh0fTogJHtlcnJvcn1gO1xyXG4gICAgICAgICAgICBsb2dFcnJvcihlcnJvck1zZyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChzaG93T3duZXJzKSB7XHJcbiAgICAgICAgdGFza3MucHVzaChcclxuICAgICAgICAgIGdldE93bmVyc0NvdW50KGNhcmRJZCkudGhlbihjb3VudCA9PiB7XHJcbiAgICAgICAgICAgIGlmICghaXRlbS5pc0Nvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICAgIGxvZ1dhcm4oYENhcmQgJHtjYXJkSWR9IGRpc2Nvbm5lY3RlZCwgc2tpcHBpbmcgbGFiZWxgKTtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIOKtkCDQkNCU0JDQn9Ci0JjQktCd0J7QlSDQn9Ce0JfQmNCm0JjQntCd0JjQoNCe0JLQkNCd0JjQlVxyXG4gICAgICAgICAgICBsZXQgcG9zaXRpb24gPSBzaG93V2lzaGxpc3QgPyAnbWlkZGxlJyA6ICd0b3AnO1xyXG4gICAgICAgICAgICBpZiAoaXNNb2JpbGUpIHtcclxuICAgICAgICAgICAgICAvLyDQndCwINC80L7QsdC40LvRjNC90YvRhSDQuNGB0L/QvtC70YzQt9GD0LXQvCDRhNC40LrRgdC40YDQvtCy0LDQvdC90YvQtSDQv9C+0LfQuNGG0LjQuFxyXG4gICAgICAgICAgICAgIGlmIChjb250ZXh0ID09PSAndXNlckNhcmRzJykge1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAnYm90dG9tJztcclxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNob3dXaXNobGlzdCkge1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAnYm90dG9tJztcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcG9zaXRpb24gPSAndG9wJztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGFkZFRleHRMYWJlbChpdGVtLCAnb3duZXJzLWNvdW50JywgYCR7Y291bnR9YCwgYNCS0LvQsNC00LXRjtGCOiAke2NvdW50fWAsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiwgJ293bmVycycsIHt9LCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gaXNNb2JpbGUgPyBcclxuICAgICAgICAgICAgICBgT3duZXJzIGVycm9yIGZvciBjYXJkICR7Y2FyZElkfTogJHtlcnJvci5tZXNzYWdlfWAgOlxyXG4gICAgICAgICAgICAgIGBFcnJvciBnZXR0aW5nIG93bmVycyBjb3VudCBmb3IgY2FyZCAke2NhcmRJZH0gaW4gJHtjb250ZXh0fTogJHtlcnJvcn1gO1xyXG4gICAgICAgICAgICBsb2dFcnJvcihlcnJvck1zZyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQntCx0YDQsNCx0LDRgtGL0LLQsNC10Lwg0LfQsNC00LDRh9C4INC/0L7RgdC70LXQtNC+0LLQsNGC0LXQu9GM0L3QviDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICBpZiAoaXNNb2JpbGUgJiYgdGFza3MubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIC8vINCd0LAg0LzQvtCx0LjQu9GM0L3Ri9GFINCy0YvQv9C+0LvQvdGP0LXQvCDQv9C+0YHQu9C10LTQvtCy0LDRgtC10LvRjNC90L4g0LTQu9GPINGN0LrQvtC90L7QvNC40Lgg0YDQtdGB0YPRgNGB0L7QslxyXG4gICAgICAgIGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgdGFzaztcclxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIC8vINCj0LbQtSDQvtCx0YDQsNCx0L7RgtCw0L3QviDQsiDQv9GA0L7QvNC40YHQsNGFXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKHRhc2tzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAvLyDQndCwINC00LXRgdC60YLQvtC/0LUgLSDQv9Cw0YDQsNC70LvQtdC70YzQvdC+XHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodGFza3MpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBwcm9jZXNzZWRDb3VudCsrO1xyXG4gICAgICBcclxuICAgIH0pOyBcclxuXHJcbiAgICAvLyDirZAg0J7QltCY0JTQkNCV0Jwg0JLQq9Cf0J7Qm9Cd0JXQndCY0K8g0J/QkNCa0JXQotCQINChINCQ0JTQkNCf0KLQmNCS0J3QntCZINCX0JDQlNCV0KDQltCa0J7QmVxyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gICAgfSBjYXRjaCAoYmF0Y2hFcnJvcikge1xyXG4gICAgICBsb2dFcnJvcihgQmF0Y2ggJHtpL0JBVENIX1NJWkUgKyAxfSBmYWlsZWQ6YCwgYmF0Y2hFcnJvcik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8g4q2QINCQ0JTQkNCf0KLQmNCS0J3QkNCvINCX0JDQlNCV0KDQltCa0JAg0JzQldCW0JTQoyDQn9CQ0JrQldCi0JDQnNCYXHJcbiAgICBpZiAoY2FyZEl0ZW1zLmxlbmd0aCA+IEJBVENIX1NJWkUgJiYgaSArIEJBVENIX1NJWkUgPCBjYXJkSXRlbXMubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IGRlbGF5ID0gZ2V0QmF0Y2hEZWxheSgpO1xyXG4gICAgIGNvbnN0IGlzTW9iaWxlID0gL0FuZHJvaWR8d2ViT1N8aVBob25lfGlQYWR8aVBvZHxCbGFja0JlcnJ5fElFTW9iaWxlfE9wZXJhIE1pbmkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG4gICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIGlzTW9iaWxlID8gMzAwMCA6IDMwMDApKTtcclxuICAgIH1cclxuICB9IFxyXG4gIFxyXG4gIGxvZyhgRmluaXNoZWQgcHJvY2Vzc2luZyAke3Byb2Nlc3NlZENvdW50fS8ke3RvdGFsQ2FyZHN9IGNhcmRzIGluIGNvbnRleHQgXCIke2NvbnRleHR9XCJgKTtcclxufTtcclxuXHJcbi8vIOKtkCDQlNCe0J/QntCb0J3QmNCi0JXQm9Cs0J3QkNCvINCk0KPQndCa0KbQmNCvINCU0JvQryDQnNCe0JHQmNCb0KzQndCe0Jkg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQmFxyXG5leHBvcnQgY29uc3QgcHJvY2Vzc0NhcmRzTGF6eSA9IGFzeW5jIChjb250ZXh0LCBzZXR0aW5ncywgb2JzZXJ2ZXIgPSBudWxsKSA9PiB7XHJcbiAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSByZXR1cm47XHJcbiAgXHJcbiAgY29uc3QgaXNNb2JpbGUgPSBpc01vYmlsZURldmljZSgpO1xyXG4gIFxyXG4gIC8vIOKtkCDQndCQINCc0J7QkdCY0JvQrNCd0KvQpTog0J7QsdGA0LDQsdCw0YLRi9Cy0LDQtdC8INGC0L7Qu9GM0LrQviDQstC40LTQuNC80YvQtSDQutCw0YDRgtC+0YfQutC4XHJcbiAgaWYgKGlzTW9iaWxlICYmIHR5cGVvZiBJbnRlcnNlY3Rpb25PYnNlcnZlciAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIHJldHVybiBhd2FpdCBwcm9jZXNzVmlzaWJsZUNhcmRzKGNvbnRleHQsIHNldHRpbmdzLCBvYnNlcnZlcik7XHJcbiAgfVxyXG4gIFxyXG4gIC8vIOKtkCDQndCQINCU0JXQodCa0KLQntCf0JU6INCh0YLQsNC90LTQsNGA0YLQvdCw0Y8g0L7QsdGA0LDQsdC+0YLQutCwXHJcbiAgcmV0dXJuIGF3YWl0IHByb2Nlc3NDYXJkcyhjb250ZXh0LCBzZXR0aW5ncyk7XHJcbn07XHJcblxyXG4vLyDirZAgTEFaWSBMT0FESU5HINCU0JvQryDQnNCe0JHQmNCb0KzQndCr0KUgKNC+0LHRgNCw0LHQvtGC0LrQsCDRgtC+0LvRjNC60L4g0LLQuNC00LjQvNGL0YUg0LrQsNGA0YLQvtGH0LXQuilcclxuY29uc3QgcHJvY2Vzc1Zpc2libGVDYXJkcyA9IGFzeW5jIChjb250ZXh0LCBzZXR0aW5ncywgb2JzZXJ2ZXIpID0+IHtcclxuICBjb25zdCBzZWxlY3RvciA9IGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdO1xyXG4gIGlmICghc2VsZWN0b3IpIHJldHVybjtcclxuICBcclxuICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhzZWxlY3Rvcik7XHJcbiAgaWYgKCFjYXJkSXRlbXMubGVuZ3RoKSByZXR1cm47XHJcbiAgXHJcbiAgbG9nKGBMYXp5IHByb2Nlc3NpbmcgJHtjYXJkSXRlbXMubGVuZ3RofSBjYXJkcyBmb3IgbW9iaWxlYCk7XHJcbiAgXHJcbiAgLy8g0KHQvtC30LTQsNC10LwgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIg0LTQu9GPINC+0LHRgNCw0LHQvtGC0LrQuCDQstC40LTQuNC80YvRhSDQutCw0YDRgtC+0YfQtdC6XHJcbiAgY29uc3QgaW50ZXJzZWN0aW9uT2JzZXJ2ZXIgPSBuZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoKGVudHJpZXMpID0+IHtcclxuICAgIGVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiB7XHJcbiAgICAgIGlmIChlbnRyeS5pc0ludGVyc2VjdGluZykge1xyXG4gICAgICAgIGNvbnN0IGl0ZW0gPSBlbnRyeS50YXJnZXQ7XHJcbiAgICAgICAgaW50ZXJzZWN0aW9uT2JzZXJ2ZXIudW5vYnNlcnZlKGl0ZW0pO1xyXG4gICAgICAgIHByb2Nlc3NTaW5nbGVDYXJkKGl0ZW0sIGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSwge1xyXG4gICAgcm9vdDogbnVsbCxcclxuICAgIHJvb3RNYXJnaW46ICcyMDBweCcsIC8vINCd0LDRh9C40L3QsNC10Lwg0LfQsNCz0YDRg9C20LDRgtGMINC30LDRgNCw0L3QtdC1XHJcbiAgICB0aHJlc2hvbGQ6IDAuMVxyXG4gIH0pO1xyXG4gIFxyXG4gIC8vINCd0LDQsdC70Y7QtNCw0LXQvCDQt9CwINCy0YHQtdC80Lgg0LrQsNGA0YLQvtGH0LrQsNC80LhcclxuICBjYXJkSXRlbXMuZm9yRWFjaChpdGVtID0+IHtcclxuICAgIGludGVyc2VjdGlvbk9ic2VydmVyLm9ic2VydmUoaXRlbSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgLy8g4q2QINCe0JHQoNCQ0JHQntCi0JrQkCDQo9CW0JUg0JLQmNCU0JjQnNCr0KUg0JrQkNCg0KLQntCn0JXQmiDQodCg0JDQl9CjXHJcbiAgY29uc3QgdmlzaWJsZUNhcmRzID0gY2FyZEl0ZW1zLmZpbHRlcihpdGVtID0+IHtcclxuICAgIGNvbnN0IHJlY3QgPSBpdGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgcmVjdC50b3AgPj0gMCAmJlxyXG4gICAgICByZWN0LmxlZnQgPj0gMCAmJlxyXG4gICAgICByZWN0LmJvdHRvbSA8PSAod2luZG93LmlubmVySGVpZ2h0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpICYmXHJcbiAgICAgIHJlY3QucmlnaHQgPD0gKHdpbmRvdy5pbm5lcldpZHRoIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aClcclxuICAgICk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgbG9nKGBQcm9jZXNzaW5nICR7dmlzaWJsZUNhcmRzLmxlbmd0aH0gaW1tZWRpYXRlbHkgdmlzaWJsZSBjYXJkc2ApO1xyXG4gIFxyXG4gIGNvbnN0IEJBVENIX1NJWkUgPSBnZXRCYXRjaFNpemUoKTtcclxuICBmb3IgKGxldCBpID0gMDsgaSA8IHZpc2libGVDYXJkcy5sZW5ndGg7IGkgKz0gQkFUQ0hfU0laRSkge1xyXG4gICAgY29uc3QgYmF0Y2ggPSB2aXNpYmxlQ2FyZHMuc2xpY2UoaSwgaSArIEJBVENIX1NJWkUpO1xyXG4gICAgY29uc3QgcHJvbWlzZXMgPSBiYXRjaC5tYXAoaXRlbSA9PiBwcm9jZXNzU2luZ2xlQ2FyZChpdGVtLCBjb250ZXh0LCBzZXR0aW5ncykpO1xyXG4gICAgXHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgICBcclxuICAgIGlmIChpICsgQkFUQ0hfU0laRSA8IHZpc2libGVDYXJkcy5sZW5ndGgpIHtcclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIGdldEJhdGNoRGVsYXkoKSkpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICByZXR1cm4gKCkgPT4gaW50ZXJzZWN0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG59O1xyXG5cclxuLy8g4q2QINCe0JHQoNCQ0JHQntCi0JrQkCDQntCU0J3QntCZINCa0JDQoNCi0J7Qp9Ca0JhcclxuY29uc3QgcHJvY2Vzc1NpbmdsZUNhcmQgPSBhc3luYyAoaXRlbSwgY29udGV4dCwgc2V0dGluZ3MpID0+IHtcclxuICBpZiAoIWl0ZW0uaXNDb25uZWN0ZWQpIHJldHVybjtcclxuICBcclxuICBsZXQgY2FyZElkID0gbnVsbDtcclxuICB0cnkge1xyXG4gICAgLy8g0KLQsCDQttC1INC70L7Qs9C40LrQsCDQuNC30LLQu9C10YfQtdC90LjRjyBJRCDRh9GC0L4g0Lgg0LIgcHJvY2Vzc0NhcmRzXHJcbiAgICBpZiAoY29udGV4dCA9PT0gJ3RyYWRlJykge1xyXG4gICAgICBjYXJkSWQgPSBpdGVtLmdldEF0dHJpYnV0ZSgnaHJlZicpPy5tYXRjaCgvXFwvY2FyZHNcXC8oXFxkKykvKT8uWzFdO1xyXG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSAndHJhZGVPZmZlcicpIHtcclxuICAgICAgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2FyZC1pZCcpO1xyXG4gICAgfSBlbHNlIGlmIChjb250ZXh0ID09PSAncGFjaycpIHtcclxuICAgICAgY2FyZElkID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcclxuICAgIH0gZWxzZSBpZiAoY29udGV4dCA9PT0gJ2RlY2tWaWV3Jykge1xyXG4gICAgICBjYXJkSWQgPSBpdGVtLmdldEF0dHJpYnV0ZSgnZGF0YS1jYXJkLWlkJyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjYXJkSWQgPSBpdGVtLmdldEF0dHJpYnV0ZSgnZGF0YS1jYXJkLWlkJykgfHwgaXRlbS5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKCFjYXJkSWQpIHJldHVybjtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBcclxuICBjb25zdCBzaG93V2lzaGxpc3QgPSBzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy53aXNobGlzdDtcclxuICBjb25zdCBzaG93T3duZXJzID0gc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycyB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lm93bmVycztcclxuICBcclxuICBpZiAoIXNob3dXaXNobGlzdCAmJiAhc2hvd093bmVycykgcmV0dXJuO1xyXG4gIFxyXG4gIC8vINCj0LTQsNC70Y/QtdC8INGB0YLQsNGA0YvQtSDQvNC10YLQutC4XHJcbiAgaXRlbS5xdWVyeVNlbGVjdG9yKCcud2lzaGxpc3Qtd2FybmluZycpPy5yZW1vdmUoKTtcclxuICBpdGVtLnF1ZXJ5U2VsZWN0b3IoJy5vd25lcnMtY291bnQnKT8ucmVtb3ZlKCk7XHJcbiAgXHJcbiAgY29uc3QgdGFza3MgPSBbXTtcclxuICBjb25zdCBpc01vYmlsZSA9IGlzTW9iaWxlRGV2aWNlKCk7XHJcbiAgXHJcbiAgaWYgKHNob3dXaXNobGlzdCkge1xyXG4gICAgdGFza3MucHVzaChcclxuICAgICAgZ2V0V2lzaGxpc3RDb3VudChjYXJkSWQpLnRoZW4oY291bnQgPT4ge1xyXG4gICAgICAgIGlmICghaXRlbS5pc0Nvbm5lY3RlZCkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gaXNNb2JpbGUgPyAndG9wJyA6ICd0b3AnO1xyXG4gICAgICAgIGNvbnN0IGNvbG9yT3B0aW9ucyA9IHtcclxuICAgICAgICAgIGNvbG9yOiBjb3VudCA+PSBzZXR0aW5ncy53aXNobGlzdFdhcm5pbmcgPyBcclxuICAgICAgICAgICAgKGlzTW9iaWxlID8gJyNGRjhDMDAnIDogJyNGRkE1MDAnKSA6IFxyXG4gICAgICAgICAgICAoaXNNb2JpbGUgPyAnIzMyQ0QzMicgOiAnIzAwRkYwMCcpXHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICBhZGRUZXh0TGFiZWwoaXRlbSwgJ3dpc2hsaXN0LXdhcm5pbmcnLCBgJHtjb3VudH1gLCBg0KXQvtGC0Y/RgjogJHtjb3VudH1gLCBcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiwgJ3dpc2hsaXN0JywgY29sb3JPcHRpb25zLCBjb250ZXh0KTtcclxuICAgICAgfSkuY2F0Y2goKCkgPT4geyAvKiBpZ25vcmUgKi8gfSlcclxuICAgICk7XHJcbiAgfVxyXG4gIFxyXG4gIGlmIChzaG93T3duZXJzKSB7XHJcbiAgICB0YXNrcy5wdXNoKFxyXG4gICAgICBnZXRPd25lcnNDb3VudChjYXJkSWQpLnRoZW4oY291bnQgPT4ge1xyXG4gICAgICAgIGlmICghaXRlbS5pc0Nvbm5lY3RlZCkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gaXNNb2JpbGUgPyAoc2hvd1dpc2hsaXN0ID8gJ2JvdHRvbScgOiAndG9wJykgOiAnbWlkZGxlJztcclxuICAgICAgICBhZGRUZXh0TGFiZWwoaXRlbSwgJ293bmVycy1jb3VudCcsIGAke2NvdW50fWAsIGDQktC70LDQtNC10Y7RgjogJHtjb3VudH1gLCBcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbiwgJ293bmVycycsIHt9LCBjb250ZXh0KTtcclxuICAgICAgfSkuY2F0Y2goKCkgPT4geyAvKiBpZ25vcmUgKi8gfSlcclxuICAgICk7XHJcbiAgfVxyXG4gIFxyXG4gIGlmICh0YXNrcy5sZW5ndGggPiAwKSB7XHJcbiAgICBhd2FpdCBQcm9taXNlLmFsbCh0YXNrcyk7XHJcbiAgfVxyXG59OyIsImV4cG9ydCBjb25zdCBCQVNFX1VSTCA9ICdodHRwczovL21hbmdhYnVmZi5ydSc7XHJcbmV4cG9ydCBjb25zdCBMT0dfUFJFRklYID0gJ1tNYW5nYUJ1ZmZFeHRdJztcclxuXHJcbi8vIOKtkCDQkNCU0JDQn9Ci0JjQktCd0J7QlSDQmtCe0JvQmNCn0JXQodCi0JLQniDQl9CQ0J/QoNCe0KHQntCSOiDQvNC10L3RjNGI0LUg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG5leHBvcnQgY29uc3QgZ2V0TWF4Q29uY3VycmVudFJlcXVlc3RzID0gKCkgPT4ge1xyXG4gIGNvbnN0IGlzTW9iaWxlID0gL0FuZHJvaWR8d2ViT1N8aVBob25lfGlQYWR8aVBvZHxCbGFja0JlcnJ5fElFTW9iaWxlfE9wZXJhIE1pbmkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG4gIHJldHVybiBpc01vYmlsZSA/IDUgOiAxMDsgLy8gMiDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFLCA1INC00LvRjyDQtNC10YHQutGC0L7Qv9CwXHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgTUFYX0NPTkNVUlJFTlRfUkVRVUVTVFMgPSBnZXRNYXhDb25jdXJyZW50UmVxdWVzdHMoKTtcclxuXHJcbi8vIOKtkCDQpNCj0J3QmtCm0JjQryDQntCf0KDQldCU0JXQm9CV0J3QmNCvINCj0KHQotCg0J7QmdCh0KLQktCQXHJcbmV4cG9ydCBjb25zdCBpc01vYmlsZURldmljZSA9ICgpID0+IHtcclxuICByZXR1cm4gL0FuZHJvaWR8d2ViT1N8aVBob25lfGlQYWR8aVBvZHxCbGFja0JlcnJ5fElFTW9iaWxlfE9wZXJhIE1pbmkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGlzVG91Y2hEZXZpY2UgPSAoKSA9PiB7XHJcbiAgcmV0dXJuICdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyB8fCBuYXZpZ2F0b3IubWF4VG91Y2hQb2ludHMgPiAwO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGdldERldmljZVR5cGUgPSAoKSA9PiB7XHJcbiAgY29uc3Qgd2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcclxuICBpZiAod2lkdGggPCA3NjgpIHJldHVybiAnbW9iaWxlJztcclxuICBpZiAod2lkdGggPCAxMDI0KSByZXR1cm4gJ3RhYmxldCc7XHJcbiAgcmV0dXJuICdkZXNrdG9wJztcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBpbml0aWFsQ29udGV4dFN0YXRlID0ge1xyXG4gIHVzZXJDYXJkczogeyB3aXNobGlzdDogZmFsc2UgfSxcclxuICB0cmFkZTogeyB3aXNobGlzdDogdHJ1ZSwgb3duZXJzOiB0cnVlIH0sXHJcbiAgdHJhZGVPZmZlcjogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICByZW1lbHQ6IHsgd2lzaGxpc3Q6IGZhbHNlLCBvd25lcnM6IGZhbHNlIH0sXHJcbiAgbWFya2V0OiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIHNwbGl0OiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIHBhY2s6IHsgd2lzaGxpc3Q6IHRydWUsIG93bmVyczogZmFsc2UgfSxcclxuICBkZWNrQ3JlYXRlOiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIG1hcmtldENyZWF0ZTogeyB3aXNobGlzdDogZmFsc2UsIG93bmVyczogZmFsc2UgfSxcclxuICBtYXJrZXRSZXF1ZXN0Q3JlYXRlOiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIG1hcmtldFJlcXVlc3RWaWV3OiB7IHdpc2hsaXN0OiB0cnVlLCBvd25lcnM6IGZhbHNlIH0sIFxyXG4gIGRlY2tWaWV3OiB7IHdpc2hsaXN0OiBmYWxzZSwgb3duZXJzOiBmYWxzZSB9LFxyXG4gIHF1aXpQYWdlOiB7fSxcclxuICBtaW5lUGFnZToge31cclxufTtcclxuXHJcbi8vIOKtkCDQkNCU0JDQn9Ci0JjQktCd0KvQlSDQodCV0JvQldCa0KLQntCg0Ks6INC80L7QttC90L4g0LTQvtCx0LDQstC40YLRjCDQvNC+0LHQuNC70YzQvdGL0LUg0LLQtdGA0YHQuNC4INC10YHQu9C4INC60LvQsNGB0YHRiyDQvtGC0LvQuNGH0LDRjtGC0YHRj1xyXG5leHBvcnQgY29uc3QgY29udGV4dHNTZWxlY3RvcnMgPSB7XHJcbiAgLy8g0JTQtdGB0LrRgtC+0L/QvdGL0LUg0YHQtdC70LXQutGC0L7RgNGLICjQvtGB0L3QvtCy0L3Ri9C1KVxyXG4gIHVzZXJDYXJkczogJy5tYW5nYS1jYXJkc19faXRlbVtkYXRhLWNhcmQtaWRdJyxcclxuICB0cmFkZTogJy50cmFkZV9fbWFpbi1pdGVtJyxcclxuICB0cmFkZU9mZmVyOiAnLnRyYWRlX19pbnZlbnRvcnktaXRlbScsXHJcbiAgcmVtZWx0OiAnLmNhcmQtZmlsdGVyLWxpc3RfX2NhcmQnLFxyXG4gIHBhY2s6ICcubG9vdGJveF9fY2FyZFtkYXRhLWlkXScsXHJcbiAgbWFya2V0OiAnLmNhcmQtZmlsdGVyLWxpc3RfX2NhcmQnLFxyXG4gIHNwbGl0OiAnLmNhcmQtZmlsdGVyLWxpc3RfX2NhcmQnLFxyXG4gIGRlY2tDcmVhdGU6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgbWFya2V0Q3JlYXRlOiAnLmNhcmQtZmlsdGVyLWxpc3RfX2NhcmQnLFxyXG4gIG1hcmtldFJlcXVlc3RDcmVhdGU6ICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZFtkYXRhLWNhcmQtaWRdJyxcclxuICBtYXJrZXRSZXF1ZXN0VmlldzogJy5jYXJkLXBvb2xfX2l0ZW1bZGF0YS1pZF0nLCBcclxuICBkZWNrVmlldzogJy5kZWNrX19pdGVtJyxcclxuICBcclxuICAvLyDirZAg0JTQntCf0J7Qm9Cd0JjQotCV0JvQrNCd0J46INCc0L7QsdC40LvRjNC90YvQtSDRgdC10LvQtdC60YLQvtGA0YsgKNC10YHQu9C4INGB0YLRgNGD0LrRgtGD0YDQsCDQvtGC0LvQuNGH0LDQtdGC0YHRjylcclxuICAvLyB1c2VyQ2FyZHNfbW9iaWxlOiAnLm0tY2FyZC1pdGVtW2RhdGEtaWRdJywgLy8g0L/RgNC40LzQtdGAXHJcbiAgLy8gcGFja19tb2JpbGU6ICcubW9iaWxlLXBhY2stY2FyZCcsIC8vINC/0YDQuNC80LXRgFxyXG4gIFxyXG4gIC8vIOKtkCDQpNCj0J3QmtCm0JjQryDQlNCb0K8g0J/QntCb0KPQp9CV0J3QmNCvINCh0JXQm9CV0JrQotCe0KDQkCDQoSDQo9Cn0JXQotCe0Jwg0KPQodCi0KDQntCZ0KHQotCS0JBcclxuICBnZXRTZWxlY3RvcjogZnVuY3Rpb24oY29udGV4dCkge1xyXG4gICAgY29uc3QgZGV2aWNlID0gZ2V0RGV2aWNlVHlwZSgpO1xyXG4gICAgY29uc3QgbW9iaWxlU2VsZWN0b3IgPSBgJHtjb250ZXh0fV9tb2JpbGVgO1xyXG4gICAgXHJcbiAgICAvLyDQldGB0LvQuCDQtdGB0YLRjCDQvNC+0LHQuNC70YzQvdGL0Lkg0YHQtdC70LXQutGC0L7RgCDQuCDQvNGLINC90LAg0LzQvtCx0LjQu9GM0L3QvtC8INGD0YHRgtGA0L7QudGB0YLQstC1XHJcbiAgICBpZiAoZGV2aWNlID09PSAnbW9iaWxlJyAmJiB0aGlzW21vYmlsZVNlbGVjdG9yXSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgJHtMT0dfUFJFRklYfSBVc2luZyBtb2JpbGUgc2VsZWN0b3IgZm9yICR7Y29udGV4dH06ICR7dGhpc1ttb2JpbGVTZWxlY3Rvcl19YCk7XHJcbiAgICAgIHJldHVybiB0aGlzW21vYmlsZVNlbGVjdG9yXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8g0JjQvdCw0YfQtSDQuNGB0L/QvtC70YzQt9GD0LXQvCDRgdGC0LDQvdC00LDRgNGC0L3Ri9C5INGB0LXQu9C10LrRgtC+0YBcclxuICAgIHJldHVybiB0aGlzW2NvbnRleHRdO1xyXG4gIH1cclxufTtcclxuXHJcbi8vIOKtkCDQkNCU0JDQn9Ci0JjQktCd0KvQlSDQotCQ0JnQnNCQ0KPQotCrINCU0JvQryDQl9CQ0J/QoNCe0KHQntCSXHJcbmV4cG9ydCBjb25zdCBnZXRSZXF1ZXN0VGltZW91dCA9ICgpID0+IHtcclxuICBjb25zdCBkZXZpY2UgPSBnZXREZXZpY2VUeXBlKCk7XHJcbiAgc3dpdGNoKGRldmljZSkge1xyXG4gICAgY2FzZSAnbW9iaWxlJzogcmV0dXJuIDE1MDAwOyAvLyAxNSDRgdC10LrRg9C90LQg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhSAo0LzQtdC00LvQtdC90L3Ri9C1INGB0LXRgtC4KVxyXG4gICAgY2FzZSAndGFibGV0JzogcmV0dXJuIDEwMDAwOyAvLyAxMCDRgdC10LrRg9C90LQg0LTQu9GPINC/0LvQsNC90YjQtdGC0L7QslxyXG4gICAgZGVmYXVsdDogcmV0dXJuIDgwMDA7IC8vIDgg0YHQtdC60YPQvdC0INC00LvRjyDQtNC10YHQutGC0L7Qv9CwXHJcbiAgfVxyXG59O1xyXG5cclxuLy8g4q2QINCQ0JTQkNCf0KLQmNCS0J3Qq9CVINCX0JDQlNCV0KDQltCa0Jgg0JzQldCW0JTQoyDQn9CQ0JrQldCi0JDQnNCYINCX0JDQn9Cg0J7QodCe0JJcclxuZXhwb3J0IGNvbnN0IGdldEJhdGNoRGVsYXkgPSAoKSA9PiB7XHJcbiAgY29uc3QgZGV2aWNlID0gZ2V0RGV2aWNlVHlwZSgpO1xyXG4gIHN3aXRjaChkZXZpY2UpIHtcclxuICAgIGNhc2UgJ21vYmlsZSc6IHJldHVybiAxNTAwOyAvLyAxLjUg0YHQtdC60YPQvdC00Ysg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgY2FzZSAndGFibGV0JzogcmV0dXJuIDEwMDA7IC8vIDEg0YHQtdC60YPQvdC00LAg0LTQu9GPINC/0LvQsNC90YjQtdGC0L7QslxyXG4gICAgZGVmYXVsdDogcmV0dXJuIDUwMDsgLy8gMC41INGB0LXQutGD0L3QtNGLINC00LvRjyDQtNC10YHQutGC0L7Qv9CwXHJcbiAgfVxyXG59O1xyXG5cclxuLy8g4q2QINCk0KPQndCa0KbQmNCvINCU0JvQryDQntCf0KDQldCU0JXQm9CV0J3QmNCvINCe0J/QotCY0JzQkNCb0KzQndCe0JPQniDQoNCQ0JfQnNCV0KDQkCDQn9CQ0JrQldCi0JBcclxuZXhwb3J0IGNvbnN0IGdldEJhdGNoU2l6ZSA9ICgpID0+IHtcclxuICBjb25zdCBkZXZpY2UgPSBnZXREZXZpY2VUeXBlKCk7XHJcbiAgc3dpdGNoKGRldmljZSkge1xyXG4gICAgY2FzZSAnbW9iaWxlJzogcmV0dXJuIDM7IC8vIDMg0LrQsNGA0YLQvtGH0LrQuCDQt9CwINGA0LDQtyDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgY2FzZSAndGFibGV0JzogcmV0dXJuIDU7IC8vIDUg0LrQsNGA0YLQvtGH0LXQuiDQvdCwINC/0LvQsNC90YjQtdGC0LDRhVxyXG4gICAgZGVmYXVsdDogcmV0dXJuIDEwOyAvLyAxMCDQutCw0YDRgtC+0YfQtdC6INC90LAg0LTQtdGB0LrRgtC+0L/QtVxyXG4gIH1cclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBnZXRDdXJyZW50Q29udGV4dCA9ICgpID0+IHtcclxuICBjb25zdCBwYXRoID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xyXG4gIGNvbnN0IHNlYXJjaFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7IFxyXG5cclxuICBjb25zdCBjb250ZXh0c01hcCA9IHtcclxuICAgICcvdXNlcnMvXFxcXGQrL2NhcmRzJzogJ3VzZXJDYXJkcycsXHJcbiAgICAnL3RyYWRlcy9cXFxcZCsnOiAndHJhZGUnLFxyXG4gICAgJy90cmFkZXMvb2ZmZXJzL1xcXFxkKyc6ICd0cmFkZU9mZmVyJyxcclxuICAgICcvY2FyZHMvcGFjayc6ICdwYWNrJyxcclxuICAgICcvY2FyZHMvcmVtZWx0JzogJ3JlbWVsdCcsXHJcbiAgICAnL21hcmtldC9cXFxcZCsnOiAnbWFya2V0JywgXHJcbiAgICAnL2NhcmRzL3NwbGl0JzogJ3NwbGl0JyxcclxuICAgICcvbWFya2V0L2NyZWF0ZSc6ICdtYXJrZXRDcmVhdGUnLFxyXG4gICAgJy9kZWNrcy9jcmVhdGUnOiAnZGVja0NyZWF0ZScsXHJcbiAgICAnL2RlY2tzL1xcXFxkKyc6ICdkZWNrVmlldycsXHJcbiAgICAnL3F1aXonOiAncXVpelBhZ2UnLFxyXG4gICAgJy9taW5lJzogJ21pbmVQYWdlJyxcclxuICAgICcvbWFya2V0L3JlcXVlc3RzL2NyZWF0ZSc6ICdtYXJrZXRSZXF1ZXN0Q3JlYXRlJyxcclxuICAgICcvbWFya2V0L3JlcXVlc3RzL1xcXFxkKyc6ICdtYXJrZXRSZXF1ZXN0VmlldycgXHJcbiAgfTtcclxuICBcclxuICBmb3IgKGNvbnN0IFtwYXR0ZXJuLCBjb250ZXh0XSBvZiBPYmplY3QuZW50cmllcyhjb250ZXh0c01hcCkpIHtcclxuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgXiR7cGF0dGVybn0kYCk7XHJcbiAgICBpZiAoY29udGV4dCA9PT0gJ21hcmtldFJlcXVlc3RDcmVhdGUnICYmIHBhdGggPT09ICcvbWFya2V0L3JlcXVlc3RzL2NyZWF0ZScpIHtcclxuICAgICAgY29uc29sZS5sb2coYCR7TE9HX1BSRUZJWH0gRGV0ZWN0ZWQgY29udGV4dDogJHtjb250ZXh0fWApO1xyXG4gICAgICByZXR1cm4gY29udGV4dDtcclxuICAgIH0gZWxzZSBpZiAocmVnZXgudGVzdChwYXRoKSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgJHtMT0dfUFJFRklYfSBEZXRlY3RlZCBjb250ZXh0OiAke2NvbnRleHR9YCk7XHJcbiAgICAgIHJldHVybiBjb250ZXh0O1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvLyDirZAg0JTQntCf0J7Qm9Cd0JjQotCV0JvQrNCd0JDQryDQn9Cg0J7QktCV0KDQmtCQINCU0JvQryDQnNCe0JHQmNCb0KzQndCr0KUg0J/Qo9Ci0JXQmVxyXG4gIGNvbnN0IG1vYmlsZUNvbnRleHRzTWFwID0ge1xyXG4gICAgJy9tL3VzZXJzL1xcXFxkKy9jYXJkcyc6ICd1c2VyQ2FyZHMnLCAvLyDQtdGB0LvQuCDQtdGB0YLRjCDQvNC+0LHQuNC70YzQvdCw0Y8g0LLQtdGA0YHQuNGPINC/0YPRgtC4XHJcbiAgICAnL20vdHJhZGVzL1xcXFxkKyc6ICd0cmFkZScsXHJcbiAgICAvLyDQtNC+0LHQsNCy0YzRgtC1INC00YDRg9Cz0LjQtSDQvNC+0LHQuNC70YzQvdGL0LUg0L/Rg9GC0Lgg0L/RgNC4INC90LXQvtCx0YXQvtC00LjQvNC+0YHRgtC4XHJcbiAgfTtcclxuICBcclxuICBmb3IgKGNvbnN0IFtwYXR0ZXJuLCBjb250ZXh0XSBvZiBPYmplY3QuZW50cmllcyhtb2JpbGVDb250ZXh0c01hcCkpIHtcclxuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgXiR7cGF0dGVybn0kYCk7XHJcbiAgICBpZiAocmVnZXgudGVzdChwYXRoKSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgJHtMT0dfUFJFRklYfSBEZXRlY3RlZCBNT0JJTEUgY29udGV4dDogJHtjb250ZXh0fSBmb3IgcGF0aDogJHtwYXRofWApO1xyXG4gICAgICByZXR1cm4gY29udGV4dDtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgY29uc29sZS5sb2coYCR7TE9HX1BSRUZJWH0gTm8gY29udGV4dCBkZXRlY3RlZCBmb3IgcGF0aDogJHtwYXRofWApO1xyXG4gIHJldHVybiBudWxsO1xyXG59O1xyXG5cclxuLy8g4q2QINCU0J7Qn9Ce0JvQndCY0KLQldCb0KzQndCr0JUg0J3QkNCh0KLQoNCe0JnQmtCYINCU0JvQryDQnNCe0JHQmNCb0KzQndCr0KVcclxuZXhwb3J0IGNvbnN0IG1vYmlsZVNldHRpbmdzID0ge1xyXG4gIC8vINCe0L/RgtC40LzQuNC30LDRhtC40Y8g0LTQu9GPINC80LXQtNC70LXQvdC90YvRhSDRgdC10YLQtdC5XHJcbiAgZW5hYmxlTG93RGF0YU1vZGU6IHRydWUsXHJcbiAgXHJcbiAgLy8g0JjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMINC70Lgg0LrRjdGIINCx0L7Qu9C10LUg0LDQs9GA0LXRgdGB0LjQstC90L4g0L3QsCDQvNC+0LHQuNC70YzQvdGL0YVcclxuICBjYWNoZUR1cmF0aW9uOiB7XHJcbiAgICBtb2JpbGU6IDQ4ICogNjAgKiA2MCAqIDEwMDAsIC8vIDQ4INGH0LDRgdC+0LIg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgZGVza3RvcDogMjQgKiA2MCAqIDYwICogMTAwMCAvLyAyNCDRh9Cw0YHQsCDQtNC70Y8g0LTQtdGB0LrRgtC+0L/QsFxyXG4gIH0sXHJcbiAgXHJcbiAgLy8g0JfQsNC00LXRgNC20LrQsCDQv9C10YDQtdC0INC/0L7QstGC0L7RgNC90L7QuSDQv9C+0L/Ri9GC0LrQvtC5INC30LDQv9GA0L7RgdCwXHJcbiAgcmV0cnlEZWxheToge1xyXG4gICAgbW9iaWxlOiAzMDAwLCAvLyAzINGB0LXQutGD0L3QtNGLINC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgIGRlc2t0b3A6IDEwMDAgLy8gMSDRgdC10LrRg9C90LTQsCDQtNC70Y8g0LTQtdGB0LrRgtC+0L/QsFxyXG4gIH1cclxufTtcclxuXHJcbi8vIOKtkCDQpNCj0J3QmtCm0JjQryDQlNCb0K8g0J/QntCb0KPQp9CV0J3QmNCvINCe0J/QotCY0JzQkNCb0KzQndCr0KUg0J3QkNCh0KLQoNCe0JXQmlxyXG5leHBvcnQgY29uc3QgZ2V0T3B0aW1pemVkU2V0dGluZ3MgPSAoKSA9PiB7XHJcbiAgY29uc3QgZGV2aWNlID0gZ2V0RGV2aWNlVHlwZSgpO1xyXG4gIGNvbnN0IGlzTW9iaWxlID0gZGV2aWNlID09PSAnbW9iaWxlJztcclxuICBcclxuICByZXR1cm4ge1xyXG4gICAgcmVxdWVzdFRpbWVvdXQ6IGdldFJlcXVlc3RUaW1lb3V0KCksXHJcbiAgICBiYXRjaFNpemU6IGdldEJhdGNoU2l6ZSgpLFxyXG4gICAgYmF0Y2hEZWxheTogZ2V0QmF0Y2hEZWxheSgpLFxyXG4gICAgbWF4Q29uY3VycmVudFJlcXVlc3RzOiBnZXRNYXhDb25jdXJyZW50UmVxdWVzdHMoKSxcclxuICAgIGNhY2hlRHVyYXRpb246IGlzTW9iaWxlID8gXHJcbiAgICAgIG1vYmlsZVNldHRpbmdzLmNhY2hlRHVyYXRpb24ubW9iaWxlIDogXHJcbiAgICAgIG1vYmlsZVNldHRpbmdzLmNhY2hlRHVyYXRpb24uZGVza3RvcCxcclxuICAgIHJldHJ5RGVsYXk6IGlzTW9iaWxlID8gXHJcbiAgICAgIG1vYmlsZVNldHRpbmdzLnJldHJ5RGVsYXkubW9iaWxlIDogXHJcbiAgICAgIG1vYmlsZVNldHRpbmdzLnJldHJ5RGVsYXkuZGVza3RvcCxcclxuICAgIGVuYWJsZUxvd0RhdGFNb2RlOiBpc01vYmlsZSAmJiBtb2JpbGVTZXR0aW5ncy5lbmFibGVMb3dEYXRhTW9kZVxyXG4gIH07XHJcbn07IiwiaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzLmpzJztcclxuaW1wb3J0IHsgcHJvY2Vzc0NhcmRzIH0gZnJvbSAnLi9jYXJkUHJvY2Vzc29yLmpzJztcclxuaW1wb3J0IHsgZ2V0RWxlbWVudHMsIHdhaXRGb3JFbGVtZW50cywgbG9nLCBsb2dXYXJuLCBsb2dFcnJvciwgZGVib3VuY2UsIGNhY2hlZEVsZW1lbnRzLCBpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCB9IGZyb20gJy4vdXRpbHMuanMnO1xyXG5pbXBvcnQgeyBjb250ZXh0c1NlbGVjdG9ycywgQkFTRV9VUkwsIGluaXRpYWxDb250ZXh0U3RhdGUgfSBmcm9tICcuL2NvbmZpZy5qcyc7XHJcbmltcG9ydCB7IGNvbnRleHRTdGF0ZSB9IGZyb20gJy4vbWFpbi5qcyc7IFxyXG5cclxuZXhwb3J0IGNvbnN0IGluaXRVc2VyQ2FyZHMgPSBhc3luYyAoKSA9PiB7XHJcbiAgY29uc3QgY29udHJvbHNDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY2FyZC1jb250cm9scy5zY3JvbGwtaGlkZGVuJyk7XHJcbiAgaWYgKCFjb250cm9sc0NvbnRhaW5lcikge1xyXG4gICAgICBsb2dXYXJuKCdpbml0VXNlckNhcmRzOiBDb250cm9scyBjb250YWluZXIgbm90IGZvdW5kLicpO1xyXG4gICAgICByZXR1cm47XHJcbiAgfVxyXG4gIGNvbnRyb2xzQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy53aXNobGlzdC10b2dnbGUtYnRuJyk/LnJlbW92ZSgpO1xyXG5cclxuICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgY29uc3QgdG9nZ2xlQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgdG9nZ2xlQnRuLmNsYXNzTGlzdC5hZGQoJ2J1dHRvbicsICd3aXNobGlzdC10b2dnbGUtYnRuJyk7XHJcbiAgdG9nZ2xlQnRuLnN0eWxlLm1hcmdpbkxlZnQgPSAnMTBweCc7XHJcbiAgY29udHJvbHNDb250YWluZXIuYXBwZW5kQ2hpbGQodG9nZ2xlQnRuKTtcclxuXHJcbiAgLy8g4q2QINCU0J7QkdCQ0JLQm9Cv0JXQnDog0J7Qv9GA0LXQtNC10LvRj9C10Lwg0LzQvtCx0LjQu9GM0L3QvtC1INGD0YHRgtGA0L7QudGB0YLQstC+XHJcbiAgY29uc3QgaXNNb2JpbGUgPSAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbiAgY29uc3QgaXNUb3VjaCA9ICdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyB8fCBuYXZpZ2F0b3IubWF4VG91Y2hQb2ludHMgPiAwO1xyXG5cclxuICBjb25zdCB1cGRhdGVVc2VyQ2FyZEJ1dHRvblN0YXRlID0gKCkgPT4ge1xyXG4gICAgICBnZXRTZXR0aW5ncygpLnRoZW4oY3VycmVudFNldHRpbmdzID0+IHtcclxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRDb250ZXh0U3RhdGUgPSBjb250ZXh0U3RhdGVbJ3VzZXJDYXJkcyddIHx8IGluaXRpYWxDb250ZXh0U3RhdGVbJ3VzZXJDYXJkcyddOyBcclxuICAgICAgICAgIGlmIChjdXJyZW50U2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0KSB7XHJcbiAgICAgICAgICAgICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gJ9CW0LXQu9Cw0Y7RidC40LUgKNCy0YHQtdCz0LTQsCknO1xyXG4gICAgICAgICAgICAgIHRvZ2dsZUJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgdG9nZ2xlQnRuLnN0eWxlLm9wYWNpdHkgPSAnMC43JztcclxuICAgICAgICAgICAgICBpZiAoY29udGV4dFN0YXRlLnVzZXJDYXJkcykgY29udGV4dFN0YXRlLnVzZXJDYXJkcy53aXNobGlzdCA9IHRydWU7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlzQWN0aXZlID0gY3VycmVudENvbnRleHRTdGF0ZS53aXNobGlzdDtcclxuICAgICAgICAgICAgICAvLyDirZAg0JjQl9Cc0JXQndCv0JXQnDog0JDQtNCw0L/RgtC40YDRg9C10Lwg0YLQtdC60YHRgiDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgICAgICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgIHRvZ2dsZUJ0bi50ZXh0Q29udGVudCA9IGlzQWN0aXZlID8gJ9Ch0LrRgNGL0YLRjCcgOiAn0JbQtdC70LDRjtGJ0LjQtSc7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gaXNBY3RpdmUgPyAn0KHQutGA0YvRgtGMINC20LXQu9Cw0Y7RidC40YUnIDogJ9Cf0L7QutCw0LfQsNGC0Ywg0LbQtdC70LDRjtGJ0LjRhSc7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHRvZ2dsZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgIHRvZ2dsZUJ0bi5zdHlsZS5vcGFjaXR5ID0gJzEnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICAvLyDirZAg0JTQntCR0JDQktCb0K/QldCcOiDQo9Cy0LXQu9C40YfQuNCy0LDQtdC8INC60L3QvtC/0LrRgyDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgICBpZiAoaXNNb2JpbGUpIHtcclxuICAgICAgICAgICAgICB0b2dnbGVCdG4uc3R5bGUucGFkZGluZyA9ICcxMHB4IDE1cHgnO1xyXG4gICAgICAgICAgICAgIHRvZ2dsZUJ0bi5zdHlsZS5mb250U2l6ZSA9ICcxNHB4JztcclxuICAgICAgICAgICAgICB0b2dnbGVCdG4uc3R5bGUubWluSGVpZ2h0ID0gJzQ0cHgnOyAvLyDQnNC40L3QuNC80LDQu9GM0L3QsNGPINCy0YvRgdC+0YLQsCDQtNC70Y8g0LrQsNGB0LDQvdC40Y9cclxuICAgICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgdXBkYXRlVXNlckNhcmRCdXR0b25TdGF0ZSgpO1xyXG5cclxuICB0b2dnbGVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gICAgaWYgKGN1cnJlbnRTZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QpIHJldHVybjtcclxuXHJcbiAgICB0b2dnbGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgdG9nZ2xlQnRuLnRleHRDb250ZW50ID0gJ9CX0LDQs9GA0YPQt9C60LAuLi4nO1xyXG5cclxuICAgIGlmIChjb250ZXh0U3RhdGUudXNlckNhcmRzKSB7XHJcbiAgICAgICAgIGNvbnRleHRTdGF0ZS51c2VyQ2FyZHMud2lzaGxpc3QgPSAhY29udGV4dFN0YXRlLnVzZXJDYXJkcy53aXNobGlzdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgIGNvbnRleHRTdGF0ZS51c2VyQ2FyZHMgPSB7IC4uLmluaXRpYWxDb250ZXh0U3RhdGUudXNlckNhcmRzLCB3aXNobGlzdDogIWluaXRpYWxDb250ZXh0U3RhdGUudXNlckNhcmRzLndpc2hsaXN0IH07XHJcbiAgICB9XHJcblxyXG4gICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLnVzZXJDYXJkcyk7IFxyXG4gICAgYXdhaXQgcHJvY2Vzc0NhcmRzKCd1c2VyQ2FyZHMnLCBjdXJyZW50U2V0dGluZ3MpOyBcclxuICAgIHVwZGF0ZVVzZXJDYXJkQnV0dG9uU3RhdGUoKTsgXHJcbiAgICBsb2coYFVzZXJDYXJkczogVG9nZ2xlZCB3aXNobGlzdCB2aXNpYmlsaXR5OiAke2NvbnRleHRTdGF0ZS51c2VyQ2FyZHM/Lndpc2hsaXN0fWApO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBjYXJkSXRlbXMgPSBnZXRFbGVtZW50cyhjb250ZXh0c1NlbGVjdG9ycy51c2VyQ2FyZHMpO1xyXG4gIFxyXG4gIC8vIOKtkCDQo9CU0JDQm9Cv0JXQnDog0JLQtdGB0Ywg0LrQvtC0INGBINC/0YDQsNCy0L7QuSDQutC90L7Qv9C60L7QuSDQvNGL0YjQuFxyXG4gIC8vINCh0YLQsNGA0YvQuSDQutC+0LQgKNGD0LTQsNC70LjRgtGMKTpcclxuICAvLyBjYXJkSXRlbXMuZm9yRWFjaChpdGVtID0+IHtcclxuICAvLyAgIGl0ZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBoYW5kbGVVc2VyQ2FyZENvbnRleHRNZW51KTsgXHJcbiAgLy8gICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgaGFuZGxlVXNlckNhcmRDb250ZXh0TWVudSk7XHJcbiAgLy8gfSk7XHJcbiAgXHJcbiAgLy8g4q2QINCS0JzQldCh0KLQniDQrdCi0J7Qk9CeOiDQlNC+0LHQsNCy0LvRj9C10Lwg0LrQvdC+0L/QutGDIFwi0KHQvtC30LTQsNGC0Ywg0LvQvtGCXCIg0L3QsCDQutCw0LbQtNGD0Y4g0LrQsNGA0YLQvtGH0LrRg1xyXG4gIGlmIChpc01vYmlsZSkge1xyXG4gICAgY2FyZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgIC8vINCj0LTQsNC70Y/QtdC8INGB0YLQsNGA0YvQtSDQutC90L7Qv9C60Lgg0LXRgdC70Lgg0LXRgdGC0YxcclxuICAgICAgaXRlbS5xdWVyeVNlbGVjdG9yKCcubW9iaWxlLWNyZWF0ZS1sb3QtYnRuJyk/LnJlbW92ZSgpO1xyXG4gICAgICBcclxuICAgICAgLy8g0KHQvtC30LTQsNC10Lwg0LrQvdC+0L/QutGDINC00LvRjyDRgdC+0LfQtNCw0L3QuNGPINC70L7RgtCwXHJcbiAgICAgIGNvbnN0IGNyZWF0ZUxvdEJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgICBjcmVhdGVMb3RCdG4uY2xhc3NMaXN0LmFkZCgnbW9iaWxlLWNyZWF0ZS1sb3QtYnRuJyk7XHJcbiAgICAgIGNyZWF0ZUxvdEJ0bi50ZXh0Q29udGVudCA9ICfwn5OIINCb0L7Rgic7XHJcbiAgICAgIGNyZWF0ZUxvdEJ0bi50aXRsZSA9ICfQodC+0LfQtNCw0YLRjCDQu9C+0YIg0L3QsCDQvNCw0YDQutC10YLQtSc7XHJcbiAgICAgIFxyXG4gICAgICAvLyDQodGC0LjQu9C4INC00LvRjyDQvNC+0LHQuNC70YzQvdC+0Lkg0LrQvdC+0L/QutC4XHJcbiAgICAgIGNyZWF0ZUxvdEJ0bi5zdHlsZS5jc3NUZXh0ID0gYFxyXG4gICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgICBib3R0b206IDVweDtcclxuICAgICAgICBsZWZ0OiA1cHg7XHJcbiAgICAgICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzY2N2VlYSAwJSwgIzc2NGJhMiAxMDAlKTtcclxuICAgICAgICBjb2xvcjogd2hpdGU7XHJcbiAgICAgICAgYm9yZGVyOiBub25lO1xyXG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICAgICAgICBwYWRkaW5nOiA2cHggMTBweDtcclxuICAgICAgICBmb250LXNpemU6IDEycHg7XHJcbiAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XHJcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xyXG4gICAgICAgIHotaW5kZXg6IDIwO1xyXG4gICAgICAgIG9wYWNpdHk6IDAuOTtcclxuICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMnM7XHJcbiAgICAgICAgbWluLWhlaWdodDogMzBweDtcclxuICAgICAgICBtaW4td2lkdGg6IDYwcHg7XHJcbiAgICAgIGA7XHJcbiAgICAgIFxyXG4gICAgICBjcmVhdGVMb3RCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZSkgPT4ge1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGF3YWl0IGhhbmRsZUNyZWF0ZUxvdEZyb21DYXJkKGl0ZW0pO1xyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQutC90L7Qv9C60YMg0L3QsCDQutCw0YDRgtC+0YfQutGDXHJcbiAgICAgIGlmIChnZXRDb21wdXRlZFN0eWxlKGl0ZW0pLnBvc2l0aW9uID09PSAnc3RhdGljJykge1xyXG4gICAgICAgIGl0ZW0uc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xyXG4gICAgICB9XHJcbiAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQoY3JlYXRlTG90QnRuKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgaW5pdGlhbFNob3dXaXNobGlzdCA9IHNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCB8fCBjb250ZXh0U3RhdGUudXNlckNhcmRzPy53aXNobGlzdDtcclxuICBpZiAoaW5pdGlhbFNob3dXaXNobGlzdCkge1xyXG4gICAgbG9nKCdpbml0VXNlckNhcmRzOiBJbml0aWFsIHdpc2hsaXN0IHByb2Nlc3NpbmcgbmVlZGVkLicpO1xyXG4gICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLnVzZXJDYXJkcyk7XHJcbiAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoJ3VzZXJDYXJkcycsIHNldHRpbmdzKTtcclxuICB9XHJcbn07XHJcblxyXG4vLyDirZAg0J3QntCS0JDQryDQpNCj0J3QmtCm0JjQrzog0JfQsNC80LXQvdGP0LXRgiBoYW5kbGVVc2VyQ2FyZENvbnRleHRNZW51XHJcbmNvbnN0IGhhbmRsZUNyZWF0ZUxvdEZyb21DYXJkID0gYXN5bmMgKGNhcmRJdGVtKSA9PiB7XHJcbiAgY29uc3QgbG9ja0J1dHRvbiA9IGNhcmRJdGVtLnF1ZXJ5U2VsZWN0b3IoJy5sb2NrLWNhcmQtYnRuJyk7XHJcbiAgY29uc3QgaW1hZ2VEaXYgPSBjYXJkSXRlbS5xdWVyeVNlbGVjdG9yKCcubWFuZ2EtY2FyZHNfX2ltYWdlJyk7XHJcblxyXG4gIGlmICghbG9ja0J1dHRvbikge1xyXG4gICAgbG9nV2FybignQ3JlYXRlTG90OiBMb2NrIGJ1dHRvbiAoLmxvY2stY2FyZC1idG4pIG5vdCBmb3VuZC4nKTtcclxuICAgIGFsZXJ0KCfQndC1INGD0LTQsNC70L7RgdGMINC90LDQudGC0Lgg0LTQsNC90L3Ri9C1INC60LDRgNGC0YsnKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgaWYgKCFpbWFnZURpdikge1xyXG4gICAgbG9nV2FybignQ3JlYXRlTG90OiBJbWFnZSBkaXYgKC5tYW5nYS1jYXJkc19faW1hZ2UpIG5vdCBmb3VuZC4nKTtcclxuICAgIGFsZXJ0KCfQndC1INGD0LTQsNC70L7RgdGMINC90LDQudGC0Lgg0LjQt9C+0LHRgNCw0LbQtdC90LjQtSDQutCw0YDRgtGLJyk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBjYXJkSW5zdGFuY2VJZCA9IGxvY2tCdXR0b24uZ2V0QXR0cmlidXRlKCdkYXRhLWlkJyk7XHJcbiAgY29uc3QgYmdJbWFnZVN0eWxlID0gaW1hZ2VEaXYuc3R5bGUuYmFja2dyb3VuZEltYWdlO1xyXG4gIGNvbnN0IHVybE1hdGNoID0gYmdJbWFnZVN0eWxlLm1hdGNoKC91cmxcXChcIj8oLis/KVwiP1xcKS8pO1xyXG4gIGNvbnN0IGltYWdlVXJsID0gdXJsTWF0Y2ggPyB1cmxNYXRjaFsxXSA6IG51bGw7XHJcblxyXG4gIGlmICghY2FyZEluc3RhbmNlSWQpIHtcclxuICAgIGxvZ1dhcm4oJ0NyZWF0ZUxvdDogTWlzc2luZyBkYXRhLWlkIG9uIGxvY2sgYnV0dG9uLicpO1xyXG4gICAgYWxlcnQoJ9Ce0YjQuNCx0LrQsDogSUQg0LrQsNGA0YLRiyDQvdC1INC90LDQudC00LXQvScpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAoIWltYWdlVXJsKSB7XHJcbiAgICBsb2dXYXJuKCdDcmVhdGVMb3Q6IENvdWxkIG5vdCBleHRyYWN0IGltYWdlIFVSTCBmcm9tIHN0eWxlOicsIGJnSW1hZ2VTdHlsZSk7XHJcbiAgICBhbGVydCgn0J7RiNC40LHQutCwOiDQmNC30L7QsdGA0LDQttC10L3QuNC1INC60LDRgNGC0Ysg0L3QtSDQvdCw0LnQtNC10L3QvicpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgbG9nKGBDcmVhdGVMb3Q6IFNlbGVjdGVkIGNhcmQgaW5zdGFuY2UgSUQ6ICR7Y2FyZEluc3RhbmNlSWR9LCBJbWFnZTogJHtpbWFnZVVybH1gKTtcclxuXHJcbiAgY29uc3QgZGF0YVRvU2F2ZSA9IHtcclxuICAgIGluc3RhbmNlSWQ6IGNhcmRJbnN0YW5jZUlkLFxyXG4gICAgaW1hZ2VVcmw6IGltYWdlVXJsXHJcbiAgfTtcclxuXHJcbiAgdHJ5IHtcclxuICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INC40L3QtNC40LrQsNGC0L7RgCDQt9Cw0LPRgNGD0LfQutC4XHJcbiAgICBjb25zdCBvcmlnaW5hbFRleHQgPSBsb2NrQnV0dG9uLnRleHRDb250ZW50O1xyXG4gICAgbG9ja0J1dHRvbi50ZXh0Q29udGVudCA9ICfij7MuLi4nO1xyXG4gICAgbG9ja0J1dHRvbi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICBcclxuICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHNlbGVjdGVkTWFya2V0Q2FyZERhdGE6IGRhdGFUb1NhdmUgfSk7XHJcbiAgICBsb2coJ0NyZWF0ZUxvdDogU2F2ZWQgY2FyZCBkYXRhIHRvIGxvY2FsIHN0b3JhZ2U6JywgZGF0YVRvU2F2ZSk7XHJcbiAgICBcclxuICAgIC8vINCf0L7QtNGC0LLQtdGA0LbQtNC10L3QuNC1INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjyAo0L7Qv9GG0LjQvtC90LDQu9GM0L3QvilcclxuICAgIGlmIChjb25maXJtKCfQn9C10YDQtdC50YLQuCDQuiDRgdC+0LfQtNCw0L3QuNGOINC70L7RgtCwINC90LAg0LzQsNGA0LrQtdGC0LU/JykpIHtcclxuICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgJHtCQVNFX1VSTH0vbWFya2V0L2NyZWF0ZWA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyDQktC+0YHRgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0LrQvdC+0L/QutGDINC10YHQu9C4INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjCDQv9C10YDQtdC00YPQvNCw0LtcclxuICAgICAgbG9ja0J1dHRvbi50ZXh0Q29udGVudCA9IG9yaWdpbmFsVGV4dDtcclxuICAgICAgbG9ja0J1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoJ3NlbGVjdGVkTWFya2V0Q2FyZERhdGEnKTtcclxuICAgIH1cclxuICAgIFxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBsb2dFcnJvcignQ3JlYXRlTG90OiBFcnJvciBzYXZpbmcgZGF0YTonLCBlcnJvcik7XHJcbiAgICBhbGVydCgn0J3QtSDRg9C00LDQu9C+0YHRjCDRgdC+0YXRgNCw0L3QuNGC0Ywg0LTQsNC90L3Ri9C1INC60LDRgNGC0Ysg0LTQu9GPINGB0L7Qt9C00LDQvdC40Y8g0LvQvtGC0LAuJyk7XHJcbiAgICBsb2NrQnV0dG9uLnRleHRDb250ZW50ID0gJ+KdjCDQntGI0LjQsdC60LAnO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIGxvY2tCdXR0b24udGV4dENvbnRlbnQgPSBvcmlnaW5hbFRleHQ7XHJcbiAgICAgIGxvY2tCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgIH0sIDIwMDApO1xyXG4gIH1cclxufTtcclxuXHJcbi8vIOKtkCDQo9CU0JDQm9Cv0JXQnDog0KHRgtCw0YDRg9GOINGE0YPQvdC60YbQuNGOIGhhbmRsZVVzZXJDYXJkQ29udGV4dE1lbnUg0L/QvtC70L3QvtGB0YLRjNGOXHJcbi8vIGNvbnN0IGhhbmRsZVVzZXJDYXJkQ29udGV4dE1lbnUgPSBhc3luYyAoZSkgPT4geyAuLi4gfVxyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZU1hcmtldENyZWF0ZVBhZ2UgPSBhc3luYyAoKSA9PiB7XHJcbiAgLy8gLi4uINGB0YPRidC10YHRgtCy0YPRjtGJ0LjQuSDQutC+0LQg0JHQldCXINCY0JfQnNCV0J3QldCd0JjQmSAuLi5cclxuICAvLyAo0L7RgdGC0LDQstC70Y/QtdC8INC60LDQuiDQtdGB0YLRjCwg0L7QvSDQvdGD0LbQtdC9INC00LvRjyDQsNCy0YLQvtC80LDRgtC40YfQtdGB0LrQvtCz0L4g0LfQsNC/0L7Qu9C90LXQvdC40Y8pXHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaW5pdFN0YXRzQnV0dG9ucyA9IGFzeW5jIChjb250ZXh0LCB0YXJnZXRTZWxlY3RvciwgYnV0dG9uQ2xhc3MpID0+IHtcclxuICAgIGNvbnN0IHRhcmdldERpdiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGFyZ2V0U2VsZWN0b3IpO1xyXG4gICAgaWYgKCF0YXJnZXREaXYpIHtcclxuICAgICAgICBsb2dXYXJuKGBpbml0U3RhdHNCdXR0b25zOiBUYXJnZXQgc2VsZWN0b3IgJyR7dGFyZ2V0U2VsZWN0b3J9JyBub3QgZm91bmQgZm9yIGNvbnRleHQgJyR7Y29udGV4dH0nLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8g4q2QINCU0J7QkdCQ0JLQm9Cv0JXQnDog0J7Qv9GA0LXQtNC10LvRj9C10Lwg0LzQvtCx0LjQu9GM0L3QvtC1INGD0YHRgtGA0L7QudGB0YLQstC+XHJcbiAgICBjb25zdCBpc01vYmlsZSA9IC9BbmRyb2lkfHdlYk9TfGlQaG9uZXxpUGFkfGlQb2R8QmxhY2tCZXJyeXxJRU1vYmlsZXxPcGVyYSBNaW5pL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gICAgY29uc3QgY3VycmVudENvbnRleHRTdGF0ZSA9IGNvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCBpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdOyBcclxuXHJcbiAgICBjb25zdCBidXR0b25zQ29uZmlnID0gW1xyXG4gICAgICB7IG5hbWU6ICd3aXNobGlzdCcsIHRleHQ6ICfQltC10LvQsNGO0YInLCBhY3RpdmVDbGFzczogYCR7YnV0dG9uQ2xhc3N9LS1hY3RpdmVgLCBkYXRhQXR0cjogYGRhdGEtJHtjb250ZXh0fS13aXNobGlzdC1idG5gIH0sXHJcbiAgICAgIHsgbmFtZTogJ293bmVycycsIHRleHQ6ICfQktC70LDQtNC10Y7RgicsIGFjdGl2ZUNsYXNzOiBgJHtidXR0b25DbGFzc30tLWFjdGl2ZWAsIGRhdGFBdHRyOiBgZGF0YS0ke2NvbnRleHR9LW93bmVycy1idG5gIH1cclxuICAgIF07XHJcblxyXG4gICAgbGV0IG5leHRTaWJsaW5nRWxlbWVudCA9IG51bGw7XHJcbiAgICBpZiAoY29udGV4dCA9PT0gJ3RyYWRlT2ZmZXInKSB7XHJcbiAgICAgICAgY29uc3QgcG9zc2libGVCdXR0b25zID0gdGFyZ2V0RGl2LnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbiwgYS5idXR0b24sIC5idXR0b24nKTtcclxuICAgICAgICBuZXh0U2libGluZ0VsZW1lbnQgPSBBcnJheS5mcm9tKHBvc3NpYmxlQnV0dG9ucykuZmluZChlbCA9PiBlbC50ZXh0Q29udGVudC50cmltKCkuaW5jbHVkZXMoJ9CQ0L3QuNC80LjRgNC+0LLQsNC90L3Ri9C1JykpO1xyXG4gICAgfVxyXG5cclxuICAgIGJ1dHRvbnNDb25maWcuZm9yRWFjaCgoeyBuYW1lLCB0ZXh0LCBhY3RpdmVDbGFzcywgZGF0YUF0dHIgfSkgPT4ge1xyXG4gICAgICBjb25zdCBhbHdheXNTaG93U2V0dGluZyA9IG5hbWUgPT09ICd3aXNobGlzdCcgPyBzZXR0aW5ncy5hbHdheXNTaG93V2lzaGxpc3QgOiBzZXR0aW5ncy5hbHdheXNTaG93T3duZXJzO1xyXG4gICAgICBjb25zdCBleGlzdGluZ0J1dHRvbiA9IHRhcmdldERpdi5xdWVyeVNlbGVjdG9yKGBbJHtkYXRhQXR0cn1dYCk7XHJcblxyXG4gICAgICBsZXQgYnRuID0gZXhpc3RpbmdCdXR0b247IFxyXG5cclxuICAgICAgaWYgKCFidG4pIHtcclxuICAgICAgICBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICBidG4uY2xhc3NMaXN0LmFkZCguLi5idXR0b25DbGFzcy5zcGxpdCgnICcpLmZpbHRlcihCb29sZWFuKSwgYCR7Y29udGV4dH0tJHtuYW1lfS1idG5gKTtcclxuICAgICAgICBidG4uc2V0QXR0cmlidXRlKGRhdGFBdHRyLCAndHJ1ZScpO1xyXG4gICAgICAgIGJ0bi5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XHJcbiAgICAgICAgYnRuLnN0eWxlLnZlcnRpY2FsQWxpZ24gPSAnbWlkZGxlJztcclxuICAgICAgICBidG4uc3R5bGUudHJhbnNpdGlvbiA9ICdiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZSwgb3BhY2l0eSAwLjNzIGVhc2UnOyBcclxuICAgICAgICBidG4uc3R5bGUubWFyZ2luTGVmdCA9ICc1cHgnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIOKtkCDQlNCe0JHQkNCS0JvQr9CV0Jw6INCc0L7QsdC40LvRjNC90YvQtSDRgdGC0LjQu9C4INC00LvRjyDQutC90L7Qv9C+0LpcclxuICAgICAgICBpZiAoaXNNb2JpbGUpIHtcclxuICAgICAgICAgIGJ0bi5zdHlsZS5wYWRkaW5nID0gJzhweCAxMnB4JztcclxuICAgICAgICAgIGJ0bi5zdHlsZS5mb250U2l6ZSA9ICcxNHB4JztcclxuICAgICAgICAgIGJ0bi5zdHlsZS5taW5IZWlnaHQgPSAnMzZweCc7XHJcbiAgICAgICAgICBidG4uc3R5bGUubWluV2lkdGggPSAnOTBweCc7XHJcbiAgICAgICAgICBidG4uc3R5bGUubWFyZ2luID0gJzRweCc7XHJcbiAgICAgICAgICAvLyDQmtC+0YDQvtGC0LrQuNC1INGC0LXQutGB0YLRiyDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgICBjb25zdCBzaG9ydFRleHQgPSBuYW1lID09PSAnd2lzaGxpc3QnID8gJ9Cl0L7RgtGP0YInIDogJ9CS0LvQsNC00LXRjtGCJztcclxuICAgICAgICAgIGJ0bi50ZXh0Q29udGVudCA9IGFsd2F5c1Nob3dTZXR0aW5nID8gYCR7c2hvcnRUZXh0fSAo0LLRgdC10LPQtNCwKWAgOiBg0J/QvtC60LDQt9Cw0YLRjCAke3Nob3J0VGV4dC50b0xvd2VyQ2FzZSgpfWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobmV4dFNpYmxpbmdFbGVtZW50KSB7XHJcbiAgICAgICAgICAgICB0YXJnZXREaXYuaW5zZXJ0QmVmb3JlKGJ0biwgbmV4dFNpYmxpbmdFbGVtZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgdGFyZ2V0RGl2LmFwcGVuZENoaWxkKGJ0bik7IFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudFNldHRpbmdzQ2xpY2sgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudEFsd2F5c1Nob3cgPSBuYW1lID09PSAnd2lzaGxpc3QnID8gY3VycmVudFNldHRpbmdzQ2xpY2suYWx3YXlzU2hvd1dpc2hsaXN0IDogY3VycmVudFNldHRpbmdzQ2xpY2suYWx3YXlzU2hvd093bmVycztcclxuICAgICAgICAgIGlmIChjdXJyZW50QWx3YXlzU2hvdykgcmV0dXJuOyBcclxuXHJcbiAgICAgICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgYnRuLnRleHRDb250ZW50ID0gJy4uLic7XHJcblxyXG4gICAgICAgICAgaWYgKGNvbnRleHRTdGF0ZVtjb250ZXh0XSkge1xyXG4gICAgICAgICAgICAgIGNvbnRleHRTdGF0ZVtjb250ZXh0XVtuYW1lXSA9ICFjb250ZXh0U3RhdGVbY29udGV4dF1bbmFtZV07XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGNvbnRleHRTdGF0ZVtjb250ZXh0XSA9IHsgLi4uaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XSwgW25hbWVdOiAhaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XVtuYW1lXSB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgY29uc3QgaXNBY3RpdmUgPSBjb250ZXh0U3RhdGVbY29udGV4dF1bbmFtZV07IFxyXG5cclxuICAgICAgICAgIHVwZGF0ZUJ1dHRvbkFwcGVhcmFuY2UoYnRuLCBpc0FjdGl2ZSwgbmFtZSwgYWN0aXZlQ2xhc3MsIHRleHQsIGN1cnJlbnRBbHdheXNTaG93KTsgXHJcblxyXG4gICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdKTtcclxuICAgICAgICAgIHByb2Nlc3NDYXJkcyhjb250ZXh0LCBjdXJyZW50U2V0dGluZ3NDbGljaylcclxuICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBsb2dFcnJvcihgRXJyb3IgcHJvY2Vzc2luZyBjYXJkcyBhZnRlciAke25hbWV9IHRvZ2dsZSBpbiAke2NvbnRleHR9OmAsIGVycikpXHJcbiAgICAgICAgICAgIC5maW5hbGx5KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICB1cGRhdGVCdXR0b25BcHBlYXJhbmNlKGJ0biwgY29udGV4dFN0YXRlW2NvbnRleHRdPy5bbmFtZV0sIG5hbWUsIGFjdGl2ZUNsYXNzLCB0ZXh0LCBjdXJyZW50QWx3YXlzU2hvdyk7XHJcbiAgICAgICAgICAgICAgICAgbG9nKGAke2NvbnRleHR9OiBUb2dnbGVkICR7bmFtZX0gdmlzaWJpbGl0eTogJHtjb250ZXh0U3RhdGVbY29udGV4dF0/LltuYW1lXX1gKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB1cGRhdGVCdXR0b25BcHBlYXJhbmNlKGJ0biwgY3VycmVudENvbnRleHRTdGF0ZVtuYW1lXSwgbmFtZSwgYWN0aXZlQ2xhc3MsIHRleHQsIGFsd2F5c1Nob3dTZXR0aW5nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNob3VsZFByb2Nlc3NJbml0aWFsbHkgPSAoc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGN1cnJlbnRDb250ZXh0U3RhdGUud2lzaGxpc3QpIHx8IChzZXR0aW5ncy5hbHdheXNTaG93T3duZXJzIHx8IGN1cnJlbnRDb250ZXh0U3RhdGUub3duZXJzKTtcclxuICAgIGlmIChzaG91bGRQcm9jZXNzSW5pdGlhbGx5KSB7XHJcbiAgICAgIGxvZyhgaW5pdFN0YXRzQnV0dG9uczogSW5pdGlhbCBwcm9jZXNzaW5nIG5lZWRlZCBmb3IgJHtjb250ZXh0fS5gKTtcclxuICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdKTsgXHJcbiAgICAgIGF3YWl0IHByb2Nlc3NDYXJkcyhjb250ZXh0LCBzZXR0aW5ncyk7IFxyXG4gICAgfVxyXG59O1xyXG5cclxuY29uc3QgdXBkYXRlQnV0dG9uQXBwZWFyYW5jZSA9IChidG4sIGlzQWN0aXZlLCB0eXBlLCBhY3RpdmVDbGFzcywgZGVmYXVsdFRleHQsIGFsd2F5c1Nob3cpID0+IHtcclxuICAgIGlmICghYnRuKSByZXR1cm47IFxyXG4gICAgXHJcbiAgICAvLyDirZAg0JTQntCR0JDQktCb0K/QldCcOiDQntC/0YDQtdC00LXQu9GP0LXQvCDQvNC+0LHQuNC70YzQvdC+0LUg0YPRgdGC0YDQvtC50YHRgtCy0L5cclxuICAgIGNvbnN0IGlzTW9iaWxlID0gL0FuZHJvaWR8d2ViT1N8aVBob25lfGlQYWR8aVBvZHxCbGFja0JlcnJ5fElFTW9iaWxlfE9wZXJhIE1pbmkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xyXG4gICAgXHJcbiAgICBjb25zdCBsYWJlbCA9IHR5cGUgPT09ICd3aXNobGlzdCcgPyAn0JbQtdC70LDRjtGCJyA6ICfQktC70LDQtNC10Y7Rgic7XHJcbiAgICBjb25zdCBzaG9ydExhYmVsID0gdHlwZSA9PT0gJ3dpc2hsaXN0JyA/ICfQpdC+0YLRj9GCJyA6ICfQktC70LDQtNC10Y7Rgic7IC8vINCa0L7RgNC+0YLQutCw0Y8g0LLQtdGA0YHQuNGPINC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgIFxyXG4gICAgaWYgKGFsd2F5c1Nob3cpIHtcclxuICAgICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgIGJ0bi5zdHlsZS5vcGFjaXR5ID0gJzAuNyc7XHJcbiAgICAgICAgLy8g4q2QINCQ0JTQkNCf0KLQmNCg0KPQldCcOiDQotC10LrRgdGCINC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgICAgICBidG4udGV4dENvbnRlbnQgPSBpc01vYmlsZSA/IGAke3Nob3J0TGFiZWx9ICjQstGB0LXQs9C00LApYCA6IGAke2xhYmVsfSAo0LLRgdC10LPQtNCwKWA7XHJcbiAgICAgICAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoYWN0aXZlQ2xhc3MpOyBcclxuICAgICAgICBidG4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyc7XHJcbiAgICAgICAgYnRuLnN0eWxlLmNvbG9yID0gJyc7XHJcbiAgICAgICAgYnRuLnN0eWxlLmJvcmRlckNvbG9yID0gJyc7IFxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICBidG4uc3R5bGUub3BhY2l0eSA9ICcxJztcclxuICAgICAgICBpZiAoaXNBY3RpdmUpIHtcclxuICAgICAgICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoYWN0aXZlQ2xhc3MpO1xyXG4gICAgICAgICAgICBidG4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyM4ZTQ0YWQnOyBcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmNvbG9yID0gJyNGRkZGRkYnO1xyXG4gICAgICAgICAgICBidG4uc3R5bGUuYm9yZGVyQ29sb3IgPSAnIzhlNDRhZCc7XHJcbiAgICAgICAgICAgIC8vIOKtkCDQkNCU0JDQn9Ci0JjQoNCj0JXQnDog0KLQtdC60YHRgiDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgICAgIGJ0bi50ZXh0Q29udGVudCA9IGlzTW9iaWxlID8gYNCh0LrRgNGL0YLRjCAke3Nob3J0TGFiZWwudG9Mb3dlckNhc2UoKX1gIDogYNCh0LrRgNGL0YLRjCAke2xhYmVsLnRvTG93ZXJDYXNlKCl9YDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBidG4uY2xhc3NMaXN0LnJlbW92ZShhY3RpdmVDbGFzcyk7XHJcbiAgICAgICAgICAgIGJ0bi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcclxuICAgICAgICAgICAgYnRuLnN0eWxlLmNvbG9yID0gJyc7XHJcbiAgICAgICAgICAgIGJ0bi5zdHlsZS5ib3JkZXJDb2xvciA9ICcnO1xyXG4gICAgICAgICAgICAvLyDirZAg0JDQlNCQ0J/QotCY0KDQo9CV0Jw6INCi0LXQutGB0YIg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICAgICAgICBidG4udGV4dENvbnRlbnQgPSBpc01vYmlsZSA/IGDQn9C+0LrQsNC30LDRgtGMICR7c2hvcnRMYWJlbC50b0xvd2VyQ2FzZSgpfWAgOiBg0J/QvtC60LDQt9Cw0YLRjCAke2xhYmVsLnRvTG93ZXJDYXNlKCl9YDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5leHBvcnQgY29uc3QgaW5pdFBhY2tQYWdlID0gYXN5bmMgKCkgPT4ge1xyXG4gIGNvbnN0IHBhY2tDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubG9vdGJveF9faW5uZXInKTtcclxuICBpZiAoIXBhY2tDb250YWluZXIpIHtcclxuICAgIGxvZ1dhcm4oJ1BhY2tQYWdlOiBQYWNrIGNvbnRhaW5lciAoLmxvb3Rib3hfX2lubmVyKSBub3QgZm91bmQnKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRTZXR0aW5ncygpO1xyXG4gIGNvbnN0IGNvbnRleHQgPSAncGFjayc7XHJcbiAgY29uc3QgY3VycmVudFBhY2tTdGF0ZSA9IGNvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCBpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdO1xyXG5cclxuICBjb25zdCBwcm9jZXNzRXhpc3RpbmdDYXJkcyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKHNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCB8fCBjdXJyZW50UGFja1N0YXRlLndpc2hsaXN0KSB7XHJcbiAgICAgICAgICBjb25zdCBpbml0aWFsQ2FyZHMgPSBwYWNrQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoY29udGV4dHNTZWxlY3RvcnMucGFjayk7XHJcbiAgICAgICAgICBpZiAoaW5pdGlhbENhcmRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICBjYWNoZWRFbGVtZW50cy5kZWxldGUoY29udGV4dHNTZWxlY3RvcnMucGFjayk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgcHJvY2Vzc0NhcmRzKCdwYWNrJywgc2V0dGluZ3MpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgIGNvbnN0IGV4aXN0aW5nTGFiZWxzID0gcGFja0NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcud2lzaGxpc3Qtd2FybmluZywgLm93bmVycy1jb3VudCcpO1xyXG4gICAgICAgICAgIGV4aXN0aW5nTGFiZWxzLmZvckVhY2gobGFiZWwgPT4gbGFiZWwucmVtb3ZlKCkpO1xyXG4gICAgICB9XHJcbiAgfTtcclxuXHJcbiAgYXdhaXQgcHJvY2Vzc0V4aXN0aW5nQ2FyZHMoKTtcclxuXHJcbiAgY29uc3Qgb2JzZXJ2ZXJDYWxsYmFjayA9IGRlYm91bmNlKGFzeW5jIChtdXRhdGlvbnMpID0+IHtcclxuICAgICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7XHJcbiAgICAgICAgICBsb2dXYXJuKCdQYWNrUGFnZTogT2JzZXJ2ZXIgY2FsbGJhY2sgc2tpcHBlZCwgZXh0ZW5zaW9uIGNvbnRleHQgbG9zdC4nKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBsZXQgY2FyZHNDaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgbXV0YXRpb24gb2YgbXV0YXRpb25zKSB7XHJcbiAgICAgICAgICBpZiAobXV0YXRpb24udHlwZSA9PT0gJ2NoaWxkTGlzdCcpIHtcclxuICAgICAgICAgICAgICBpZiAoQXJyYXkuZnJvbShtdXRhdGlvbi5hZGRlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5ub2RlVHlwZSA9PT0gMSAmJiBub2RlLm1hdGNoZXM/Lihjb250ZXh0c1NlbGVjdG9ycy5wYWNrKSkgfHxcclxuICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShtdXRhdGlvbi5yZW1vdmVkTm9kZXMpLnNvbWUobm9kZSA9PiBub2RlLm5vZGVUeXBlID09PSAxICYmIG5vZGUubWF0Y2hlcz8uKGNvbnRleHRzU2VsZWN0b3JzLnBhY2spKSkge1xyXG4gICAgICAgICAgICAgICAgICBjYXJkc0NoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgaWYgKEFycmF5LmZyb20obXV0YXRpb24uYWRkZWROb2Rlcykuc29tZShub2RlID0+IG5vZGUubm9kZVR5cGUgPT09IDEgJiYgbm9kZS5xdWVyeVNlbGVjdG9yPy4oY29udGV4dHNTZWxlY3RvcnMucGFjaykpIHx8XHJcbiAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20obXV0YXRpb24ucmVtb3ZlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5ub2RlVHlwZSA9PT0gMSAmJiBub2RlLnF1ZXJ5U2VsZWN0b3I/Lihjb250ZXh0c1NlbGVjdG9ycy5wYWNrKSkpIHtcclxuICAgICAgICAgICAgICAgICAgIGNhcmRzQ2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgfSBlbHNlIGlmIChtdXRhdGlvbi50eXBlID09PSAnYXR0cmlidXRlcycgJiYgKG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUgPT09ICdkYXRhLWlkJyB8fCBtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lID09PSAnY2xhc3MnKSAmJiBtdXRhdGlvbi50YXJnZXQubWF0Y2hlcz8uKGNvbnRleHRzU2VsZWN0b3JzLnBhY2spKSB7XHJcbiAgICAgICAgICAgICAgY2FyZHNDaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKGNhcmRzQ2hhbmdlZCkge1xyXG4gICAgICAgICAgY29uc3QgY3VycmVudFNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTsgXHJcbiAgICAgICAgICBjb25zdCBjdXJyZW50UGFja1N0YXRlVXBkYXRlZCA9IGNvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCBpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdOyBcclxuICAgICAgICAgIGNvbnN0IHNob3VsZFNob3dMYWJlbHMgPSBjdXJyZW50U2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGN1cnJlbnRQYWNrU3RhdGVVcGRhdGVkLndpc2hsaXN0O1xyXG5cclxuICAgICAgICAgIGlmIChzaG91bGRTaG93TGFiZWxzKSB7XHJcbiAgICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLnBhY2spO1xyXG4gICAgICAgICAgICAgIGF3YWl0IHByb2Nlc3NDYXJkcyhjb250ZXh0LCBjdXJyZW50U2V0dGluZ3MpOyBcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgY2FyZEl0ZW1zID0gZ2V0RWxlbWVudHMoY29udGV4dHNTZWxlY3RvcnMucGFjayk7XHJcbiAgICAgICAgICAgICAgY2FyZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIGl0ZW0ucXVlcnlTZWxlY3RvcignLndpc2hsaXN0LXdhcm5pbmcnKT8ucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICAgIGl0ZW0ucXVlcnlTZWxlY3RvcignLm93bmVycy1jb3VudCcpPy5yZW1vdmUoKTsgXHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgIH1cclxuICB9LCAzMDApOyBcclxuXHJcbiAgaWYgKCFwYWNrQ29udGFpbmVyLl9leHRlbnNpb25PYnNlcnZlcikge1xyXG4gICAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKG9ic2VydmVyQ2FsbGJhY2spO1xyXG4gICAgICBvYnNlcnZlci5vYnNlcnZlKHBhY2tDb250YWluZXIsIHtcclxuICAgICAgICAgIGNoaWxkTGlzdDogdHJ1ZSwgXHJcbiAgICAgICAgICBzdWJ0cmVlOiB0cnVlLCAgIFxyXG4gICAgICAgICAgYXR0cmlidXRlczogdHJ1ZSwgXHJcbiAgICAgICAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS1pZCcsICdjbGFzcyddIFxyXG4gICAgICB9KTtcclxuICAgICAgcGFja0NvbnRhaW5lci5fZXh0ZW5zaW9uT2JzZXJ2ZXIgPSBvYnNlcnZlcjsgXHJcbiAgICAgIGxvZygnUGFja1BhZ2U6IFNldHVwIG9ic2VydmVyIGZvciBwYWNrIGNvbnRhaW5lcicpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAgICBsb2dXYXJuKCdQYWNrUGFnZTogT2JzZXJ2ZXIgYWxyZWFkeSBleGlzdHMgZm9yIHBhY2sgY29udGFpbmVyLicpO1xyXG4gIH1cclxufTsiLCJpbXBvcnQgeyBsb2csIGxvZ1dhcm4sIGxvZ0Vycm9yIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcblxyXG5leHBvcnQgY29uc3QgYWRkVGV4dExhYmVsID0gKGNvbnRhaW5lciwgY2xhc3NOYW1lLCB0ZXh0LCB0aXRsZSwgcG9zaXRpb24sIHR5cGUsIG9wdGlvbnMgPSB7fSwgY29udGV4dCkgPT4ge1xyXG4gIGlmICghY29udGFpbmVyIHx8ICEoY29udGFpbmVyIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XHJcbiAgICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIHRyeSB7XHJcbiAgICAvLyDirZAg0JTQntCR0JDQktCY0KLQrDog0J7Qv9GA0LXQtNC10LvQtdC90LjQtSDQvNC+0LHQuNC70YzQvdC+0LPQviDRg9GB0YLRgNC+0LnRgdGC0LLQsFxyXG4gICAgY29uc3QgaXNNb2JpbGUgPSAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbiAgICBcclxuICAgIGNvbnN0IGV4aXN0aW5nTGFiZWwgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcihgLiR7Y2xhc3NOYW1lfWApO1xyXG4gICAgaWYgKGV4aXN0aW5nTGFiZWwpIGV4aXN0aW5nTGFiZWwucmVtb3ZlKCk7XHJcblxyXG4gICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBkaXYuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xyXG4gICAgZGl2LnRpdGxlID0gdGl0bGU7XHJcblxyXG4gICAgY29uc3Qgc3ZnSWNvbkNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIHN2Z0ljb25Db250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtZmxleCc7XHJcbiAgICBzdmdJY29uQ29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSAnY2VudGVyJztcclxuXHJcbiAgICBsZXQgc3ZnU3RyaW5nID0gJyc7XHJcbiAgICAvLyDirZAg0KPQktCV0JvQmNCn0JjQotCsOiDQmNC60L7QvdC60Lgg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgY29uc3QgaWNvblNpemUgPSBpc01vYmlsZSA/ICcxNCcgOiAnMTInO1xyXG4gICAgXHJcbiAgICBpZiAodHlwZSA9PT0gJ3dpc2hsaXN0Jykge1xyXG4gICAgICBzdmdTdHJpbmcgPSBgXHJcbiAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiJHtpY29uU2l6ZX1cIiBoZWlnaHQ9XCIke2ljb25TaXplfVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBtaWRkbGU7XCI+XHJcbiAgICAgICAgICA8cGF0aCBkPVwiTTEyIDIxLjM1bC0xLjQ1LTEuMzJDNS40IDE1LjM2IDIgMTIuMjggMiA4LjUgMiA1LjQyIDQuNDIgMyA3LjUgM2MxLjc0IDAgMy40MS44MSA0LjUgMi4wOUMxMy4wOSAzLjgxIDE0Ljc2IDMgMTYuNSAzIDE5LjU4IDMgMjIgNS40MiAyMiA4LjVjMCAzLjc4LTMuNCA2Ljg2LTguNTUgMTEuNTRMMTIgMjEuMzV6XCIvPlxyXG4gICAgICAgIDwvc3ZnPmA7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdvd25lcnMnKSB7XHJcbiAgICAgIHN2Z1N0cmluZyA9IGBcclxuICAgICAgICA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCIke2ljb25TaXplfVwiIGhlaWdodD1cIiR7aWNvblNpemV9XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIHN0eWxlPVwidmVydGljYWwtYWxpZ246IG1pZGRsZTtcIj5cclxuICAgICAgICAgIDxwYXRoIGQ9XCJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6XCIvPlxyXG4gICAgICAgIDwvc3ZnPmA7XHJcbiAgICB9XHJcbiAgICBzdmdJY29uQ29udGFpbmVyLmlubmVySFRNTCA9IHN2Z1N0cmluZztcclxuXHJcbiAgICBjb25zdCB0ZXh0U3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIHRleHRTcGFuLnRleHRDb250ZW50ID0gdGV4dDtcclxuICAgIHRleHRTcGFuLnN0eWxlLmxpbmVIZWlnaHQgPSAnMSc7XHJcblxyXG4gICAgZGl2LmFwcGVuZENoaWxkKHN2Z0ljb25Db250YWluZXIpO1xyXG4gICAgZGl2LmFwcGVuZENoaWxkKHRleHRTcGFuKTtcclxuXHJcbiAgICBjb25zdCBpc1VzZXJDYXJkcyA9IGNvbnRleHQgPT09ICd1c2VyQ2FyZHMnO1xyXG4gICAgY29uc3QgaXNEZWNrVmlldyA9IGNvbnRleHQgPT09ICdkZWNrVmlldyc7XHJcbiAgICBcclxuICAgIC8vIOKtkCDQkNCU0JDQn9Ci0JjQoNCe0JLQkNCi0Kw6INCf0L7Qt9C40YbQuNC+0L3QuNGA0L7QstCw0L3QuNC1INC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgIGNvbnN0IHBvc2l0aW9uU3R5bGUgPSBpc1VzZXJDYXJkcyA/ICdsZWZ0OiA1cHg7JyA6ICdyaWdodDogNXB4Oyc7XHJcbiAgICBcclxuICAgIC8vIOKtkCDQmNCX0JzQldCd0JjQotCsOiDQkdC+0LvRjNGI0LjQuSDQvtGC0YHRgtGD0L8g0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgbGV0IHRvcFBvc2l0aW9uO1xyXG4gICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgIC8vINCd0LAg0LzQvtCx0LjQu9GM0L3Ri9GFINC40YHQv9C+0LvRjNC30YPQtdC8INGE0LjQutGB0LjRgNC+0LLQsNC90L3Ri9C1INC/0L7Qt9C40YbQuNC4XHJcbiAgICAgIGlmIChwb3NpdGlvbiA9PT0gJ3RvcCcpIHtcclxuICAgICAgICB0b3BQb3NpdGlvbiA9ICc4cHgnO1xyXG4gICAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAnbWlkZGxlJykge1xyXG4gICAgICAgIHRvcFBvc2l0aW9uID0gJzM1cHgnO1xyXG4gICAgICB9IGVsc2UgaWYgKHBvc2l0aW9uID09PSAnYm90dG9tJykge1xyXG4gICAgICAgIHRvcFBvc2l0aW9uID0gJzYwcHgnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRvcFBvc2l0aW9uID0gJzhweCc7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vINCd0LAg0LTQtdGB0LrRgtC+0L/QtSAtINC+0YDQuNCz0LjQvdCw0LvRjNC90YvQtSDQt9C90LDRh9C10L3QuNGPXHJcbiAgICAgIHRvcFBvc2l0aW9uID0gKHBvc2l0aW9uID09PSAndG9wJykgPyAnNXB4JyA6ICcyNXB4JztcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8g4q2QINCQ0JTQkNCf0KLQmNCS0J3Qq9CVINCh0KLQmNCb0JhcclxuICAgIGNvbnN0IGZvbnRTaXplID0gaXNNb2JpbGUgPyAnMTRweCcgOiAnMTJweCc7XHJcbiAgICBjb25zdCBwYWRkaW5nID0gaXNNb2JpbGUgPyAnNnB4IDEwcHgnIDogJzJweCA1cHgnO1xyXG4gICAgY29uc3QgYm9yZGVyUmFkaXVzID0gaXNNb2JpbGUgPyAnNnB4JyA6ICczcHgnO1xyXG4gICAgY29uc3QgYmFja2dyb3VuZENvbG9yID0gaXNNb2JpbGUgPyAncmdiYSgwLCAwLCAwLCAwLjg1KScgOiAncmdiYSgwLCAwLCAwLCAwLjcpJztcclxuICAgIGNvbnN0IG1pbkhlaWdodCA9IGlzTW9iaWxlID8gJzMycHgnIDogJ2F1dG8nO1xyXG4gICAgY29uc3QgbWluV2lkdGggPSBpc01vYmlsZSA/ICc0MHB4JyA6ICdhdXRvJztcclxuICAgIGNvbnN0IHpJbmRleCA9IGlzTW9iaWxlID8gJzEwMDAnIDogJzEwJztcclxuICAgIFxyXG4gICAgY29uc3QgZGVja1ZpZXdTdHlsZXMgPSBpc0RlY2tWaWV3ID8gYFxyXG4gICAgICB6LWluZGV4OiAxMDAwO1xyXG4gICAgICBmb250LXNpemU6IDE0cHg7XHJcbiAgICAgIHBhZGRpbmc6IDNweCA2cHg7XHJcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMCwgMCwgMCwgMC44KTtcclxuICAgICAgYm9yZGVyOiAxcHggc29saWQgJHtvcHRpb25zLmNvbG9yIHx8ICcjRkZGRkZGJ307XHJcbiAgICBgIDogJyc7XHJcblxyXG4gICAgLy8g4q2QINCe0KHQndCe0JLQndCr0JUg0KHQotCY0JvQmCDQoSDQkNCU0JDQn9Ci0JDQptCY0JXQmVxyXG4gICAgZGl2LnN0eWxlLmNzc1RleHQgPSBgXHJcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcclxuICAgICAgdG9wOiAke3RvcFBvc2l0aW9ufTtcclxuICAgICAgJHtwb3NpdGlvblN0eWxlfVxyXG4gICAgICBjb2xvcjogJHtvcHRpb25zLmNvbG9yIHx8ICcjRkZGRkZGJ307XHJcbiAgICAgIGZvbnQtc2l6ZTogJHtmb250U2l6ZX07XHJcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICR7YmFja2dyb3VuZENvbG9yfTtcclxuICAgICAgcGFkZGluZzogJHtwYWRkaW5nfTtcclxuICAgICAgYm9yZGVyLXJhZGl1czogJHtib3JkZXJSYWRpdXN9O1xyXG4gICAgICB6LWluZGV4OiAke3pJbmRleH07XHJcbiAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XHJcbiAgICAgIGdhcDogNHB4O1xyXG4gICAgICBtaW4taGVpZ2h0OiAke21pbkhlaWdodH07XHJcbiAgICAgIG1pbi13aWR0aDogJHttaW5XaWR0aH07XHJcbiAgICAgICR7ZGVja1ZpZXdTdHlsZXN9XHJcbiAgICAgICR7aXNNb2JpbGUgPyAnYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwwLDAsMC4zKTsnIDogJyd9XHJcbiAgICAgICR7aXNNb2JpbGUgPyAnLXdlYmtpdC10YXAtaGlnaGxpZ2h0LWNvbG9yOiB0cmFuc3BhcmVudDsnIDogJyd9XHJcbiAgICBgO1xyXG5cclxuICAgIC8vIOKtkCDQlNCe0JHQkNCS0JjQotCsOiDQodC/0LXRhtC40LDQu9GM0L3Ri9C1INGB0YLQuNC70Lgg0LTQu9GPINGA0LDQt9C90YvRhSDQutC+0L3RgtC10LrRgdGC0L7QsiDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgIGlmIChjb250ZXh0ID09PSAndXNlckNhcmRzJykge1xyXG4gICAgICAgIC8vINCU0LvRjyDQutCw0YDRgtC+0YfQtdC6INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjyDQtNC10LvQsNC10Lwg0LzQtdGC0LrQuCDRgdC70LXQstCwXHJcbiAgICAgICAgZGl2LnN0eWxlLmxlZnQgPSAnOHB4JztcclxuICAgICAgICBkaXYuc3R5bGUucmlnaHQgPSAnYXV0byc7XHJcbiAgICAgIH0gZWxzZSBpZiAoY29udGV4dCA9PT0gJ3BhY2snKSB7XHJcbiAgICAgICAgLy8g0JTQu9GPINC+0YLQutGA0YvRgtC40Y8g0L/QsNC60L7QsiDQtNC10LvQsNC10Lwg0LzQtdGC0LrQuCDQsdC+0LvQtdC1INC30LDQvNC10YLQvdGL0LzQuFxyXG4gICAgICAgIGRpdi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgwLCAwLCAwLCAwLjkpJztcclxuICAgICAgICBkaXYuc3R5bGUuYm9yZGVyID0gYDFweCBzb2xpZCAke29wdGlvbnMuY29sb3IgfHwgJyNGRkZGRkYnfWA7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIOKtkCDQo9CS0JXQm9CY0KfQmNCS0JDQldCcINCe0JHQm9CQ0KHQotCsINCa0JDQodCQ0J3QmNCvXHJcbiAgICAgIGRpdi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5zdHlsZS5vcGFjaXR5ID0gJzAuOCc7XHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgZGl2LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5zdHlsZS5vcGFjaXR5ID0gJzEnO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNEZWNrVmlldykge1xyXG4gICAgICAgICBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICAgaWYgKGdldENvbXB1dGVkU3R5bGUoY29udGFpbmVyKS5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcclxuICAgICAgICAgICAgIGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XHJcbiAgICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgIFxyXG4gICAgLy8g4q2QINCU0J7QkdCQ0JLQmNCi0Kw6INCb0L7Qs9C40YDQvtCy0LDQvdC40LUg0LTQu9GPINC+0YLQu9Cw0LTQutC4XHJcbiAgICBpZiAoaXNNb2JpbGUpIHtcclxuICAgICAgbG9nKGBBZGRlZCBtb2JpbGUgbGFiZWwgXCIke2NsYXNzTmFtZX1cIiB3aXRoIHNpemUgJHtmb250U2l6ZX0gYXQgJHt0b3BQb3NpdGlvbn1gKTtcclxuICAgIH1cclxuXHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgbG9nRXJyb3IoYEVycm9yIGFkZGluZyBsYWJlbCBcIiR7Y2xhc3NOYW1lfVwiIGluIGNvbnRleHQgXCIke2NvbnRleHR9XCI6YCwgZXJyb3IpO1xyXG4gICAgICAvLyDirZAg0J3QlSDQm9Ce0JPQmNCg0KPQldCcINCS0JXQodCsIENPTlRBSU5FUiDQndCQINCc0J7QkdCY0JvQrNCd0KvQpVxyXG4gICAgICBpZiAoIS9BbmRyb2lkfHdlYk9TfGlQaG9uZXxpUGFkfGlQb2R8QmxhY2tCZXJyeXxJRU1vYmlsZXxPcGVyYSBNaW5pL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkge1xyXG4gICAgICAgIGxvZ0Vycm9yKCdDb250YWluZXI6JywgY29udGFpbmVyKTtcclxuICAgICAgfVxyXG4gIH1cclxufTtcclxuXHJcblxyXG5leHBvcnQgY29uc3QgYWRkRXh0ZW5zaW9uU2V0dGluZ3NCdXR0b24gPSAoKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZHJvcGRvd25fX2NvbnRlbnQgLm1lbnUtLXByb2ZpbGUnKTtcclxuICAgIGlmICghbWVudSB8fCBtZW51LnF1ZXJ5U2VsZWN0b3IoJy5tZW51X19pdGVtLS1leHRlbnNpb24tc2V0dGluZ3MnKSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICAvLyDirZAg0JTQntCR0JDQktCY0KLQrDog0J7Qv9GA0LXQtNC10LvQtdC90LjQtSDQvNC+0LHQuNC70YzQvdC+0LPQviDRg9GB0YLRgNC+0LnRgdGC0LLQsFxyXG4gICAgY29uc3QgaXNNb2JpbGUgPSAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbiAgICBcclxuICAgIGNvbnN0IHNldHRpbmdzQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgc2V0dGluZ3NCdXR0b24uY2xhc3NMaXN0LmFkZCgnbWVudV9faXRlbScsICdtZW51X19pdGVtLS1leHRlbnNpb24tc2V0dGluZ3MnKTtcclxuICAgIHNldHRpbmdzQnV0dG9uLnRhcmdldCA9ICdfYmxhbmsnO1xyXG4gICAgc2V0dGluZ3NCdXR0b24uaHJlZiA9IGNocm9tZS5ydW50aW1lLmdldFVSTCgnaW50ZXJmYWNlLmh0bWwnKTtcclxuICAgIFxyXG4gICAgLy8g4q2QINCQ0JTQkNCf0KLQmNCg0J7QktCQ0KLQrDog0KDQsNC30LzQtdGAINC40LrQvtC90LrQuCDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICBjb25zdCBpY29uU2l6ZSA9IGlzTW9iaWxlID8gJzE4JyA6ICcxNic7XHJcbiAgICBjb25zdCBpY29uTWFyZ2luID0gaXNNb2JpbGUgPyAnMTBweCcgOiAnOHB4JztcclxuICAgIGNvbnN0IGZvbnRTaXplID0gaXNNb2JpbGUgPyAnMTZweCcgOiAnaW5oZXJpdCc7XHJcbiAgICBcclxuICAgIHNldHRpbmdzQnV0dG9uLmlubmVySFRNTCA9IGBcclxuICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHdpZHRoPVwiJHtpY29uU2l6ZX1cIiBoZWlnaHQ9XCIke2ljb25TaXplfVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBtaWRkbGU7IG1hcmdpbi1yaWdodDogJHtpY29uTWFyZ2lufTtcIj5cclxuICAgICAgICA8cGF0aCBkPVwiTTE5LjQzIDEyLjk4Yy4wNC0uMzIuMDctLjY0LjA3LS45OHMtLjAzLS42Ni0uMDctLjk4bDIuMTEtMS42NWMuMTktLjE1LjI0LS40Mi4xMi0uNjRsLTItMy40NmMtLjEyLS4yMi0uMzktLjMtLjYxLS4yMmwtMi40OSAxYy0uNTItLjQtMS4wOC0uNzMtMS42OS0uOThsLS4zOC0yLjY1QzE0LjQ2IDIuMTggMTQuMjUgMiAxNCAyaC00Yy0uMjUgMC0uNDYuMTgtLjQ5LjQybC0uMzggMi42NWMtLjYxLjI1LTEuMTcuNTktMS42OS45OGwtMi40OS0xYy0uMjMtLjA4LS40OSAwLS42MS4yMmwtMiAzLjQ2Yy0uMTMuMjItLjA3LjQ5LjEyLjY0bDIuMTEgMS42NWMtLjA0LjMyLS4wNy42NS0uMDcuOThzLjAzLjY2LjA3Ljk4bC0yLjExIDEuNjVjLS4xOS4xNS0uMjQuNDItLjEyLjY0bDIgMy40NmMuMTIuMjIuMzkuMy42MS4yMmwyLjQ5LTFjLjUyLjQgMS4wOC43MyAxLjY5Ljk4bC4zOCAyLjY1Yy4wMy4yNC4yNC40Mi40OS40Mmg0Yy4yNSAwIC40Ni0uMTguNDktLjQybC4zOC0yLjY1Yy42MS0uMjUgMS4xNy0uNTkgMS42OS0uOThsMi40OSAxYy4yMy4wOC40OSAwIC42MS0uMjJsMi0zLjQ2Yy4xMi0uMjIuMDctLjQ5LS4xMi0uNjRsLTIuMTEtMS42NXpNMTIgMTUuNWMtMS45MyAwLTMuNS0xLjU3LTMuNS0zLjVzMS41Ny0zLjUgMy41LTMuNSAzLjUgMS41NyAzLjUgMy41LTEuNTcgMy41LTMuNSAzLjV6XCIvPlxyXG4gICAgICA8L3N2Zz5cclxuICAgICAg0J3QsNGB0YLRgNC+0LnQutC4INGA0LDRgdGI0LjRgNC10L3QuNGPYDtcclxuICAgIFxyXG4gICAgLy8g4q2QINCU0J7QkdCQ0JLQmNCi0Kw6INCh0YLQuNC70Lgg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgIHNldHRpbmdzQnV0dG9uLnN0eWxlLmZvbnRTaXplID0gZm9udFNpemU7XHJcbiAgICAgIHNldHRpbmdzQnV0dG9uLnN0eWxlLnBhZGRpbmcgPSAnMTJweCAxNnB4JztcclxuICAgICAgc2V0dGluZ3NCdXR0b24uc3R5bGUubWluSGVpZ2h0ID0gJzQ4cHgnO1xyXG4gICAgICBzZXR0aW5nc0J1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gICAgICBzZXR0aW5nc0J1dHRvbi5zdHlsZS5hbGlnbkl0ZW1zID0gJ2NlbnRlcic7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIG1lbnUuYXBwZW5kQ2hpbGQoc2V0dGluZ3NCdXR0b24pO1xyXG4gICAgbG9nKGBBZGRlZCBleHRlbnNpb24gc2V0dGluZ3MgYnV0dG9uICR7aXNNb2JpbGUgPyAnKG1vYmlsZSBhZGFwdGVkKScgOiAnJ31gKTtcclxuICAgIFxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBhZGRpbmcgc2V0dGluZ3MgYnV0dG9uOicsIGVycm9yKTtcclxuICB9XHJcbn07XHJcblxyXG4vLyDirZAg0JTQntCR0JDQktCY0KLQrDog0J3QvtCy0YPRjiDRhNGD0L3QutGG0LjRjiDQtNC70Y8g0LzQvtCx0LjQu9GM0L3QvtC5INC+0L/RgtC40LzQuNC30LDRhtC40LhcclxuZXhwb3J0IGNvbnN0IGFkZE1vYmlsZU9wdGltaXphdGlvbnMgPSAoKSA9PiB7XHJcbiAgY29uc3QgaXNNb2JpbGUgPSAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbiAgXHJcbiAgaWYgKCFpc01vYmlsZSkgcmV0dXJuO1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICAvLyDQn9GA0LXQtNC+0YLQstGA0LDRidCw0LXQvCDQt9GD0Lwg0L/RgNC4INC00LLQvtC50L3QvtC8INGC0LDQv9C1INC90LAg0LzQtdGC0LrQsNGFXHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgaWYgKGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3dpc2hsaXN0LXdhcm5pbmcnKSB8fCBcclxuICAgICAgICAgIGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ293bmVycy1jb3VudCcpKSB7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgfVxyXG4gICAgfSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcclxuICAgIFxyXG4gICAgbG9nKCdBcHBsaWVkIG1vYmlsZSB0b3VjaCBvcHRpbWl6YXRpb25zJyk7XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGxvZ0Vycm9yKCdFcnJvciBhcHBseWluZyBtb2JpbGUgb3B0aW1pemF0aW9uczonLCBlcnJvcik7XHJcbiAgfVxyXG59OyIsImltcG9ydCB7IExPR19QUkVGSVgsIGluaXRpYWxDb250ZXh0U3RhdGUsIGNvbnRleHRzU2VsZWN0b3JzLCBnZXRDdXJyZW50Q29udGV4dCB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGxvZywgbG9nV2FybiwgbG9nRXJyb3IsIGNhY2hlZEVsZW1lbnRzLCBkZWJvdW5jZSwgd2FpdEZvckVsZW1lbnRzIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7IHNldENzcmZUb2tlbiwgY3NyZlRva2VuLCBwZW5kaW5nUmVxdWVzdHMgfSBmcm9tICcuL2FwaS5qcyc7XHJcbmltcG9ydCB7IGdldFNldHRpbmdzIH0gZnJvbSAnLi9zZXR0aW5ncy5qcyc7XHJcbmltcG9ydCB7IGFkZEV4dGVuc2lvblNldHRpbmdzQnV0dG9uIH0gZnJvbSAnLi9kb21VdGlscy5qcyc7XHJcbmltcG9ydCB7IHByb2Nlc3NDYXJkcyB9IGZyb20gJy4vY2FyZFByb2Nlc3Nvci5qcyc7XHJcbmltcG9ydCB7IGluaXRVc2VyQ2FyZHMsIGhhbmRsZU1hcmtldENyZWF0ZVBhZ2UsIGluaXRTdGF0c0J1dHRvbnMsIGluaXRQYWNrUGFnZSB9IGZyb20gJy4vY29udGV4dEhhbmRsZXJzLmpzJztcclxuaW1wb3J0IHsgc2V0dXBPYnNlcnZlciB9IGZyb20gJy4vb2JzZXJ2ZXIuanMnO1xyXG5pbXBvcnQgeyBzdGFydE1pbmluZ1Byb2Nlc3MgfSBmcm9tICcuL21pbmVIYW5kbGVyLmpzJztcclxuXHJcbmV4cG9ydCBsZXQgY29udGV4dFN0YXRlID0ge307XHJcbmxldCBjdXJyZW50T2JzZXJ2ZXIgPSBudWxsO1xyXG5cclxuLy8g4q2QINCU0J7QkdCQ0JLQmNCi0Kw6INCe0L/RgNC10LTQtdC70LXQvdC40LUg0LzQvtCx0LjQu9GM0L3QvtCz0L4g0YPRgdGC0YDQvtC50YHRgtCy0LBcclxuY29uc3QgaXNNb2JpbGUgPSAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcblxyXG5jb25zdCBjbGVhbnVwRXh0ZW5zaW9uRmVhdHVyZXMgPSAoKSA9PiB7XHJcbiAgICBsb2coJ0NsZWFuaW5nIHVwIGV4dGVuc2lvbiBmZWF0dXJlcy4uLicpO1xyXG5cclxuICAgIGlmIChjdXJyZW50T2JzZXJ2ZXIpIHtcclxuICAgICAgICBjdXJyZW50T2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgIGN1cnJlbnRPYnNlcnZlciA9IG51bGw7XHJcbiAgICAgICAgbG9nKCdPYnNlcnZlciBkaXNjb25uZWN0ZWQuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2F1dG8tbWluZS1jb3VudGVyJyk/LnJlbW92ZSgpO1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLndpc2hsaXN0LXRvZ2dsZS1idG4nKT8ucmVtb3ZlKCk7XHJcbiAgICBcclxuICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQo9C00LDQu9GP0LXQvCDQvNC+0LHQuNC70YzQvdGL0LUg0LrQvdC+0L/QutC4INGB0L7Qt9C00LDQvdC40Y8g0LvQvtGC0LBcclxuICAgIGlmIChpc01vYmlsZSkge1xyXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb2JpbGUtY3JlYXRlLWxvdC1idG4nKS5mb3JFYWNoKGJ0biA9PiBidG4ucmVtb3ZlKCkpO1xyXG4gICAgICAgIGxvZygnUmVtb3ZlZCBtb2JpbGUgY3JlYXRlLWxvdCBidXR0b25zLicpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBzdGF0QnV0dG9uU2VsZWN0b3JzID0gW1xyXG4gICAgICAgICcudHJhZGVPZmZlci13aXNobGlzdC1idG4nLCAnLnRyYWRlT2ZmZXItb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5yZW1lbHQtd2lzaGxpc3QtYnRuJywgJy5yZW1lbHQtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXQtd2lzaGxpc3QtYnRuJywgJy5tYXJrZXQtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5zcGxpdC13aXNobGlzdC1idG4nLCAnLnNwbGl0LW93bmVycy1idG4nLFxyXG4gICAgICAgICcuZGVja0NyZWF0ZS13aXNobGlzdC1idG4nLCAnLmRlY2tDcmVhdGUtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXRDcmVhdGUtd2lzaGxpc3QtYnRuJywgJy5tYXJrZXRDcmVhdGUtb3duZXJzLWJ0bicsXHJcbiAgICAgICAgJy5tYXJrZXRSZXF1ZXN0Q3JlYXRlLXdpc2hsaXN0LWJ0bicsICcubWFya2V0UmVxdWVzdENyZWF0ZS1vd25lcnMtYnRuJyxcclxuICAgIF07XHJcbiAgICBzdGF0QnV0dG9uU2VsZWN0b3JzLmZvckVhY2goc2VsZWN0b3IgPT4ge1xyXG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpLmZvckVhY2goYnRuID0+IGJ0bi5yZW1vdmUoKSk7XHJcbiAgICB9KTtcclxuICAgIGxvZygnUmVtb3ZlZCBkeW5hbWljIGJ1dHRvbnMuJyk7XHJcblxyXG4gICAgY29uc3Qgb2xkTGFiZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLndpc2hsaXN0LXdhcm5pbmcsIC5vd25lcnMtY291bnQnKTtcclxuICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgIGxvZyhgUmVtb3ZlZCAke29sZExhYmVscy5sZW5ndGh9IGxhYmVscy5gKTtcclxuXHJcbiAgICBjYWNoZWRFbGVtZW50cy5jbGVhcigpO1xyXG4gICAgbG9nKCdDbGVhcmVkIGNhY2hlZCBlbGVtZW50cy4nKTtcclxuXHJcbn07XHJcblxyXG5jb25zdCBpbml0aWFsaXplT2JzZXJ2ZXIgPSAoY29udGV4dCkgPT4ge1xyXG4gICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQndCwINC80L7QsdC40LvRjNC90YvRhSDQvNC+0LbQvdC+INC+0YLQutC70Y7Rh9C40YLRjCBvYnNlcnZlciDQtNC70Y8g0L3QtdC60L7RgtC+0YDRi9GFINC60L7QvdGC0LXQutGB0YLQvtCyXHJcbiAgICAgaWYgKGlzTW9iaWxlICYmIFsncGFjaycsICdtYXJrZXRSZXF1ZXN0VmlldycsICdtaW5lUGFnZScsICd1c2VyQ2FyZHMnXS5pbmNsdWRlcyhjb250ZXh0KSkge1xyXG4gICAgICAgICBsb2coYFNraXBwaW5nIG9ic2VydmVyIGZvciAke2NvbnRleHR9IG9uIG1vYmlsZSBkZXZpY2VgKTtcclxuICAgICAgICAgcmV0dXJuO1xyXG4gICAgIH1cclxuICAgICBcclxuICAgICBpZiAoY29udGV4dCAhPT0gJ3BhY2snICYmIGNvbnRleHQgIT09ICdtYXJrZXRSZXF1ZXN0VmlldycgJiYgY29udGV4dCAhPT0gJ21pbmVQYWdlJykge1xyXG4gICAgICAgICBzZXR1cE9ic2VydmVyKGNvbnRleHQsIG9icyA9PiB7IGN1cnJlbnRPYnNlcnZlciA9IG9iczsgfSk7XHJcbiAgICAgfVxyXG59XHJcblxyXG5jb25zdCBpbml0TWluZVBhZ2UgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBtaW5lQnV0dG9uU2VsZWN0b3IgPSAnLm1haW4tbWluZV9fZ2FtZS10YXAnO1xyXG4gICAgY29uc3QgbWluZUJ1dHRvbiA9IGF3YWl0IHdhaXRGb3JFbGVtZW50cyhtaW5lQnV0dG9uU2VsZWN0b3IsIDUwMDAsIHRydWUpO1xyXG4gICAgY29uc3QgY291bnRlcklkID0gJ2F1dG8tbWluZS1jb3VudGVyJztcclxuXHJcbiAgICBpZiAoIW1pbmVCdXR0b24pIHtcclxuICAgICAgICBsb2dXYXJuKGBNaW5lIGJ1dHRvbiAoJyR7bWluZUJ1dHRvblNlbGVjdG9yfScpIG5vdCBmb3VuZCBhZnRlciB3YWl0aW5nLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY291bnRlcklkKSkge1xyXG4gICAgICAgIGxvZ1dhcm4oYE1pbmUgY291bnRlciAoJyMke2NvdW50ZXJJZH0nKSBhbHJlYWR5IGV4aXN0cy5gKTtcclxuICAgICAgICByZXR1cm47IFxyXG4gICAgfVxyXG5cclxuICAgIGxvZygnSW5pdGlhbGl6aW5nIG1pbmUgcGFnZSAoQnVyc3QgTW9kZSkuLi4nKTtcclxuXHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICBjb25zdCBoaXRzQ291bnQgPSBzZXR0aW5ncy5taW5lSGl0Q291bnQ7XHJcblxyXG4gICAgY29uc3QgY291bnRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGNvdW50ZXJFbGVtZW50LmlkID0gY291bnRlcklkO1xyXG4gICAgY291bnRlckVsZW1lbnQudGV4dENvbnRlbnQgPSBg0KPQtNCw0YAgeCR7aGl0c0NvdW50fWA7XHJcbiAgICBjb3VudGVyRWxlbWVudC5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9ICcxMHB4JztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzE0cHgnO1xyXG4gICAgY291bnRlckVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcclxuICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLmNvbG9yID0gJyNGRkYnO1xyXG4gICAgY291bnRlckVsZW1lbnQuc3R5bGUudGV4dFNoYWRvdyA9ICcxcHggMXB4IDJweCBibGFjayc7XHJcbiAgICBjb3VudGVyRWxlbWVudC5zdHlsZS5taW5IZWlnaHQgPSAnMS4yZW0nOyBcclxuICAgIFxyXG4gICAgLy8g4q2QINCQ0JTQkNCf0KLQkNCm0JjQrzog0KPQstC10LvQuNGH0LjQstCw0LXQvCDRiNGA0LjRhNGCINC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgIGlmIChpc01vYmlsZSkge1xyXG4gICAgICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzE2cHgnO1xyXG4gICAgICAgIGNvdW50ZXJFbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9ICcxNXB4JztcclxuICAgICAgICBjb3VudGVyRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzVweCc7XHJcbiAgICB9XHJcblxyXG4gICAgbWluZUJ1dHRvbi5wYXJlbnROb2RlLmluc2VydEJlZm9yZShjb3VudGVyRWxlbWVudCwgbWluZUJ1dHRvbi5uZXh0U2libGluZyk7XHJcbiAgICBsb2coJ01pbmUgY291bnRlciBlbGVtZW50IGFkZGVkLicpO1xyXG5cclxuICAgIGxldCBpc01pbmluZyA9IGZhbHNlO1xyXG5cclxuICAgIGNvbnN0IHVwZGF0ZUJ1dHRvblN0YXRlID0gKGRpc2FibGVkKSA9PiB7XHJcbiAgICAgICAgbWluZUJ1dHRvbi5kaXNhYmxlZCA9IGRpc2FibGVkO1xyXG4gICAgICAgIG1pbmVCdXR0b24uc3R5bGUub3BhY2l0eSA9IGRpc2FibGVkID8gJzAuNicgOiAnMSc7XHJcbiAgICAgICAgbWluZUJ1dHRvbi5zdHlsZS5jdXJzb3IgPSBkaXNhYmxlZCA/ICd3YWl0JyA6ICdwb2ludGVyJztcclxuICAgICAgICBpc01pbmluZyA9IGRpc2FibGVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIOKtkCDQkNCU0JDQn9Ci0JDQptCY0K86INCj0LLQtdC70LjRh9C40LLQsNC10Lwg0LrQvdC+0L/QutGDINC90LAg0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgICAgICAgIG1pbmVCdXR0b24uc3R5bGUubWluSGVpZ2h0ID0gJzYwcHgnO1xyXG4gICAgICAgICAgICBtaW5lQnV0dG9uLnN0eWxlLmZvbnRTaXplID0gJzE4cHgnO1xyXG4gICAgICAgICAgICBtaW5lQnV0dG9uLnN0eWxlLmZvbnRXZWlnaHQgPSAnYm9sZCc7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCB1cGRhdGVDb3VudGVyID0gKGN1cnJlbnQsIG1heCwgbWVzc2FnZSA9IG51bGwpID0+IHtcclxuICAgICAgICBpZiAobWVzc2FnZSkge1xyXG4gICAgICAgICAgICBjb3VudGVyRWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY291bnRlckVsZW1lbnQudGV4dENvbnRlbnQgPSBg0KHRgtCw0YLRg9GBOiAke2N1cnJlbnR9LyR7bWF4fWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIOKtkCDQkNCU0JDQn9Ci0JDQptCY0K86INCj0L/RgNC+0YnQsNC10Lwg0YHQvtC+0LHRidC10L3QuNGPINC90LAg0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgaWYgKGlzTW9iaWxlICYmIG1lc3NhZ2UgJiYgbWVzc2FnZS5sZW5ndGggPiA0MCkge1xyXG4gICAgICAgICAgICBjb3VudGVyRWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2Uuc3Vic3RyaW5nKDAsIDQwKSArICcuLi4nO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgbWluZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgICAgIGlmIChpc01pbmluZykgeyBcclxuICAgICAgICAgICAgbG9nV2FybignTWluaW5nIHByb2Nlc3MgYWxyZWFkeSBydW5uaW5nLicpOyBcclxuICAgICAgICAgICAgaWYgKGlzTW9iaWxlKSBhbGVydCgn0KPQttC1INC00L7QsdGL0LLQsNC10YLRgdGPLi4uJyk7XHJcbiAgICAgICAgICAgIHJldHVybjsgXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgeyBcclxuICAgICAgICAgICAgYWxlcnQoJ9Ca0L7QvdGC0LXQutGB0YIg0YDQsNGB0YjQuNGA0LXQvdC40Y8g0L3QtdC00LXQudGB0YLQstC40YLQtdC70LXQvS4nKTsgXHJcbiAgICAgICAgICAgIHJldHVybjsgXHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghY3NyZlRva2VuKSB7IFxyXG4gICAgICAgICAgICBhbGVydCgnQ1NSRiDRgtC+0LrQtdC9INC90LUg0L3QsNC50LTQtdC9LicpOyBcclxuICAgICAgICAgICAgbG9nRXJyb3IoJ01pbmluZyBzdGFydCBibG9ja2VkOiBDU1JGIHRva2VuIGlzIG51bGwgb3IgZW1wdHkuJyk7IFxyXG4gICAgICAgICAgICByZXR1cm47IFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY3VycmVudFNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICAgICAgICBjb25zdCBjdXJyZW50SGl0c0NvdW50ID0gY3VycmVudFNldHRpbmdzLm1pbmVIaXRDb3VudDtcclxuXHJcbiAgICAgICAgdXBkYXRlQnV0dG9uU3RhdGUodHJ1ZSk7XHJcbiAgICAgICAgdXBkYXRlQ291bnRlcigwLCBjdXJyZW50SGl0c0NvdW50LCBg0J7RgtC/0YDQsNCy0LrQsCAke2N1cnJlbnRIaXRzQ291bnR9INGD0LTQsNGA0L7Qsi4uLmApO1xyXG4gICAgICAgIGxvZygnU3RhcnRpbmcgbWluaW5nIGJ1cnN0IGZyb20gYnV0dG9uIGNsaWNrLi4uJyk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHN0YXJ0TWluaW5nUHJvY2Vzcyh1cGRhdGVCdXR0b25TdGF0ZSwgdXBkYXRlQ291bnRlcik7XHJcbiAgICAgICAgICAgIGxvZygnc3RhcnRNaW5pbmdQcm9jZXNzIChidXJzdCkgZmluaXNoZWQuJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgbG9nRXJyb3IoJ0NyaXRpY2FsIGVycm9yIGR1cmluZyBzdGFydE1pbmluZ1Byb2Nlc3MgKGJ1cnN0KSBleGVjdXRpb246JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdXR0b25TdGF0ZShmYWxzZSk7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvdW50ZXIoMCwgY3VycmVudEhpdHNDb3VudCwgJ+KdjCDQmtGA0LjRgtC40YfQtdGB0LrQsNGPINC+0YjQuNCx0LrQsCcpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8g4q2QINCQ0JTQkNCf0KLQkNCm0JjQrzog0JrQvtGA0L7RgtC60LjQtSDQsNC70LXRgNGC0Ysg0L3QsCDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBpc01vYmlsZSA/IFxyXG4gICAgICAgICAgICAgICAgJ9Ce0YjQuNCx0LrQsCDQtNC+0LHRi9GH0LguINCh0LwuINC60L7QvdGB0L7Qu9GMLicgOiBcclxuICAgICAgICAgICAgICAgIGDQn9GA0L7QuNC30L7RiNC70LAg0LrRgNC40YLQuNGH0LXRgdC60LDRjyDQvtGI0LjQsdC60LAg0LLQviDQstGA0LXQvNGPINC00L7QsdGL0YfQuDogJHtlcnJvci5tZXNzYWdlIHx8ICfQodC8LiDQutC+0L3RgdC+0LvRjC4nfWA7XHJcbiAgICAgICAgICAgIGFsZXJ0KGVycm9yTXNnKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBsb2coJ01pbmUgYnV0dG9uIGNsaWNrIGhhbmRsZXIgKGJ1cnN0IG1vZGUpIHNldC4nKTtcclxufTtcclxuXHJcbmNvbnN0IGluaXRQYWdlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7XHJcbiAgICAgICAgbG9nV2FybignRXh0ZW5zaW9uIGNvbnRleHQgaXMgbm90IHZhbGlkLiBBYm9ydGluZyBpbml0aWFsaXphdGlvbi4nKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIOKtkCDQlNCe0JHQkNCS0JjQotCsOiDQm9C+0LPQuNGA0L7QstCw0L3QuNC1INGC0LjQv9CwINGD0YHRgtGA0L7QudGB0YLQstCwXHJcbiAgICBsb2coYFN0YXJ0aW5nIHBhZ2UgaW5pdGlhbGl6YXRpb24gb24gJHtpc01vYmlsZSA/ICdNT0JJTEUnIDogJ0RFU0tUT1AnfSBkZXZpY2UuLi5gKTtcclxuICAgIFxyXG4gICAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCc0LXQvdGM0YjQtSDQu9C+0LPQuNGA0L7QstCw0L3QuNGPINC90LAg0LzQvtCx0LjQu9GM0L3Ri9GFINC00LvRjyDRjdC60L7QvdC+0LzQuNC4INC/0LDQvNGP0YLQuFxyXG4gICAgaWYgKCFpc01vYmlsZSkge1xyXG4gICAgICAgIGxvZygnVXNlciBhZ2VudDonLCBuYXZpZ2F0b3IudXNlckFnZW50KTtcclxuICAgICAgICBsb2coJ1NjcmVlbiBzaXplOicsIHsgd2lkdGg6IHdpbmRvdy5pbm5lcldpZHRoLCBoZWlnaHQ6IHdpbmRvdy5pbm5lckhlaWdodCB9KTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRFeHRlbnNpb25TZXR0aW5nc0J1dHRvbigpO1xyXG5cclxuICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgZ2V0U2V0dGluZ3MoKTtcclxuICAgIFxyXG4gICAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCc0LXQvdGM0YjQtSDQtNC10YLQsNC70LXQuSDQsiDQu9C+0LPQsNGFINC90LAg0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICBpZiAoIWlzTW9iaWxlKSB7XHJcbiAgICAgICAgbG9nKCdTZXR0aW5ncyBsb2FkZWQgaW4gaW5pdFBhZ2U6Jywgc2V0dGluZ3MpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBsb2coJ1NldHRpbmdzIGxvYWRlZCAobW9iaWxlIG1vZGUpJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFzZXR0aW5ncy5leHRlbnNpb25FbmFibGVkKSB7XHJcbiAgICAgICAgbG9nKCdFeHRlbnNpb24gaXMgZ2xvYmFsbHkgZGlzYWJsZWQgdmlhIHNldHRpbmdzLiBJbml0aWFsaXphdGlvbiBzdG9wcGVkLicpO1xyXG4gICAgICAgIGNsZWFudXBFeHRlbnNpb25GZWF0dXJlcygpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsb2coJ0V4dGVuc2lvbiBpcyBlbmFibGVkLCBwcm9jZWVkaW5nIHdpdGggaW5pdGlhbGl6YXRpb24uJyk7XHJcbiAgICBjb25zdCB0b2tlbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT1cImNzcmYtdG9rZW5cIl0nKT8uZ2V0QXR0cmlidXRlKCdjb250ZW50JykgfHwgJyc7XHJcbiAgICBpZiAodG9rZW4pIHtcclxuICAgICAgICBzZXRDc3JmVG9rZW4odG9rZW4pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBsb2dXYXJuKCdDU1JGIHRva2VuIG1ldGEgdGFnIG5vdCBmb3VuZCEnKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBjb250ZXh0ID0gZ2V0Q3VycmVudENvbnRleHQoKTtcclxuICAgIGxvZygnQ3VycmVudCBjb250ZXh0IGRldGVjdGVkOicsIGNvbnRleHQpO1xyXG5cclxuICAgIGlmICghY29udGV4dCkge1xyXG4gICAgICAgIGxvZygnTm8gc3BlY2lmaWMgY29udGV4dCBkZXRlY3RlZC4gSW5pdGlhbGl6YXRpb24gZmluaXNoZWQuJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChjb250ZXh0ICE9PSAnbWluZVBhZ2UnKSB7XHJcbiAgICAgICAgbG9nKGBJbml0aWFsaXppbmcgY29udGV4dDogJHtjb250ZXh0fWApO1xyXG4gICAgICAgIGxldCBlZmZlY3RpdmVJbml0aWFsQ29udGV4dFN0YXRlID0ge307XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgeyB1c2VyQ29udGV4dFN0YXRlcyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoWyd1c2VyQ29udGV4dFN0YXRlcyddKTtcclxuICAgICAgICAgICAgY29uc3Qgc2F2ZWRTdGF0ZXMgPSB1c2VyQ29udGV4dFN0YXRlcyB8fCB7fTtcclxuICAgICAgICAgICAgZWZmZWN0aXZlSW5pdGlhbENvbnRleHRTdGF0ZSA9IHtcclxuICAgICAgICAgICAgICAgIC4uLihpbml0aWFsQ29udGV4dFN0YXRlW2NvbnRleHRdIHx8IHt9KSxcclxuICAgICAgICAgICAgICAgIC4uLihzYXZlZFN0YXRlc1tjb250ZXh0XSB8fCB7fSlcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgY29udGV4dFN0YXRlID0geyAuLi5jb250ZXh0U3RhdGUsIFtjb250ZXh0XTogeyAuLi5lZmZlY3RpdmVJbml0aWFsQ29udGV4dFN0YXRlIH0gfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQnNC10L3RjNGI0LUg0LvQvtCz0LjRgNC+0LLQsNC90LjRjyDRgdC+0YHRgtC+0Y/QvdC40Y8g0L3QsCDQvNC+0LHQuNC70YzQvdGL0YVcclxuICAgICAgICAgICAgaWYgKCFpc01vYmlsZSkge1xyXG4gICAgICAgICAgICAgICAgbG9nKGBDdXJyZW50IGdsb2JhbCBjb250ZXh0U3RhdGUgYWZ0ZXIgaW5pdDpgLCBjb250ZXh0U3RhdGUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgIHN3aXRjaCAoY29udGV4dCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAndXNlckNhcmRzJzogYXdhaXQgaW5pdFVzZXJDYXJkcygpOyBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ21hcmtldENyZWF0ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5pdFN0YXRzQnV0dG9ucyhjb250ZXh0LCAnLmNhcmQtZmlsdGVyLWZvcm1fX2xvY2stc3RhdHVzJywgJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBoYW5kbGVNYXJrZXRDcmVhdGVQYWdlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICd0cmFkZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lndpc2hsaXN0IHx8IHNldHRpbmdzLmFsd2F5c1Nob3dPd25lcnMgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy5vd25lcnMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzLnRyYWRlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcHJvY2Vzc0NhcmRzKCd0cmFkZScsIHNldHRpbmdzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdwYWNrJzogYXdhaXQgaW5pdFBhY2tQYWdlKCk7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAnZGVja1ZpZXcnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lndpc2hsaXN0IHx8IHNldHRpbmdzLmFsd2F5c1Nob3dPd25lcnMgfHwgY29udGV4dFN0YXRlW2NvbnRleHRdPy5vd25lcnMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9ycy5kZWNrVmlldyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoJ2RlY2tWaWV3Jywgc2V0dGluZ3MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICd0cmFkZU9mZmVyJzogYXdhaXQgaW5pdFN0YXRzQnV0dG9ucyhjb250ZXh0LCAnLnRyYWRlX19yYW5rLXdyYXBwZXIgLnRyYWRlX19yYW5rJywgJ3RyYWRlX190eXBlLWNhcmQtYnV0dG9uJyk7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVtZWx0JzpcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ21hcmtldCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdzcGxpdCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdkZWNrQ3JlYXRlJzpcclxuICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ21hcmtldFJlcXVlc3RDcmVhdGUnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGluaXRTdGF0c0J1dHRvbnMoY29udGV4dCwgJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsICdjYXJkLWZpbHRlci1mb3JtX19sb2NrJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjYXNlICdtYXJrZXRSZXF1ZXN0Vmlldyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2V0dGluZ3MuYWx3YXlzU2hvd1dpc2hsaXN0IHx8IGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ud2lzaGxpc3QgfHwgc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycyB8fCBjb250ZXh0U3RhdGVbY29udGV4dF0/Lm93bmVycykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZyhgUHJvY2Vzc2luZyBjYXJkcyBmb3IgJHtjb250ZXh0fWApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogbG9nV2FybihgTm8gc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGNvbnRleHQ6ICR7Y29udGV4dH1gKTtcclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IFxyXG4gICAgICAgICAgICAgICAgLy8g4q2QINCQ0JTQkNCf0KLQkNCm0JjQrzog0JrQvtGA0L7RgtC60LjQtSDRgdC+0L7QsdGJ0LXQvdC40Y8g0L7QsSDQvtGI0LjQsdC60LDRhSDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICAgICAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBpc01vYmlsZSA/IFxyXG4gICAgICAgICAgICAgICAgICAgIGBFcnJvciBpbiAke2NvbnRleHR9OiAke2Vycm9yLm1lc3NhZ2Uuc3Vic3RyaW5nKDAsIDUwKX1gIDpcclxuICAgICAgICAgICAgICAgICAgICBgRXJyb3IgZHVyaW5nIGNvbnRleHQgaW5pdGlhbGl6YXRpb24gZm9yICR7Y29udGV4dH06ICR7ZXJyb3J9YDtcclxuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGVycm9yTXNnKTsgXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGluaXRpYWxpemVPYnNlcnZlcihjb250ZXh0KTtcclxuXHJcbiAgICAgICAgICAgIGxvZygnUGFnZSBpbml0aWFsaXphdGlvbiBmaW5pc2hlZCBmb3IgY29udGV4dDonLCBjb250ZXh0KTtcclxuICAgICAgICB9IGNhdGNoIChzdG9yYWdlRXJyb3IpIHtcclxuICAgICAgICAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBzZXR0aW5ncyBvciB1c2VyQ29udGV4dFN0YXRlcyBkdXJpbmcgaW5pdFBhZ2U6Jywgc3RvcmFnZUVycm9yKTtcclxuICAgICAgICAgICAgIGNvbnRleHRTdGF0ZSA9IHsgLi4uY29udGV4dFN0YXRlLCBbY29udGV4dF06IHsgLi4uKGluaXRpYWxDb250ZXh0U3RhdGVbY29udGV4dF0gfHwge30pIH0gfTtcclxuICAgICAgICAgICAgIGxvZ1dhcm4oYEluaXRpYWxpemVkICR7Y29udGV4dH0gd2l0aCBkZWZhdWx0IHN0YXRlIGR1ZSB0byBzdG9yYWdlIGVycm9yLmApO1xyXG4gICAgICAgICAgICAgaWYgKCFpc01vYmlsZSkge1xyXG4gICAgICAgICAgICAgICAgIGxvZyhgQ3VycmVudCBnbG9iYWwgY29udGV4dFN0YXRlIGFmdGVyIHN0b3JhZ2UgZXJyb3I6YCwgY29udGV4dFN0YXRlKTtcclxuICAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIOKtkCDQmNCd0JjQptCY0JDQm9CY0JfQkNCm0JjQryDQodCi0KDQkNCd0JjQptCrINCo0JDQpdCi0KtcclxuICAgICAgICBhd2FpdCBpbml0TWluZVBhZ2UoKTtcclxuICAgICAgICBsb2coYEluaXRpYWxpemF0aW9uIGZvciBjb250ZXh0ICcke2NvbnRleHR9JyBmaW5pc2hlZCAoYWRkZWQgYnV0dG9ucy9lbGVtZW50cykuYCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vLyDirZAg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQrzogRGVib3VuY2UgaW5pdFBhZ2Ug0LTQu9GPINC80L7QsdC40LvRjNC90YvRhSDRh9GC0L7QsdGLINC40LfQsdC10LbQsNGC0Ywg0LzQvdC+0LbQtdGB0YLQstC10L3QvdGL0YUg0LLRi9C30L7QstC+0LJcclxuY29uc3QgZGVib3VuY2VkSW5pdFBhZ2UgPSBkZWJvdW5jZShpbml0UGFnZSwgaXNNb2JpbGUgPyA1MDAgOiAxMDApO1xyXG5cclxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGRlYm91bmNlZEluaXRQYWdlKTtcclxufSBlbHNlIHtcclxuICAgIGRlYm91bmNlZEluaXRQYWdlKCk7XHJcbn1cclxuXHJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcclxuICAgIGlmICghaXNFeHRlbnNpb25Db250ZXh0VmFsaWQoKSkgeyBcclxuICAgICAgICBsb2dXYXJuKCdSZWNlaXZlZCBtZXNzYWdlLCBidXQgZXh0ZW5zaW9uIGNvbnRleHQgaXMgaW52YWxpZC4nKTsgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlOyBcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCc0LXQvdGM0YjQtSDQu9C+0LPQuNGA0L7QstCw0L3QuNGPINGB0L7QvtCx0YnQtdC90LjQuSDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgaWYgKCFpc01vYmlsZSkge1xyXG4gICAgICAgIGxvZyhgUmVjZWl2ZWQgbWVzc2FnZTogJHttZXNzYWdlLmFjdGlvbn1gLCBtZXNzYWdlKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZS5hY3Rpb24gPT09ICdjbGVhcldpc2hsaXN0Q2FjaGUnKSB7XHJcbiAgICAgICAgbG9nKCdQcm9jZXNzaW5nIGNsZWFyV2lzaGxpc3RDYWNoZSBtZXNzYWdlLi4uJyk7XHJcbiAgICAgICAgY2FjaGVkRWxlbWVudHMuY2xlYXIoKTtcclxuICAgICAgICBwZW5kaW5nUmVxdWVzdHMuY2xlYXIoKTtcclxuICAgICAgICBnZXRTZXR0aW5ncygpLnRoZW4oc2V0dGluZ3MgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc2V0dGluZ3MuZXh0ZW5zaW9uRW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGdldEN1cnJlbnRDb250ZXh0KCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSAgJiYgY29udGV4dCAhPT0gJ21pbmVQYWdlJykge1xyXG4gICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkTGFiZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLndpc2hsaXN0LXdhcm5pbmcsIC5vd25lcnMtY291bnQnKTtcclxuICAgICAgICAgICAgICAgICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgICAgICAgICAgICAgICAgIGxvZyhgUmVtb3ZlZCAke29sZExhYmVscy5sZW5ndGh9IG9sZCBsYWJlbHMuYCk7XHJcbiAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQn9GA0L7Qv9GD0YHQutCw0LXQvCDQv9C10YDQtdC+0LHRgNCw0LHQvtGC0LrRgyDQvdCwINC80L7QsdC40LvRjNC90YvRhSDQtdGB0LvQuCDQvdC1INCw0LrRgtC40LLQvdC+XHJcbiAgICAgICAgICAgICAgICAgICBpZiAoaXNNb2JpbGUgJiYgIXNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdCAmJiAhc2V0dGluZ3MuYWx3YXlzU2hvd093bmVycykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgIGxvZygnU2tpcHBpbmcgcmVwcm9jZXNzaW5nIG9uIG1vYmlsZSAtIGxhYmVscyBub3QgYWN0aXZlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdHVzOiAnY2FjaGVfY2xlYXJlZF9vbl9wYWdlJywgbW9iaWxlX29wdGltaXplZDogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgIGxvZygnUmVwcm9jZXNzaW5nIGNvbnRleHQgYWZ0ZXIgY2FjaGUgY2xlYXIuLi4nKTtcclxuICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTdGF0ZSA9IGNvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCB7fTtcclxuICAgICAgICAgICAgICAgICAgIGNvbnN0IGVmZmVjdGl2ZVN0YXRlID0geyAuLi4oaW5pdGlhbENvbnRleHRTdGF0ZVtjb250ZXh0XSB8fCB7fSksIC4uLmN1cnJlbnRTdGF0ZSB9O1xyXG4gICAgICAgICAgICAgICAgICAgY29udGV4dFN0YXRlID0geyAuLi5jb250ZXh0U3RhdGUsIFtjb250ZXh0XTogZWZmZWN0aXZlU3RhdGUgfTtcclxuICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgaWYgKGNvbnRleHQgPT09ICd1c2VyQ2FyZHMnKSB7IGluaXRVc2VyQ2FyZHMoKTsgfVxyXG4gICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoWyd0cmFkZU9mZmVyJywgJ3JlbWVsdCcsICdtYXJrZXQnLCAnc3BsaXQnLCAnZGVja0NyZWF0ZScsICdtYXJrZXRDcmVhdGUnLCAnbWFya2V0UmVxdWVzdENyZWF0ZSddLmluY2x1ZGVzKGNvbnRleHQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidXR0b25Db25maWdNYXAgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAndHJhZGVPZmZlcic6IHsgc2VsZWN0b3I6ICcudHJhZGVfX3Jhbmstd3JhcHBlciAudHJhZGVfX3JhbmsnLCBjbGFzczogJ3RyYWRlX190eXBlLWNhcmQtYnV0dG9uJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3JlbWVsdCc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnbWFya2V0JzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICdzcGxpdCc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnZGVja0NyZWF0ZSc6IHsgc2VsZWN0b3I6ICcuY2FyZC1maWx0ZXItZm9ybV9fbG9jay1zdGF0dXMnLCBjbGFzczogJ2NhcmQtZmlsdGVyLWZvcm1fX2xvY2snIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnbWFya2V0Q3JlYXRlJzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICdtYXJrZXRSZXF1ZXN0Q3JlYXRlJzogeyBzZWxlY3RvcjogJy5jYXJkLWZpbHRlci1mb3JtX19sb2NrLXN0YXR1cycsIGNsYXNzOiAnY2FyZC1maWx0ZXItZm9ybV9fbG9jaycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidXR0b25Db25maWcgPSBidXR0b25Db25maWdNYXBbY29udGV4dF07XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoYnV0dG9uQ29uZmlnKSB7IGluaXRTdGF0c0J1dHRvbnMoY29udGV4dCwgYnV0dG9uQ29uZmlnLnNlbGVjdG9yLCBidXR0b25Db25maWcuY2xhc3MpOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICBlbHNlIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nV2FybihgQnV0dG9uIGNvbmZpZyBub3QgZm91bmQgZm9yICR7Y29udGV4dH0uLi5gKTsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIHNldHRpbmdzKTsgXHJcbiAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQgPT09ICdwYWNrJykgeyBpbml0UGFja1BhZ2UoKTsgfVxyXG4gICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoY29udGV4dCA9PT0gJ3RyYWRlJyB8fCBjb250ZXh0ID09PSAnZGVja1ZpZXcnIHx8IGNvbnRleHQgPT09ICdtYXJrZXRSZXF1ZXN0VmlldycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuZGVsZXRlKGNvbnRleHRzU2VsZWN0b3JzW2NvbnRleHRdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc0NhcmRzKGNvbnRleHQsIHNldHRpbmdzKTtcclxuICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgIGVsc2UgeyBsb2dXYXJuKGBVbmhhbmRsZWQgY29udGV4dCAke2NvbnRleHR9IGluIGNsZWFyIGNhY2hlIHJlcHJvY2Vzc2luZy5gKTsgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBsb2coYE5vIGFjdGl2ZSBjb250ZXh0IHJlcXVpcmluZyBjYXJkIHJlcHJvY2Vzc2luZyBhZnRlciBjYWNoZSBjbGVhci4gQ3VycmVudCBjb250ZXh0OiAke2NvbnRleHR9YCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgbG9nKCdDYWNoZSBjbGVhcmVkLCBidXQgZXh0ZW5zaW9uIGlzIGdsb2JhbGx5IGRpc2FibGVkLiBObyByZXByb2Nlc3NpbmcgbmVlZGVkLicpO1xyXG4gICAgICAgICAgICAgICAgIGNvbnN0IG9sZExhYmVscyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy53aXNobGlzdC13YXJuaW5nLCAub3duZXJzLWNvdW50Jyk7XHJcbiAgICAgICAgICAgICAgICAgb2xkTGFiZWxzLmZvckVhY2gobGFiZWwgPT4gbGFiZWwucmVtb3ZlKCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4gbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgc2V0dGluZ3MgZHVyaW5nIGNhY2hlIGNsZWFyOicsIGVycm9yKSk7XHJcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdHVzOiAnY2FjaGVfY2xlYXJlZF9vbl9wYWdlJyB9KTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdGF0dXM6ICd1bmtub3duX2FjdGlvbl9vbl9wYWdlJywgcmVjZWl2ZWQ6IG1lc3NhZ2UuYWN0aW9uIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbn0pO1xyXG5cclxuY2hyb21lLnN0b3JhZ2Uub25DaGFuZ2VkLmFkZExpc3RlbmVyKGFzeW5jIChjaGFuZ2VzLCBuYW1lc3BhY2UpID0+IHtcclxuICAgIGlmIChuYW1lc3BhY2UgPT09ICdzeW5jJykge1xyXG4gICAgICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQnNC10L3RjNGI0LUg0LvQvtCz0LjRgNC+0LLQsNC90LjRjyDQvdCwINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICAgIGlmICghaXNNb2JpbGUpIHtcclxuICAgICAgICAgICAgbG9nKCdEZXRlY3RlZCBjaGFuZ2UgaW4gc3luYyBzZXR0aW5nczonLCBjaGFuZ2VzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7IFxyXG4gICAgICAgICAgICBsb2dXYXJuKCdTZXR0aW5ncyBjaGFuZ2VkLCBidXQgY29udGV4dCBpbnZhbGlkLi4uJyk7IFxyXG4gICAgICAgICAgICByZXR1cm47IFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNoYW5nZXMuZXh0ZW5zaW9uRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBjb25zdCBuZXdWYWx1ZSA9IGNoYW5nZXMuZXh0ZW5zaW9uRW5hYmxlZC5uZXdWYWx1ZTtcclxuICAgICAgICAgICAgbG9nKGBHbG9iYWwgZW5hYmxlIHN3aXRjaCBjaGFuZ2VkIHRvOiAke25ld1ZhbHVlfWApO1xyXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGluaXRQYWdlKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwRXh0ZW5zaW9uRmVhdHVyZXMoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNoYW5nZWRLZXlzID0gT2JqZWN0LmtleXMoY2hhbmdlcyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlbGV2YW50S2V5cyA9IFsnd2lzaGxpc3RTdHlsZScsICd3aXNobGlzdFdhcm5pbmcnLCAnYWx3YXlzU2hvd1dpc2hsaXN0JywgJ2Fsd2F5c1Nob3dPd25lcnMnLCAndXNlckNvbnRleHRTdGF0ZXMnLCAnbWluZUhpdENvdW50J107XHJcbiAgICAgICAgICAgIGNvbnN0IG90aGVyU2V0dGluZ3NDaGFuZ2VkID0gY2hhbmdlZEtleXMuc29tZShrZXkgPT4gcmVsZXZhbnRLZXlzLmluY2x1ZGVzKGtleSkpO1xyXG5cclxuICAgICAgICAgICAgaWYgKG90aGVyU2V0dGluZ3NDaGFuZ2VkKSB7XHJcbiAgICAgICAgICAgICAgICAgbG9nKCdEZXRlY3RlZCBjaGFuZ2UgaW4gb3RoZXIgcmVsZXZhbnQgc3luYyBzZXR0aW5ncy4nKTtcclxuICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICAgaWYgKHNldHRpbmdzLmV4dGVuc2lvbkVuYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgbG9nKCdFeHRlbnNpb24gaXMgZW5hYmxlZCwgcmUtaW5pdGlhbGl6aW5nIGR1ZSB0byBzZXR0aW5nIGNoYW5nZS4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5pdFBhZ2UoKTtcclxuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgbG9nKCdPdGhlciBzZXR0aW5ncyBjaGFuZ2VkLCBidXQgZXh0ZW5zaW9uIGlzIGRpc2FibGVkLiBObyBhY3Rpb24gbmVlZGVkLicpO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG4vLyDirZAg0JTQntCR0JDQktCY0KLQrDogTW9iaWxlLXNwZWNpZmljIG9wdGltaXphdGlvbnNcclxuaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAvLyDQn9GA0LXQtNC+0YLQstGA0LDRidCw0LXQvCDQvNC90L7QttC10YHRgtCy0LXQvdC90YvQtSDRgtCw0L/Ri1xyXG4gICAgbGV0IGxhc3RUYXBUaW1lID0gMDtcclxuICAgIGNvbnN0IHRhcERlbGF5ID0gNTAwOyAvLyA1MDBtcyDQvNC10LbQtNGDINGC0LDQv9Cw0LzQuFxyXG4gICAgXHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xyXG4gICAgICAgIGlmIChldmVudC50YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCd3aXNobGlzdC10b2dnbGUtYnRuJykgfHwgXHJcbiAgICAgICAgICAgIGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ21vYmlsZS1jcmVhdGUtbG90LWJ0bicpIHx8XHJcbiAgICAgICAgICAgIGV2ZW50LnRhcmdldC5jbG9zZXN0KCcud2lzaGxpc3QtdG9nZ2xlLWJ0bicpIHx8XHJcbiAgICAgICAgICAgIGV2ZW50LnRhcmdldC5jbG9zZXN0KCcubW9iaWxlLWNyZWF0ZS1sb3QtYnRuJykpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVTaW5jZUxhc3RUYXAgPSBjdXJyZW50VGltZSAtIGxhc3RUYXBUaW1lO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRpbWVTaW5jZUxhc3RUYXAgPCB0YXBEZWxheSkge1xyXG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgbG9nKCdQcmV2ZW50ZWQgcmFwaWQgdGFwIG9uIG1vYmlsZScpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBsYXN0VGFwVGltZSA9IGN1cnJlbnRUaW1lO1xyXG4gICAgICAgIH1cclxuICAgIH0sIHRydWUpO1xyXG4gICAgXHJcbiAgICBsb2coJ0FwcGxpZWQgbW9iaWxlIHRhcCBwcmV2ZW50aW9uJyk7XHJcbn0iLCJpbXBvcnQgeyBsb2csIGxvZ1dhcm4sIGxvZ0Vycm9yLCBpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCB9IGZyb20gJy4vdXRpbHMuanMnO1xyXG5pbXBvcnQgeyBjc3JmVG9rZW4gfSBmcm9tICcuL2FwaS5qcyc7XHJcbmltcG9ydCB7IGdldFNldHRpbmdzIH0gZnJvbSAnLi9zZXR0aW5ncy5qcyc7IFxyXG5cclxuY29uc3QgTUlORV9ISVRfVVJMID0gXCJodHRwczovL21hbmdhYnVmZi5ydS9taW5lL2hpdFwiO1xyXG5cclxuY29uc3Qgc2VuZE1pbmVIaXRSZXF1ZXN0ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB0aHJvdyBuZXcgRXJyb3IoXCJFeHRlbnNpb24gY29udGV4dCBsb3N0XCIpO1xyXG4gICAgaWYgKCFjc3JmVG9rZW4pIHRocm93IG5ldyBFcnJvcihcIkNTUkYgdG9rZW4gaXMgbWlzc2luZ1wiKTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGFjdGlvbjogJ21pbmVIaXQnLFxyXG4gICAgICAgICAgICB1cmw6IE1JTkVfSElUX1VSTCxcclxuICAgICAgICAgICAgY3NyZlRva2VuOiBjc3JmVG9rZW5cclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAoIXJlc3BvbnNlKSB7IHRocm93IG5ldyBFcnJvcihgTm8gcmVzcG9uc2UgcmVjZWl2ZWQuLi5gKTsgfVxyXG4gICAgICAgIGlmICghcmVzcG9uc2Uuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihyZXNwb25zZS5lcnJvciB8fCAnVW5rbm93biBiYWNrZ3JvdW5kIGVycm9yJyk7XHJcbiAgICAgICAgICAgIGVycm9yLnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcclxuICAgICAgICAgICAgZXJyb3IuZGF0YSA9IHJlc3BvbnNlLmRhdGE7XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgbG9nRXJyb3IoYEVycm9yIHNlbmRpbmcgbWVzc2FnZSBmb3IgYWN0aW9uIG1pbmVIaXQ6YCwgZXJyb3IpO1xyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHN0YXJ0TWluaW5nUHJvY2VzcyA9IGFzeW5jICh1cGRhdGVCdXR0b25TdGF0ZUNhbGxiYWNrLCB1cGRhdGVDb3VudGVyQ2FsbGJhY2spID0+IHtcclxuXHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcbiAgICBjb25zdCBoaXRzVG9TZW5kID0gc2V0dGluZ3MubWluZUhpdENvdW50OyBcclxuXHJcbiAgICBsb2coYPCfmoAgU3RhcnRpbmcgbWluaW5nIGJ1cnN0IG9mICR7aGl0c1RvU2VuZH0gaGl0cy4uLmApO1xyXG5cclxuICAgIHVwZGF0ZUNvdW50ZXJDYWxsYmFjaygwLCBoaXRzVG9TZW5kLCBg0J7RgtC/0YDQsNCy0LrQsCAke2hpdHNUb1NlbmR9INGD0LTQsNGA0L7Qsi4uLmApO1xyXG4gICAgdXBkYXRlQnV0dG9uU3RhdGVDYWxsYmFjayh0cnVlKTtcclxuXHJcbiAgICBjb25zdCBoaXRQcm9taXNlcyA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBoaXRzVG9TZW5kOyBpKyspIHsgXHJcbiAgICAgICAgaGl0UHJvbWlzZXMucHVzaChzZW5kTWluZUhpdFJlcXVlc3QoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgbG9nKGBJbml0aWF0ZWQgJHtoaXRQcm9taXNlcy5sZW5ndGh9IGhpdCByZXF1ZXN0cy5gKTtcclxuXHJcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGhpdFByb21pc2VzKTtcclxuICAgIGxvZyhgRmluaXNoZWQgcHJvY2Vzc2luZyBhbGwgJHtyZXN1bHRzLmxlbmd0aH0gaGl0IHJlcXVlc3RzLmApO1xyXG5cclxuICAgIGxldCBzdWNjZXNzZnVsSGl0cyA9IDA7XHJcbiAgICBsZXQgZmlyc3RFcnJvck1lc3NhZ2UgPSBudWxsO1xyXG4gICAgbGV0IHJhdGVMaW1pdEhpdCA9IGZhbHNlO1xyXG5cclxuICAgIHJlc3VsdHMuZm9yRWFjaCgocmVzdWx0LCBpbmRleCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xyXG4gICAgICAgICAgICBzdWNjZXNzZnVsSGl0cysrO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGxvZ1dhcm4oYOKdjCBIaXQgJHtpbmRleCArIDF9IGZhaWxlZC4gUmVhc29uOmAsIHJlc3VsdC5yZWFzb24/Lm1lc3NhZ2UgfHwgcmVzdWx0LnJlYXNvbik7XHJcbiAgICAgICAgICAgIGlmICghZmlyc3RFcnJvck1lc3NhZ2UpIHtcclxuICAgICAgICAgICAgICAgIGZpcnN0RXJyb3JNZXNzYWdlID0gcmVzdWx0LnJlYXNvbj8ubWVzc2FnZSB8fCAn0J3QtdC40LfQstC10YHRgtC90LDRjyDQvtGI0LjQsdC60LAnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQucmVhc29uPy5zdGF0dXMgPT09IDQwMyB8fCByZXN1bHQucmVhc29uPy5zdGF0dXMgPT09IDQyOSB8fCByZXN1bHQucmVhc29uPy5tZXNzYWdlPy5pbmNsdWRlcygnY2xvc2VkJykgfHwgcmVzdWx0LnJlYXNvbj8ubWVzc2FnZT8uaW5jbHVkZXMoJ9C30LDQutGA0YvRgtCwJykpIHtcclxuICAgICAgICAgICAgICAgICByYXRlTGltaXRIaXQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbG9nKGDwn5OKIE1pbmluZyBidXJzdCByZXN1bHQ6ICR7c3VjY2Vzc2Z1bEhpdHN9IHN1Y2Nlc3NmdWwgLyAke2hpdHNUb1NlbmQgLSBzdWNjZXNzZnVsSGl0c30gZmFpbGVkLmApOyBcclxuXHJcbiAgICBsZXQgZmluYWxNZXNzYWdlID0gJyc7XHJcbiAgICBpZiAoc3VjY2Vzc2Z1bEhpdHMgPT09IGhpdHNUb1NlbmQpIHsgXHJcbiAgICAgICAgZmluYWxNZXNzYWdlID0gYOKclO+4jyDQo9GB0L/QtdGI0L3QviAoJHtzdWNjZXNzZnVsSGl0c30vJHtoaXRzVG9TZW5kfSlgOyBcclxuICAgIH0gZWxzZSBpZiAocmF0ZUxpbWl0SGl0KSB7XHJcbiAgICAgICAgZmluYWxNZXNzYWdlID0gYOKdjCDQqNCw0YXRgtCwINC30LDQutGA0YvRgtCwICgke3N1Y2Nlc3NmdWxIaXRzfS8ke2hpdHNUb1NlbmR9KWA7IFxyXG4gICAgfSBlbHNlIGlmIChzdWNjZXNzZnVsSGl0cyA+IDApIHtcclxuICAgICAgICBmaW5hbE1lc3NhZ2UgPSBg4pqg77iPINCn0LDRgdGC0LjRh9C90L4gKCR7c3VjY2Vzc2Z1bEhpdHN9LyR7aGl0c1RvU2VuZH0pLiDQntGI0LjQsdC60LA6ICR7Zmlyc3RFcnJvck1lc3NhZ2V9YDsgXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZpbmFsTWVzc2FnZSA9IGDinYwg0J7RiNC40LHQutCwICgke3N1Y2Nlc3NmdWxIaXRzfS8ke2hpdHNUb1NlbmR9KTogJHtmaXJzdEVycm9yTWVzc2FnZX1gOyBcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGVCdXR0b25TdGF0ZUNhbGxiYWNrKGZhbHNlKTtcclxuICAgIHVwZGF0ZUNvdW50ZXJDYWxsYmFjayhzdWNjZXNzZnVsSGl0cywgaGl0c1RvU2VuZCwgZmluYWxNZXNzYWdlKTsgXHJcbn07IiwiaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGRlYm91bmNlLCBsb2csIGxvZ1dhcm4sIGNhY2hlZEVsZW1lbnRzIH0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7IGNvbnRleHRzU2VsZWN0b3JzLCBnZXRDdXJyZW50Q29udGV4dCB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzLmpzJztcclxuaW1wb3J0IHsgcHJvY2Vzc0NhcmRzIH0gZnJvbSAnLi9jYXJkUHJvY2Vzc29yLmpzJztcclxuaW1wb3J0IHsgaW5pdFVzZXJDYXJkcyB9IGZyb20gJy4vY29udGV4dEhhbmRsZXJzLmpzJztcclxuaW1wb3J0IHsgY29udGV4dFN0YXRlIH0gZnJvbSAnLi9tYWluLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBzZXR1cE9ic2VydmVyID0gKGNvbnRleHQsIG9ic2VydmVyQ3JlYXRlZENhbGxiYWNrKSA9PiB7XHJcbiAgaWYgKCFjb250ZXh0IHx8ICFjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSkge1xyXG4gICAgbG9nV2FybihgT2JzZXJ2ZXI6IE5vdCBzZXQgdXAgLSBpbnZhbGlkIGNvbnRleHQgb3Igbm8gc2VsZWN0b3IgZGVmaW5lZDogJHtjb250ZXh0fWApO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgbGV0IHRhcmdldFNlbGVjdG9yO1xyXG4gIHN3aXRjaCAoY29udGV4dCkge1xyXG4gICAgICBjYXNlICd0cmFkZU9mZmVyJzogdGFyZ2V0U2VsZWN0b3IgPSAnLnRyYWRlX19pbnZlbnRvcnktbGlzdCc7IGJyZWFrO1xyXG4gICAgICBjYXNlICdwYWNrJzogcmV0dXJuO1xyXG4gICAgICBjYXNlICdkZWNrVmlldyc6IHRhcmdldFNlbGVjdG9yID0gJy5kZWNrX19pdGVtcyc7IGJyZWFrO1xyXG4gICAgICBjYXNlICd1c2VyQ2FyZHMnOiB0YXJnZXRTZWxlY3RvciA9ICcubWFuZ2EtY2FyZHMnOyBicmVhaztcclxuICAgICAgY2FzZSAndHJhZGUnOiB0YXJnZXRTZWxlY3RvciA9ICcudHJhZGVfX21haW4nOyBicmVhaztcclxuICAgICAgY2FzZSAncmVtZWx0JzpcclxuICAgICAgY2FzZSAnbWFya2V0JzpcclxuICAgICAgY2FzZSAnc3BsaXQnOlxyXG4gICAgICBjYXNlICdkZWNrQ3JlYXRlJzpcclxuICAgICAgY2FzZSAnbWFya2V0Q3JlYXRlJzpcclxuICAgICAgY2FzZSAnbWFya2V0UmVxdWVzdENyZWF0ZSc6IHRhcmdldFNlbGVjdG9yID0gJy5jYXJkLWZpbHRlci1saXN0X19pdGVtcyc7IGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgbG9nV2FybihgT2JzZXJ2ZXI6IE5vIHRhcmdldCBzZWxlY3RvciBkZWZpbmVkIGZvciBjb250ZXh0ICR7Y29udGV4dH0uYCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCB0YXJnZXROb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXRTZWxlY3Rvcik7XHJcbiAgaWYgKCF0YXJnZXROb2RlKSB7XHJcbiAgICAgIGxvZ1dhcm4oYE9ic2VydmVyOiBUYXJnZXQgbm9kZSBub3QgZm91bmQgd2l0aCBzZWxlY3RvcjogJHt0YXJnZXRTZWxlY3Rvcn0gZm9yIGNvbnRleHQgJHtjb250ZXh0fWApO1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgIGNvbnN0IGRlbGF5ZWROb2RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0YXJnZXRTZWxlY3Rvcik7XHJcbiAgICAgICAgICBpZiAoZGVsYXllZE5vZGUpIHtcclxuICAgICAgICAgICAgICBsb2coYE9ic2VydmVyOiBUYXJnZXQgbm9kZSAke3RhcmdldFNlbGVjdG9yfSBmb3VuZCBhZnRlciBkZWxheS4gU2V0dGluZyB1cCBvYnNlcnZlci5gKTtcclxuICAgICAgICAgICAgICBvYnNlcnZlTm9kZShkZWxheWVkTm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBsb2dXYXJuKGBPYnNlcnZlcjogVGFyZ2V0IG5vZGUgJHt0YXJnZXRTZWxlY3Rvcn0gc3RpbGwgbm90IGZvdW5kIGFmdGVyIGRlbGF5LmApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICB9LCAxMDAwKTtcclxuICAgICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgb2JzZXJ2ZU5vZGUodGFyZ2V0Tm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spO1xyXG59O1xyXG5cclxuY29uc3Qgb2JzZXJ2ZU5vZGUgPSAodGFyZ2V0Tm9kZSwgY29udGV4dCwgb2JzZXJ2ZXJDcmVhdGVkQ2FsbGJhY2spID0+IHtcclxuICAgIGNvbnN0IG9ic2VydmVyQ2FsbGJhY2sgPSBkZWJvdW5jZShhc3luYyAobXV0YXRpb25zKSA9PiB7XHJcbiAgICAgICAgaWYgKCFpc0V4dGVuc2lvbkNvbnRleHRWYWxpZCgpKSB7XHJcbiAgICAgICAgICAgIGxvZ1dhcm4oJ09ic2VydmVyOiBFeHRlbnNpb24gY29udGV4dCBsb3N0LCBza2lwcGluZyBtdXRhdGlvbiBwcm9jZXNzaW5nLicpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgY2FyZExpc3RDaGFuZ2VkID0gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgY2FyZFNlbGVjdG9yID0gY29udGV4dHNTZWxlY3RvcnNbY29udGV4dF07XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgbXV0YXRpb24gb2YgbXV0YXRpb25zKSB7XHJcbiAgICAgICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWRkZWROb2Rlc01hdGNoID0gQXJyYXkuZnJvbShtdXRhdGlvbi5hZGRlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5tYXRjaGVzPy4oY2FyZFNlbGVjdG9yKSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVkTm9kZXNNYXRjaCA9IEFycmF5LmZyb20obXV0YXRpb24ucmVtb3ZlZE5vZGVzKS5zb21lKG5vZGUgPT4gbm9kZS5tYXRjaGVzPy4oY2FyZFNlbGVjdG9yKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGFkZGVkTm9kZXNNYXRjaCB8fCByZW1vdmVkTm9kZXNNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRMaXN0Q2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dCA9PT0gJ3VzZXJDYXJkcycgJiYgKG11dGF0aW9uLnRhcmdldCA9PT0gdGFyZ2V0Tm9kZSB8fCBtdXRhdGlvbi50YXJnZXQuY2xvc2VzdCh0YXJnZXRTZWxlY3RvcikpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGlmIChtdXRhdGlvbi5hZGRlZE5vZGVzLmxlbmd0aCA+IDAgfHwgbXV0YXRpb24ucmVtb3ZlZE5vZGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRMaXN0Q2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgIGlmIChjb250ZXh0ID09PSAndHJhZGUnICYmIG11dGF0aW9uLnRhcmdldCA9PT0gdGFyZ2V0Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICBpZiAobXV0YXRpb24uYWRkZWROb2Rlcy5sZW5ndGggPiAwIHx8IG11dGF0aW9uLnJlbW92ZWROb2Rlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBjYXJkTGlzdENoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjYXJkTGlzdENoYW5nZWQpIHtcclxuICAgICAgICAgICAgbG9nKGBPYnNlcnZlcjogRGV0ZWN0ZWQgY2FyZCBsaXN0IGNoYW5nZSBpbiBjb250ZXh0OiAke2NvbnRleHR9LiBSZXByb2Nlc3NpbmcuYCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTZXR0aW5ncyA9IGF3YWl0IGdldFNldHRpbmdzKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoY29udGV4dCA9PT0gJ3VzZXJDYXJkcycpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGluaXRVc2VyQ2FyZHMoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgbmVlZHNQcm9jZXNzaW5nID0gKGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ud2lzaGxpc3QgfHwgY3VycmVudFNldHRpbmdzLmFsd2F5c1Nob3dXaXNobGlzdClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfHwgKGNvbnRleHRTdGF0ZVtjb250ZXh0XT8ub3duZXJzIHx8IGN1cnJlbnRTZXR0aW5ncy5hbHdheXNTaG93T3duZXJzKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChuZWVkc1Byb2Nlc3NpbmcpIHtcclxuICAgICAgICAgICAgICAgIGxvZyhgT2JzZXJ2ZXI6IFJlcHJvY2Vzc2luZyBjYXJkcyBmb3IgJHtjb250ZXh0fSBhcyBsYWJlbHMgYXJlIGFjdGl2ZS5gKTtcclxuICAgICAgICAgICAgICAgIGNhY2hlZEVsZW1lbnRzLmRlbGV0ZShjb250ZXh0c1NlbGVjdG9yc1tjb250ZXh0XSk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ2FyZHMoY29udGV4dCwgY3VycmVudFNldHRpbmdzKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxvZyhgT2JzZXJ2ZXI6IENhcmQgbGlzdCBjaGFuZ2VkLCBidXQgbm8gbGFiZWxzIGFyZSBhY3RpdmUgZm9yIGNvbnRleHQgJHtjb250ZXh0fS4gTm8gcmVwcm9jZXNzaW5nIG5lZWRlZC5gKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9sZExhYmVscyA9IHRhcmdldE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLndpc2hsaXN0LXdhcm5pbmcsIC5vd25lcnMtY291bnQnKTtcclxuICAgICAgICAgICAgICAgIG9sZExhYmVscy5mb3JFYWNoKGxhYmVsID0+IGxhYmVsLnJlbW92ZSgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0sIDc1MCk7XHJcblxyXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihvYnNlcnZlckNhbGxiYWNrKTtcclxuICAgIG9ic2VydmVyLm9ic2VydmUodGFyZ2V0Tm9kZSwge1xyXG4gICAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcclxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBvYnNlcnZlckNyZWF0ZWRDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIG9ic2VydmVyQ3JlYXRlZENhbGxiYWNrKG9ic2VydmVyKTtcclxuICAgIH1cclxuICAgIGxvZyhgT2JzZXJ2ZXI6IFNldHVwIG9ic2VydmVyIGZvciBjb250ZXh0ICR7Y29udGV4dH0gb24gdGFyZ2V0OiAke3RhcmdldFNlbGVjdG9yfWApO1xyXG59IiwiaW1wb3J0IHsgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQsIGxvZywgbG9nRXJyb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcclxuXHJcbmNvbnN0IGRlZmF1bHRTZXR0aW5ncyA9IHtcclxuICBleHRlbnNpb25FbmFibGVkOiB0cnVlLFxyXG4gIHdpc2hsaXN0V2FybmluZzogMTAsXHJcbiAgd2lzaGxpc3RTdHlsZTogJ3N0eWxlLTEnLFxyXG4gIGFsd2F5c1Nob3dXaXNobGlzdDogZmFsc2UsXHJcbiAgYWx3YXlzU2hvd093bmVyczogZmFsc2UsXHJcbiAgbWluZUhpdENvdW50OiAxMDBcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBnZXRTZXR0aW5ncyA9IGFzeW5jICgpID0+IHtcclxuICBpZiAoIWlzRXh0ZW5zaW9uQ29udGV4dFZhbGlkKCkpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoeyAuLi5kZWZhdWx0U2V0dGluZ3MgfSk7XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KE9iamVjdC5rZXlzKGRlZmF1bHRTZXR0aW5ncykpO1xyXG4gICAgY29uc3QgbWVyZ2VkU2V0dGluZ3MgPSB7IC4uLmRlZmF1bHRTZXR0aW5ncywgLi4uc2V0dGluZ3MgfTtcclxuICAgIHJldHVybiBtZXJnZWRTZXR0aW5ncztcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHRpbmdzIGZyb20gc3RvcmFnZTonLCBlcnJvcik7XHJcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0U2V0dGluZ3MgfTtcclxuICB9XHJcbn07IiwiaW1wb3J0IHsgTE9HX1BSRUZJWCB9IGZyb20gJy4vY29uZmlnLmpzJztcclxuXHJcbmV4cG9ydCBjb25zdCBjYWNoZWRFbGVtZW50cyA9IG5ldyBNYXAoKTtcclxuXHJcbi8vIOKtkCDQlNCe0JHQkNCS0JjQotCsOiDQntC/0YDQtdC00LXQu9C10L3QuNC1INC80L7QsdC40LvRjNC90L7Qs9C+INGD0YHRgtGA0L7QudGB0YLQstCwXHJcbmV4cG9ydCBjb25zdCBpc01vYmlsZURldmljZSA9ICgpID0+IHtcclxuICAgIHJldHVybiAvQW5kcm9pZHx3ZWJPU3xpUGhvbmV8aVBhZHxpUG9kfEJsYWNrQmVycnl8SUVNb2JpbGV8T3BlcmEgTWluaS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XHJcbn07XHJcblxyXG4vLyDirZAg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQrzog0JDQtNCw0L/RgtC40LLQvdC+0LUg0LvQvtCz0LjRgNC+0LLQsNC90LjQtSDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbmV4cG9ydCBjb25zdCBsb2cgPSAobWVzc2FnZSwgLi4uYXJncykgPT4ge1xyXG4gICAgY29uc3QgaXNNb2JpbGUgPSBpc01vYmlsZURldmljZSgpO1xyXG4gICAgXHJcbiAgICAvLyDQndCwINC80L7QsdC40LvRjNC90YvRhSDQu9C+0LPQuNGA0YPQtdC8INGC0L7Qu9GM0LrQviDQstCw0LbQvdGL0LUg0YHQvtC+0LHRidC10L3QuNGPICjQtNC70Y8g0Y3QutC+0L3QvtC80LjQuCDQv9Cw0LzRj9GC0LgpXHJcbiAgICBpZiAoIWlzTW9iaWxlIHx8IG1lc3NhZ2UuaW5jbHVkZXMoJ0Vycm9yJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnV2FybicpIHx8IFxyXG4gICAgICAgIG1lc3NhZ2UuaW5jbHVkZXMoJ0RldGVjdGVkJykgfHwgbWVzc2FnZS5pbmNsdWRlcygnUHJvY2Vzc2luZycpKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYCR7TE9HX1BSRUZJWH0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGxvZ1dhcm4gPSAobWVzc2FnZSwgLi4uYXJncykgPT4ge1xyXG4gICAgY29uc3QgaXNNb2JpbGUgPSBpc01vYmlsZURldmljZSgpO1xyXG4gICAgXHJcbiAgICAvLyDQndCwINC80L7QsdC40LvRjNC90YvRhSDRgdC+0LrRgNCw0YnQsNC10Lwg0YHQvtC+0LHRidC10L3QuNGPXHJcbiAgICBpZiAoaXNNb2JpbGUgJiYgYXJncy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgLy8g0JHQtdGA0LXQvCDRgtC+0LvRjNC60L4g0L/QtdGA0LLRi9C5INCw0YDQs9GD0LzQtdC90YIg0LTQu9GPINGN0LrQvtC90L7QvNC40Lgg0L/QsNC80Y/RgtC4XHJcbiAgICAgICAgY29uc29sZS53YXJuKGAke0xPR19QUkVGSVh9ICR7bWVzc2FnZX1gLCBhcmdzWzBdKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKGAke0xPR19QUkVGSVh9ICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcclxuICAgIH1cclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCBsb2dFcnJvciA9IChtZXNzYWdlLCAuLi5hcmdzKSA9PiB7XHJcbiAgICBjb25zdCBpc01vYmlsZSA9IGlzTW9iaWxlRGV2aWNlKCk7XHJcbiAgICBcclxuICAgIC8vINCS0YHQtdCz0LTQsCDQu9C+0LPQuNGA0YPQtdC8INC+0YjQuNCx0LrQuCwg0L3QviDQvdCwINC80L7QsdC40LvRjNC90YvRhSAtINC60YDQsNGC0LrQvlxyXG4gICAgaWYgKGlzTW9iaWxlKSB7XHJcbiAgICAgICAgLy8g0KHQvtC60YDQsNGJ0LDQtdC8INC00LvQuNC90L3Ri9C1INGB0L7QvtCx0YnQtdC90LjRjyDQvtCxINC+0YjQuNCx0LrQsNGFXHJcbiAgICAgICAgY29uc3Qgc2hvcnRNZXNzYWdlID0gbWVzc2FnZS5sZW5ndGggPiAxMDAgPyBtZXNzYWdlLnN1YnN0cmluZygwLCAxMDApICsgJy4uLicgOiBtZXNzYWdlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vINCb0L7Qs9C40YDRg9C10Lwg0YLQvtC70YzQutC+INC/0LXRgNCy0YvQtSAyINCw0YDQs9GD0LzQtdC90YLQsFxyXG4gICAgICAgIGNvbnN0IGxpbWl0ZWRBcmdzID0gYXJncy5zbGljZSgwLCAyKTtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGAke0xPR19QUkVGSVh9ICR7c2hvcnRNZXNzYWdlfWAsIC4uLmxpbWl0ZWRBcmdzKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgJHtMT0dfUFJFRklYfSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaXNFeHRlbnNpb25Db250ZXh0VmFsaWQgPSAoKSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiAhIWNocm9tZS5ydW50aW1lLmlkO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIGNvbnN0IGlzTW9iaWxlID0gaXNNb2JpbGVEZXZpY2UoKTtcclxuICAgIGNvbnN0IGVycm9yTXNnID0gaXNNb2JpbGUgPyAnRXh0ZW5zaW9uIGNvbnRleHQgaW52YWxpZGF0ZWQnIDogYEV4dGVuc2lvbiBjb250ZXh0IGludmFsaWRhdGVkOiAke2V9YDtcclxuICAgIGxvZ0Vycm9yKGVycm9yTXNnKTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgZ2V0RWxlbWVudHMgPSAoc2VsZWN0b3IpID0+IHtcclxuICAgIGNvbnN0IGR5bmFtaWNTZWxlY3RvcnMgPSBbXHJcbiAgICAgICAgJy50cmFkZV9faW52ZW50b3J5LWl0ZW0nLFxyXG4gICAgICAgICcuY2FyZC1maWx0ZXItbGlzdF9fY2FyZCcsXHJcbiAgICAgICAgJy50cmFkZV9fbWFpbi1pdGVtJyxcclxuICAgICAgICAnLmxvb3Rib3hfX2NhcmQnLCBcclxuICAgICAgICAnLmRlY2tfX2l0ZW0nXHJcbiAgICBdO1xyXG4gICAgXHJcbiAgICBjb25zdCBpc01vYmlsZSA9IGlzTW9iaWxlRGV2aWNlKCk7XHJcbiAgICBcclxuICAgIC8vIOKtkCDQntCf0KLQmNCc0JjQl9CQ0KbQmNCvOiDQndCwINC80L7QsdC40LvRjNC90YvRhSDRh9Cw0YnQtSDQvtCx0L3QvtCy0LvRj9C10Lwg0LrRjdGIXHJcbiAgICBpZiAoIWNhY2hlZEVsZW1lbnRzLmhhcyhzZWxlY3RvcikgfHwgZHluYW1pY1NlbGVjdG9ycy5pbmNsdWRlcyhzZWxlY3RvcikgfHwgaXNNb2JpbGUpIHtcclxuICAgICAgICBjb25zdCBlbGVtZW50cyA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xyXG4gICAgICAgIGNhY2hlZEVsZW1lbnRzLnNldChzZWxlY3RvciwgZWxlbWVudHMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc01vYmlsZSAmJiBlbGVtZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIC8vINCd0LAg0LzQvtCx0LjQu9GM0L3Ri9GFINC70L7Qs9C40YDRg9C10Lwg0YLQvtC70YzQutC+INC10YHQu9C4INC80L3QvtCz0L4g0Y3Qu9C10LzQtdC90YLQvtCyXHJcbiAgICAgICAgICAgIGlmIChlbGVtZW50cy5sZW5ndGggPiA1KSB7XHJcbiAgICAgICAgICAgICAgICBsb2coYENhY2hlZCAke2VsZW1lbnRzLmxlbmd0aH0gZWxlbWVudHMgZm9yICR7c2VsZWN0b3J9IChtb2JpbGUpYCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3VsdCA9IGNhY2hlZEVsZW1lbnRzLmdldChzZWxlY3RvcikgfHwgW107XHJcbiAgICBcclxuICAgIC8vIOKtkCDQkdCV0JfQntCf0JDQodCd0J7QodCi0Kw6INCf0YDQvtCy0LXRgNGP0LXQvCDRh9GC0L4g0Y3Qu9C10LzQtdC90YLRiyDQstGB0LUg0LXRidC1INCyIERPTSAo0L7RgdC+0LHQtdC90L3QviDQstCw0LbQvdC+INC00LvRjyDQvNC+0LHQuNC70YzQvdGL0YUpXHJcbiAgICBpZiAoaXNNb2JpbGUgJiYgcmVzdWx0Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjb25zdCB2YWxpZEVsZW1lbnRzID0gcmVzdWx0LmZpbHRlcihlbCA9PiBlbC5pc0Nvbm5lY3RlZCk7XHJcbiAgICAgICAgaWYgKHZhbGlkRWxlbWVudHMubGVuZ3RoICE9PSByZXN1bHQubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQutGN0Ygg0LXRgdC70Lgg0L3QtdC60L7RgtC+0YDRi9C1INGN0LvQtdC80LXQvdGC0Ysg0YPQtNCw0LvQtdC90YtcclxuICAgICAgICAgICAgY2FjaGVkRWxlbWVudHMuc2V0KHNlbGVjdG9yLCB2YWxpZEVsZW1lbnRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbGlkRWxlbWVudHM7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGRlYm91bmNlID0gKGZ1bmMsIHdhaXQpID0+IHtcclxuICBsZXQgdGltZW91dDtcclxuICBjb25zdCBpc01vYmlsZSA9IGlzTW9iaWxlRGV2aWNlKCk7XHJcbiAgXHJcbiAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCd0LAg0LzQvtCx0LjQu9GM0L3Ri9GFINGD0LLQtdC70LjRh9C40LLQsNC10Lwg0LfQsNC00LXRgNC20LrRgyDQv9C+INGD0LzQvtC70YfQsNC90LjRjlxyXG4gIGNvbnN0IGVmZmVjdGl2ZVdhaXQgPSBpc01vYmlsZSA/IE1hdGgubWF4KHdhaXQsIDMwMCkgOiB3YWl0O1xyXG4gIFxyXG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xyXG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gZnVuYy5hcHBseSh0aGlzLCBhcmdzKSwgZWZmZWN0aXZlV2FpdCk7XHJcbiAgfTtcclxufTtcclxuXHJcbmV4cG9ydCBjb25zdCB3YWl0Rm9yRWxlbWVudHMgPSAoc2VsZWN0b3IsIHRpbWVvdXQsIHNpbmdsZSA9IGZhbHNlKSA9PiB7XHJcbiAgY29uc3QgaXNNb2JpbGUgPSBpc01vYmlsZURldmljZSgpO1xyXG4gIFxyXG4gIC8vIOKtkCDQkNCU0JDQn9Ci0JDQptCY0K86INCj0LLQtdC70LjRh9C40LLQsNC10Lwg0YLQsNC50LzQsNGD0YIg0LTQu9GPINC80L7QsdC40LvRjNC90YvRhSAo0LzQtdC00LvQtdC90L3Ri9C1INGD0YHRgtGA0L7QudGB0YLQstCwKVxyXG4gIGNvbnN0IGVmZmVjdGl2ZVRpbWVvdXQgPSBpc01vYmlsZSA/IHRpbWVvdXQgKiAxLjUgOiB0aW1lb3V0O1xyXG4gIFxyXG4gIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcclxuICAgIGxldCBpbnRlcnZhbElkO1xyXG4gICAgY29uc3QgdGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsSWQpO1xyXG4gICAgICBcclxuICAgICAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCg0LDQt9C90YvQtSDRgdC+0L7QsdGJ0LXQvdC40Y8g0LTQu9GPINC80L7QsdC40LvRjNC90YvRhVxyXG4gICAgICBjb25zdCB3YXJuTXNnID0gaXNNb2JpbGUgPyBcclxuICAgICAgICAgIGBUaW1lb3V0ICgke2VmZmVjdGl2ZVRpbWVvdXR9bXMpIHdhaXRpbmcgZm9yICR7c2VsZWN0b3J9YCA6XHJcbiAgICAgICAgICBgVGltZW91dCB3YWl0aW5nIGZvciAke3NlbGVjdG9yfWA7XHJcbiAgICAgIFxyXG4gICAgICBsb2dXYXJuKHdhcm5Nc2cpO1xyXG4gICAgICByZXNvbHZlKHNpbmdsZSA/IG51bGwgOiBbXSk7XHJcbiAgICB9LCBlZmZlY3RpdmVUaW1lb3V0KTtcclxuXHJcbiAgICAvLyDirZAg0J7Qn9Ci0JjQnNCY0JfQkNCm0JjQrzog0J3QsCDQvNC+0LHQuNC70YzQvdGL0YUg0L/RgNC+0LLQtdGA0Y/QtdC8INGA0LXQttC1INC00LvRjyDRjdC60L7QvdC+0LzQuNC4INCx0LDRgtCw0YDQtdC4XHJcbiAgICBjb25zdCBjaGVja0ludGVydmFsID0gaXNNb2JpbGUgPyAyMDAgOiAxMDA7XHJcbiAgICBcclxuICAgIGludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGVsZW1lbnRzID0gc2luZ2xlID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcikgOiBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpKTtcclxuICAgICAgaWYgKChzaW5nbGUgJiYgZWxlbWVudHMpIHx8ICghc2luZ2xlICYmIGVsZW1lbnRzLmxlbmd0aCA+IDApKSB7XHJcbiAgICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbElkKTtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZXJJZCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8g4q2QINCe0J/QotCY0JzQmNCX0JDQptCY0K86INCc0LXQvdGM0YjQtSDQu9C+0LPQuNGA0L7QstCw0L3QuNGPINC90LAg0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbiAgICAgICAgaWYgKCFpc01vYmlsZSB8fCBlbGVtZW50cy5sZW5ndGggPiAzKSB7XHJcbiAgICAgICAgICBsb2coYEZvdW5kICR7c2luZ2xlID8gJ2VsZW1lbnQnIDogZWxlbWVudHMubGVuZ3RoICsgJyBlbGVtZW50cyd9IGZvciAke3NlbGVjdG9yfSR7aXNNb2JpbGUgPyAnIChtb2JpbGUpJyA6ICcnfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXNvbHZlKGVsZW1lbnRzKTtcclxuICAgICAgfVxyXG4gICAgfSwgY2hlY2tJbnRlcnZhbCk7XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vLyDirZAg0JTQntCR0JDQktCY0KLQrDog0J3QvtCy0YvQtSDRg9GC0LjQu9C40YLRiyDQtNC70Y8g0LzQvtCx0LjQu9GM0L3Ri9GFXHJcbmV4cG9ydCBjb25zdCBnZXRTY3JlZW5JbmZvID0gKCkgPT4ge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB3aWR0aDogd2luZG93LmlubmVyV2lkdGgsXHJcbiAgICAgICAgaGVpZ2h0OiB3aW5kb3cuaW5uZXJIZWlnaHQsXHJcbiAgICAgICAgaXNNb2JpbGU6IGlzTW9iaWxlRGV2aWNlKCksXHJcbiAgICAgICAgcGl4ZWxSYXRpbzogd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMSxcclxuICAgICAgICBvcmllbnRhdGlvbjogd2luZG93LmlubmVyV2lkdGggPiB3aW5kb3cuaW5uZXJIZWlnaHQgPyAnbGFuZHNjYXBlJyA6ICdwb3J0cmFpdCdcclxuICAgIH07XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaXNUb3VjaERldmljZSA9ICgpID0+IHtcclxuICAgIHJldHVybiAnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cgfHwgXHJcbiAgICAgICAgICAgbmF2aWdhdG9yLm1heFRvdWNoUG9pbnRzID4gMCB8fCBcclxuICAgICAgICAgICBuYXZpZ2F0b3IubXNNYXhUb3VjaFBvaW50cyA+IDA7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3Qgb3B0aW1pemVGb3JNb2JpbGUgPSAoZWxlbWVudCkgPT4ge1xyXG4gICAgaWYgKCFpc01vYmlsZURldmljZSgpKSByZXR1cm4gZWxlbWVudDtcclxuICAgIFxyXG4gICAgLy8g0J/RgNC40LzQtdC90Y/QtdC8INC80L7QsdC40LvRjNC90YvQtSDQvtC/0YLQuNC80LjQt9Cw0YbQuNC4INC6INGN0LvQtdC80LXQvdGC0YNcclxuICAgIGlmIChlbGVtZW50ICYmIGVsZW1lbnQuc3R5bGUpIHtcclxuICAgICAgICAvLyDQo9Cy0LXQu9C40YfQuNCy0LDQtdC8INC+0LHQu9Cw0YHRgtGMINC60LDRgdCw0L3QuNGPXHJcbiAgICAgICAgZWxlbWVudC5zdHlsZS5taW5IZWlnaHQgPSAnNDRweCc7XHJcbiAgICAgICAgZWxlbWVudC5zdHlsZS5taW5XaWR0aCA9ICc0NHB4JztcclxuICAgICAgICBcclxuICAgICAgICAvLyDQo9C70YPRh9GI0LDQtdC8INGH0LjRgtCw0LXQvNC+0YHRgtGMXHJcbiAgICAgICAgZWxlbWVudC5zdHlsZS5mb250U2l6ZSA9ICdjYWxjKDEwMCUgKyAycHgpJztcclxuICAgICAgICBcclxuICAgICAgICAvLyDQo9Cx0LjRgNCw0LXQvCDQv9C+0LTRgdCy0LXRgtC60YMg0L/RgNC4INGC0LDQv9C1ICjQtNC70Y8gaU9TKVxyXG4gICAgICAgIGVsZW1lbnQuc3R5bGUud2Via2l0VGFwSGlnaGxpZ2h0Q29sb3IgPSAndHJhbnNwYXJlbnQnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vINCj0LvRg9GH0YjQsNC10Lwg0L/Qu9Cw0LLQvdC+0YHRgtGMINCw0L3QuNC80LDRhtC40LlcclxuICAgICAgICBlbGVtZW50LnN0eWxlLndpbGxDaGFuZ2UgPSAndHJhbnNmb3JtLCBvcGFjaXR5JztcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGVsZW1lbnQ7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgdGhyb3R0bGUgPSAoZnVuYywgbGltaXQpID0+IHtcclxuICAgIGNvbnN0IGlzTW9iaWxlID0gaXNNb2JpbGVEZXZpY2UoKTtcclxuICAgIC8vINCd0LAg0LzQvtCx0LjQu9GM0L3Ri9GFINC40YHQv9C+0LvRjNC30YPQtdC8INCx0L7Qu9GM0YjQuNC5INC70LjQvNC40YIg0LTQu9GPINGN0LrQvtC90L7QvNC40Lgg0LHQsNGC0LDRgNC10LhcclxuICAgIGNvbnN0IGVmZmVjdGl2ZUxpbWl0ID0gaXNNb2JpbGUgPyBsaW1pdCAqIDIgOiBsaW1pdDtcclxuICAgIFxyXG4gICAgbGV0IGluVGhyb3R0bGU7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgY29uc3QgYXJncyA9IGFyZ3VtZW50cztcclxuICAgICAgICBjb25zdCBjb250ZXh0ID0gdGhpcztcclxuICAgICAgICBpZiAoIWluVGhyb3R0bGUpIHtcclxuICAgICAgICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcclxuICAgICAgICAgICAgaW5UaHJvdHRsZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gaW5UaHJvdHRsZSA9IGZhbHNlLCBlZmZlY3RpdmVMaW1pdCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufTtcclxuXHJcbi8vIOKtkCDQlNCe0JHQkNCS0JjQotCsOiDQpNGD0L3QutGG0LjRjyDQtNC70Y8g0LHQtdC30L7Qv9Cw0YHQvdC+0LPQviDRg9C00LDQu9C10L3QuNGPINGN0LvQtdC80LXQvdGC0L7QsiAo0L7RgdC+0LHQtdC90L3QviDQvdCwINC80L7QsdC40LvRjNC90YvRhSlcclxuZXhwb3J0IGNvbnN0IHNhZmVSZW1vdmUgPSAoZWxlbWVudCkgPT4ge1xyXG4gICAgaWYgKCFlbGVtZW50IHx8ICFlbGVtZW50LnBhcmVudE5vZGUpIHJldHVybiBmYWxzZTtcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGlmIChpc01vYmlsZURldmljZSgpKSB7XHJcbiAgICAgICAgICAgIGxvZ1dhcm4oJ0ZhaWxlZCB0byByZW1vdmUgZWxlbWVudCBvbiBtb2JpbGU6JywgZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byByZW1vdmUgZWxlbWVudDonLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxufTtcclxuXHJcbi8vIOKtkCDQlNCe0JHQkNCS0JjQotCsOiDQpNGD0L3QutGG0LjRjyDQtNC70Y8g0LjQt9C80LXRgNC10L3QuNGPINC/0YDQvtC40LfQstC+0LTQuNGC0LXQu9GM0L3QvtGB0YLQuCAo0YLQvtC70YzQutC+INC00LvRjyBkZXYpXHJcbmV4cG9ydCBjb25zdCBtZWFzdXJlUGVyZm9ybWFuY2UgPSAobmFtZSwgZnVuYykgPT4ge1xyXG4gICAgaWYgKCFpc01vYmlsZURldmljZSgpKSB7XHJcbiAgICAgICAgLy8g0J3QsCDQtNC10YHQutGC0L7Qv9C1IC0g0L/QvtC70L3QvtC1INC40LfQvNC10YDQtdC90LjQtVxyXG4gICAgICAgIGNvbnNvbGUudGltZShgJHtMT0dfUFJFRklYfSAke25hbWV9YCk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZnVuYygpO1xyXG4gICAgICAgIGNvbnNvbGUudGltZUVuZChgJHtMT0dfUFJFRklYfSAke25hbWV9YCk7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8g0J3QsCDQvNC+0LHQuNC70YzQvdGL0YUgLSDQv9GA0L7RgdGC0L4g0LLRi9C/0L7Qu9C90Y/QtdC8ICjQuNC30LzQtdGA0LXQvdC40Y8g0YLRgNCw0YLRj9GCINGA0LXRgdGD0YDRgdGLKVxyXG4gICAgICAgIHJldHVybiBmdW5jKCk7XHJcbiAgICB9XHJcbn07IiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIiLCIvLyBzdGFydHVwXG4vLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8vIFRoaXMgZW50cnkgbW9kdWxlIGlzIHJlZmVyZW5jZWQgYnkgb3RoZXIgbW9kdWxlcyBzbyBpdCBjYW4ndCBiZSBpbmxpbmVkXG52YXIgX193ZWJwYWNrX2V4cG9ydHNfXyA9IF9fd2VicGFja19yZXF1aXJlX18oXCIuL21haW4uanNcIik7XG4iLCIiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=