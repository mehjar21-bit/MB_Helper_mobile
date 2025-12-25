import { log, logWarn, logError } from './utils.js';

export const addTextLabel = (container, className, text, title, position, type, options = {}, context) => {
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
      log(`Added mobile label "${className}" with size ${fontSize} at ${topPosition}`);
    }

  } catch (error) {
      logError(`Error adding label "${className}" in context "${context}":`, error);
      // ⭐ НЕ ЛОГИРУЕМ ВЕСЬ CONTAINER НА МОБИЛЬНЫХ
      if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        logError('Container:', container);
      }
  }
};


export const addExtensionSettingsButton = () => {
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
    log(`Added extension settings button ${isMobile ? '(mobile adapted)' : ''}`);
    
  } catch (error) {
      logError('Error adding settings button:', error);
  }
};

// ⭐ ДОБАВИТЬ: Новую функцию для мобильной оптимизации
export const addMobileOptimizations = () => {
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
    
    log('Applied mobile touch optimizations');
  } catch (error) {
    logError('Error applying mobile optimizations:', error);
  }
};