document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get(['active', 'displayStyle'], function(result) {
    const activeToggle = document.getElementById('activeToggle');
    const displayStyle = document.getElementById('displayStyle');
    
    // Set default values if not found in storage
    activeToggle.checked = result.active !== undefined ? result.active : true;
    displayStyle.value = result.displayStyle || 'inline';
    
    // Save settings when changed
    activeToggle.addEventListener('change', function() {
      chrome.storage.sync.set({active: this.checked});
      // Also notify content script about the change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url.includes('news.google.com')) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'toggleActive',
            value: activeToggle.checked
          });
        }
      });
    });
    
    displayStyle.addEventListener('change', function() {
      chrome.storage.sync.set({displayStyle: this.value});
      // Notify content script about the display style change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url.includes('news.google.com')) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'updateDisplayStyle',
            value: displayStyle.value
          });
        }
      });
    });
  });
  
  // Report issue button
  document.getElementById('reportIssue').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url.includes('news.google.com')) {
        chrome.tabs.sendMessage(activeTab.id, {action: 'reportIssue'});
      }
    });
  });
});
