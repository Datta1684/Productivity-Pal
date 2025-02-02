// Background Service Worker for Productivity Pal

let state = {
  focusModeEnabled: false,
  rules: null,
  activeTimer: null,
  currentSession: null
};

// Initialize the extension
async function initialize() {
  try {
    // Load rules
    const response = await fetch(chrome.runtime.getURL('rules.json'));
    state.rules = await response.json();
    
    // Initialize storage with default settings if not exists
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) {
      await chrome.storage.local.set({
        settings: {
          notificationSound: 'enabled',
          theme: 'light'
        }
      });
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggleFocusMode':
      handleFocusMode(request.value);
      break;
    case 'startTimer':
      startTimer(request.duration);
      break;
    case 'stopTimer':
      stopTimer();
      break;
    case 'syncData':
      syncData();
      break;
  }
  return true; // Required for async response
});

// Focus mode handler
async function handleFocusMode(enabled) {
  state.focusModeEnabled = enabled;
  
  if (enabled) {
    // Start focus session
    state.currentSession = {
      startTime: Date.now(),
      distractions: 0
    };
    
    // Update badge
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    // Show notification
    showNotification('Focus Mode Enabled', 'Stay focused! Distracting sites will be blocked.');
  } else {
    // End focus session
    if (state.currentSession) {
      const session = {
        ...state.currentSession,
        endTime: Date.now(),
        duration: Date.now() - state.currentSession.startTime
      };
      
      // Save session data
      await saveSession(session);
    }
    
    // Reset state
    state.currentSession = null;
    chrome.action.setBadgeText({ text: '' });
    
    // Show notification
    showNotification('Focus Mode Disabled', 'Great job! Your focus session has ended.');
  }
}

// Timer functions
function startTimer(minutes) {
  if (state.activeTimer) {
    clearTimeout(state.activeTimer);
  }
  
  const endTime = Date.now() + minutes * 60 * 1000;
  state.activeTimer = setTimeout(() => {
    showNotification('Timer Complete', 'Time to take a break!');
    playNotificationSound();
    state.activeTimer = null;
  }, minutes * 60 * 1000);
  
  // Update badge with remaining time
  updateTimerBadge(endTime);
}

function stopTimer() {
  if (state.activeTimer) {
    clearTimeout(state.activeTimer);
    state.activeTimer = null;
    chrome.action.setBadgeText({ text: '' });
  }
}

function updateTimerBadge(endTime) {
  const interval = setInterval(() => {
    const remaining = Math.ceil((endTime - Date.now()) / 60000);
    if (remaining <= 0) {
      clearInterval(interval);
      chrome.action.setBadgeText({ text: '' });
    } else {
      chrome.action.setBadgeText({ text: remaining.toString() });
    }
  }, 1000);
}

// Website blocking
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (!state.focusModeEnabled || details.frameId !== 0) return;
  
  const url = new URL(details.url);
  const isDistracting = state.rules.distracting_sites.some(pattern => 
    matchPattern(pattern, url.href)
  );
  
  if (isDistracting) {
    // Increment distraction count
    if (state.currentSession) {
      state.currentSession.distractions++;
    }
    
    // Redirect to blocked page
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('blocked.html')
    });
  }
});

// Helper functions
function matchPattern(pattern, url) {
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '$'
  );
  return regex.test(url);
}

async function saveSession(session) {
  try {
    const { focusSessions = [] } = await chrome.storage.local.get('focusSessions');
    focusSessions.push(session);
    await chrome.storage.local.set({ focusSessions });
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 1
  });
}

function playNotificationSound() {
  const audio = new Audio(chrome.runtime.getURL('notification.mp3'));
  audio.play().catch(error => console.error('Error playing sound:', error));
}

async function syncData() {
  // Implement data sync logic here
  // For now, just return success
  return { success: true };
}

// Initialize the extension
initialize();
