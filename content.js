// Content script for ProductivityPal

// Listen for focus mode changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFocusMode') {
    if (request.enabled) {
      enableFocusMode();
    } else {
      disableFocusMode();
    }
  }
});

function enableFocusMode() {
  // Add focus mode overlay if on distracting site
  const overlay = document.createElement('div');
  overlay.id = 'productivity-pal-overlay';
  overlay.innerHTML = `
    <div class="focus-message">
      <h2>🎯 Focus Mode Active</h2>
      <p>This site is blocked to help you stay focused.</p>
      <button id="proceed-anyway">Proceed Anyway (Not Recommended)</button>
    </div>
  `;
  
  // Style the overlay
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Arial, sans-serif;
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listener to the proceed button
  document.getElementById('proceed-anyway').addEventListener('click', () => {
    overlay.remove();
    // Log this as a distraction in the activity feed
    chrome.runtime.sendMessage({
      action: 'logActivity',
      activity: {
        type: 'distraction',
        description: `Visited blocked site: ${window.location.hostname}`,
        timestamp: Date.now()
      }
    });
  });
}

function disableFocusMode() {
  const overlay = document.getElementById('productivity-pal-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Track page visibility
document.addEventListener('visibilitychange', () => {
  chrome.runtime.sendMessage({
    action: 'updateVisibility',
    visible: !document.hidden
  });
});
