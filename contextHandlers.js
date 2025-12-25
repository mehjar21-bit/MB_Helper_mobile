import { getSettings } from './settings.js';
import { processCards } from './cardProcessor.js';
import { getElements, waitForElements, log, logWarn, logError, debounce, cachedElements, isExtensionContextValid } from './utils.js';
import { contextsSelectors, BASE_URL, initialContextState } from './config.js';
import { contextState } from './main.js'; 

export const initUserCards = async () => {
  const controlsContainer = document.querySelector('.card-controls.scroll-hidden');
  if (!controlsContainer) {
      logWarn('initUserCards: Controls container not found.');
      return;
  }
  controlsContainer.querySelector('.wishlist-toggle-btn')?.remove();

  const settings = await getSettings();
  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('button', 'wishlist-toggle-btn');
  toggleBtn.style.marginLeft = '10px';
  controlsContainer.appendChild(toggleBtn);

  // ⭐ ДОБАВЛЯЕМ: Определяем мобильное устройство
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const updateUserCardButtonState = () => {
      getSettings().then(currentSettings => {
          const currentContextState = contextState['userCards'] || initialContextState['userCards']; 
          if (currentSettings.alwaysShowWishlist) {
              toggleBtn.textContent = 'Желающие (всегда)';
              toggleBtn.disabled = true;
              toggleBtn.style.opacity = '0.7';
              if (contextState.userCards) contextState.userCards.wishlist = true;
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
    const currentSettings = await getSettings();
    if (currentSettings.alwaysShowWishlist) return;

    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Загрузка...';

    if (contextState.userCards) {
         contextState.userCards.wishlist = !contextState.userCards.wishlist;
    } else {
         contextState.userCards = { ...initialContextState.userCards, wishlist: !initialContextState.userCards.wishlist };
    }

    cachedElements.delete(contextsSelectors.userCards); 
    await processCards('userCards', currentSettings); 
    updateUserCardButtonState(); 
    log(`UserCards: Toggled wishlist visibility: ${contextState.userCards?.wishlist}`);
  });

  const cardItems = getElements(contextsSelectors.userCards);
  
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

  const initialShowWishlist = settings.alwaysShowWishlist || contextState.userCards?.wishlist;
  if (initialShowWishlist) {
    log('initUserCards: Initial wishlist processing needed.');
    cachedElements.delete(contextsSelectors.userCards);
    await processCards('userCards', settings);
  }
};

// ⭐ НОВАЯ ФУНКЦИЯ: Заменяет handleUserCardContextMenu
const handleCreateLotFromCard = async (cardItem) => {
  const lockButton = cardItem.querySelector('.lock-card-btn');
  const imageDiv = cardItem.querySelector('.manga-cards__image');

  if (!lockButton) {
    logWarn('CreateLot: Lock button (.lock-card-btn) not found.');
    alert('Не удалось найти данные карты');
    return;
  }
  if (!imageDiv) {
    logWarn('CreateLot: Image div (.manga-cards__image) not found.');
    alert('Не удалось найти изображение карты');
    return;
  }

  const cardInstanceId = lockButton.getAttribute('data-id');
  const bgImageStyle = imageDiv.style.backgroundImage;
  const urlMatch = bgImageStyle.match(/url\("?(.+?)"?\)/);
  const imageUrl = urlMatch ? urlMatch[1] : null;

  if (!cardInstanceId) {
    logWarn('CreateLot: Missing data-id on lock button.');
    alert('Ошибка: ID карты не найден');
    return;
  }
  if (!imageUrl) {
    logWarn('CreateLot: Could not extract image URL from style:', bgImageStyle);
    alert('Ошибка: Изображение карты не найдено');
    return;
  }

  log(`CreateLot: Selected card instance ID: ${cardInstanceId}, Image: ${imageUrl}`);

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
    log('CreateLot: Saved card data to local storage:', dataToSave);
    
    // Подтверждение пользователя (опционально)
    if (confirm('Перейти к созданию лота на маркете?')) {
      window.location.href = `${BASE_URL}/market/create`;
    } else {
      // Восстанавливаем кнопку если пользователь передумал
      lockButton.textContent = originalText;
      lockButton.disabled = false;
      await chrome.storage.local.remove('selectedMarketCardData');
    }
    
  } catch (error) {
    logError('CreateLot: Error saving data:', error);
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

export const handleMarketCreatePage = async () => {
  // ... существующий код БЕЗ ИЗМЕНЕНИЙ ...
  // (оставляем как есть, он нужен для автоматического заполнения)
};

export const initStatsButtons = async (context, targetSelector, buttonClass) => {
    const targetDiv = document.querySelector(targetSelector);
    if (!targetDiv) {
        logWarn(`initStatsButtons: Target selector '${targetSelector}' not found for context '${context}'.`);
        return;
    }
    
    // ⭐ ДОБАВЛЯЕМ: Определяем мобильное устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const settings = await getSettings();
    const currentContextState = contextState[context] || initialContextState[context]; 

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
          const currentSettingsClick = await getSettings();
          const currentAlwaysShow = name === 'wishlist' ? currentSettingsClick.alwaysShowWishlist : currentSettingsClick.alwaysShowOwners;
          if (currentAlwaysShow) return; 

          btn.disabled = true;
          btn.textContent = '...';

          if (contextState[context]) {
              contextState[context][name] = !contextState[context][name];
          } else {
              contextState[context] = { ...initialContextState[context], [name]: !initialContextState[context][name] };
          }
          const isActive = contextState[context][name]; 

          updateButtonAppearance(btn, isActive, name, activeClass, text, currentAlwaysShow); 

          cachedElements.delete(contextsSelectors[context]);
          processCards(context, currentSettingsClick)
            .catch(err => logError(`Error processing cards after ${name} toggle in ${context}:`, err))
            .finally(() => {
                 btn.disabled = false;
                 updateButtonAppearance(btn, contextState[context]?.[name], name, activeClass, text, currentAlwaysShow);
                 log(`${context}: Toggled ${name} visibility: ${contextState[context]?.[name]}`);
          });
        });
      }

      updateButtonAppearance(btn, currentContextState[name], name, activeClass, text, alwaysShowSetting);
    });

    const shouldProcessInitially = (settings.alwaysShowWishlist || currentContextState.wishlist) || (settings.alwaysShowOwners || currentContextState.owners);
    if (shouldProcessInitially) {
      log(`initStatsButtons: Initial processing needed for ${context}.`);
      cachedElements.delete(contextsSelectors[context]); 
      await processCards(context, settings); 
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


export const initPackPage = async () => {
  const packContainer = document.querySelector('.lootbox__inner');
  if (!packContainer) {
    logWarn('PackPage: Pack container (.lootbox__inner) not found');
    return;
  }
  const settings = await getSettings();
  const context = 'pack';
  const currentPackState = contextState[context] || initialContextState[context];

  const processExistingCards = async () => {
      if (settings.alwaysShowWishlist || currentPackState.wishlist) {
          const initialCards = packContainer.querySelectorAll(contextsSelectors.pack);
          if (initialCards.length > 0) {
              cachedElements.delete(contextsSelectors.pack);
              await processCards('pack', settings);
          }
      } else {
           const existingLabels = packContainer.querySelectorAll('.wishlist-warning, .owners-count');
           existingLabels.forEach(label => label.remove());
      }
  };

  await processExistingCards();

  const observerCallback = debounce(async (mutations) => {
      if (!isExtensionContextValid()) {
          logWarn('PackPage: Observer callback skipped, extension context lost.');
          return;
      }
      let cardsChanged = false;
      for (const mutation of mutations) {
          if (mutation.type === 'childList') {
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.matches?.(contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.matches?.(contextsSelectors.pack))) {
                  cardsChanged = true;
                  break;
              }
              if (Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.querySelector?.(contextsSelectors.pack)) ||
                  Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && node.querySelector?.(contextsSelectors.pack))) {
                   cardsChanged = true;
                   break;
              }

          } else if (mutation.type === 'attributes' && (mutation.attributeName === 'data-id' || mutation.attributeName === 'class') && mutation.target.matches?.(contextsSelectors.pack)) {
              cardsChanged = true;
              break;
          }
      }

      if (cardsChanged) {
          const currentSettings = await getSettings(); 
          const currentPackStateUpdated = contextState[context] || initialContextState[context]; 
          const shouldShowLabels = currentSettings.alwaysShowWishlist || currentPackStateUpdated.wishlist;

          if (shouldShowLabels) {
              cachedElements.delete(contextsSelectors.pack);
              await processCards(context, currentSettings); 
          } else {
              const cardItems = getElements(contextsSelectors.pack);
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
      log('PackPage: Setup observer for pack container');
  } else {
       logWarn('PackPage: Observer already exists for pack container.');
  }
};