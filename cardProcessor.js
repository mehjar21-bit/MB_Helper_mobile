// cardProcessor.js (АДАПТИРОВАННЫЙ ДЛЯ МОБИЛЬНЫХ)
import { isExtensionContextValid, getElements, log, logWarn, logError } from './utils.js';
import { getWishlistCount, getOwnersCount } from './api.js';
import { addTextLabel } from './domUtils.js';
import { contextsSelectors, getBatchSize, getBatchDelay, getOptimizedSettings, isMobileDevice } from './config.js';
import { contextState } from './main.js'; 

// Обработка карт
export const processCards = async (context, settings) => { 
  if (!isExtensionContextValid()) {
    logWarn('processCards: Extension context invalid, skipping');
    return;
  }

  const selector = contextsSelectors[context];
  if (!selector) {
    logWarn(`No selector defined for context: ${context}`);
    return;
  }

  const cardItems = getElements(selector);
  if (!cardItems.length) {
    log(`No cards found for selector: ${selector}`);
    return;
  }

  // ⭐ АДАПТИВНЫЙ РАЗМЕР ПАКЕТА
  const BATCH_SIZE = getBatchSize();
  const optimizedSettings = getOptimizedSettings();
  const isMobile = isMobileDevice();
  
  log(`Processing ${cardItems.length} cards in context "${context}" (batch size: ${BATCH_SIZE}, device: ${isMobile ? 'mobile' : 'desktop'})`);

  // ⭐ ОПТИМИЗАЦИЯ ДЛЯ МОБИЛЬНЫХ: меньше параллельных запросов
  let processedCount = 0;
  const totalCards = cardItems.length;

  for (let i = 0; i < cardItems.length; i += BATCH_SIZE) {
    const batch = cardItems.slice(i, i + BATCH_SIZE);
    
    // ⭐ ЛОГИРОВАНИЕ ПРОГРЕССА ДЛЯ МОБИЛЬНЫХ
    if (isMobile && processedCount % 5 === 0) {
      log(`Mobile progress: ${processedCount}/${totalCards} cards processed`);
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
        logWarn(`Skipping item in ${context} due to ID error:`, idError.message);
        // ⭐ НЕ ЛОГИРУЕМ ВЕСЬ HTML НА МОБИЛЬНЫХ ДЛЯ ЭКОНОМИИ ПАМЯТИ
        if (!isMobile) {
          logWarn('Item HTML:', item.outerHTML);
        }
        return;
      }

      const showWishlist = settings.alwaysShowWishlist || contextState[context]?.wishlist;
      const showOwners = settings.alwaysShowOwners || contextState[context]?.owners;

      // ⭐ ОПТИМИЗАЦИЯ: Удаляем только если нужно показывать
      if (showWishlist || showOwners) {
        item.querySelector('.wishlist-warning')?.remove();
        item.querySelector('.owners-count')?.remove();
      }

      const tasks = [];

      if (showWishlist) {
        tasks.push(
          getWishlistCount(cardId).then(count => {
            if (!item.isConnected) {
              logWarn(`Card ${cardId} disconnected, skipping label`);
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
            
            addTextLabel(item, 'wishlist-warning', `${count}`, `Хотят: ${count}`, 
                        position, 'wishlist', colorOptions, context);
                        
          }).catch(error => {
            // ⭐ БОЛЕЕ КОРОТКИЕ СООБЩЕНИЯ ОБ ОШИБКАХ ДЛЯ МОБИЛЬНЫХ
            const errorMsg = isMobile ? 
              `Wishlist error for card ${cardId}: ${error.message}` :
              `Error getting wishlist count for card ${cardId} in ${context}: ${error}`;
            logError(errorMsg);
          })
        );
      }

      if (showOwners) {
        tasks.push(
          getOwnersCount(cardId).then(count => {
            if (!item.isConnected) {
              logWarn(`Card ${cardId} disconnected, skipping label`);
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
            
            addTextLabel(item, 'owners-count', `${count}`, `Владеют: ${count}`, 
                        position, 'owners', {}, context);
                        
          }).catch(error => {
            const errorMsg = isMobile ? 
              `Owners error for card ${cardId}: ${error.message}` :
              `Error getting owners count for card ${cardId} in ${context}: ${error}`;
            logError(errorMsg);
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
      logError(`Batch ${i/BATCH_SIZE + 1} failed:`, batchError);
    }

    // ⭐ АДАПТИВНАЯ ЗАДЕРЖКА МЕЖДУ ПАКЕТАМИ
    if (cardItems.length > BATCH_SIZE && i + BATCH_SIZE < cardItems.length) {
      const delay = getBatchDelay();
     const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    await new Promise(r => setTimeout(r, isMobile ? 3000 : 3000));
    }
  } 
  
  log(`Finished processing ${processedCount}/${totalCards} cards in context "${context}"`);
};

// ⭐ ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ МОБИЛЬНОЙ ОПТИМИЗАЦИИ
export const processCardsLazy = async (context, settings, observer = null) => {
  if (!isExtensionContextValid()) return;
  
  const isMobile = isMobileDevice();
  
  // ⭐ НА МОБИЛЬНЫХ: Обрабатываем только видимые карточки
  if (isMobile && typeof IntersectionObserver !== 'undefined') {
    return await processVisibleCards(context, settings, observer);
  }
  
  // ⭐ НА ДЕСКТОПЕ: Стандартная обработка
  return await processCards(context, settings);
};

// ⭐ LAZY LOADING ДЛЯ МОБИЛЬНЫХ (обработка только видимых карточек)
const processVisibleCards = async (context, settings, observer) => {
  const selector = contextsSelectors[context];
  if (!selector) return;
  
  const cardItems = getElements(selector);
  if (!cardItems.length) return;
  
  log(`Lazy processing ${cardItems.length} cards for mobile`);
  
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
  
  log(`Processing ${visibleCards.length} immediately visible cards`);
  
  const BATCH_SIZE = getBatchSize();
  for (let i = 0; i < visibleCards.length; i += BATCH_SIZE) {
    const batch = visibleCards.slice(i, i + BATCH_SIZE);
    const promises = batch.map(item => processSingleCard(item, context, settings));
    
    await Promise.all(promises);
    
    if (i + BATCH_SIZE < visibleCards.length) {
      await new Promise(r => setTimeout(r, getBatchDelay()));
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
  
  const showWishlist = settings.alwaysShowWishlist || contextState[context]?.wishlist;
  const showOwners = settings.alwaysShowOwners || contextState[context]?.owners;
  
  if (!showWishlist && !showOwners) return;
  
  // Удаляем старые метки
  item.querySelector('.wishlist-warning')?.remove();
  item.querySelector('.owners-count')?.remove();
  
  const tasks = [];
  const isMobile = isMobileDevice();
  
  if (showWishlist) {
    tasks.push(
      getWishlistCount(cardId).then(count => {
        if (!item.isConnected) return;
        
        const position = isMobile ? 'top' : 'top';
        const colorOptions = {
          color: count >= settings.wishlistWarning ? 
            (isMobile ? '#FF8C00' : '#FFA500') : 
            (isMobile ? '#32CD32' : '#00FF00')
        };
        
        addTextLabel(item, 'wishlist-warning', `${count}`, `Хотят: ${count}`, 
                    position, 'wishlist', colorOptions, context);
      }).catch(() => { /* ignore */ })
    );
  }
  
  if (showOwners) {
    tasks.push(
      getOwnersCount(cardId).then(count => {
        if (!item.isConnected) return;
        
        const position = isMobile ? (showWishlist ? 'bottom' : 'top') : 'middle';
        addTextLabel(item, 'owners-count', `${count}`, `Владеют: ${count}`, 
                    position, 'owners', {}, context);
      }).catch(() => { /* ignore */ })
    );
  }
  
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};