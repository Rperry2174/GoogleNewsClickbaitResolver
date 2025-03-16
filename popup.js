document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.sync.get(
    ['active', 'displayStyle', 'debugMode', 'useAI', 'aiApiKey', 'batchSize'], 
    function(result) {
      const activeToggle = document.getElementById('activeToggle');
      const displayStyle = document.getElementById('displayStyle');
      const debugModeToggle = document.getElementById('debugModeToggle');
      const useAIToggle = document.getElementById('useAIToggle');
      const aiApiKey = document.getElementById('aiApiKey');
      const batchSize = document.getElementById('batchSize');
      
      // Set default values if not found in storage
      activeToggle.checked = result.active !== undefined ? result.active : true;
      displayStyle.value = result.displayStyle || 'inline';
      debugModeToggle.checked = result.debugMode !== undefined ? result.debugMode : true;
      useAIToggle.checked = result.useAI !== undefined ? result.useAI : true;
      aiApiKey.value = result.aiApiKey || '';
      batchSize.value = result.batchSize || '10';
      
      // Toggle AI key field visibility based on useAI setting
      document.getElementById('aiKeyContainer').style.display = 
        useAIToggle.checked ? 'block' : 'none';
      
      // Save settings when changed
      activeToggle.addEventListener('change', function() {
        chrome.storage.sync.set({active: this.checked});
        notifyContentScript('toggleActive', this.checked);
      });
      
      displayStyle.addEventListener('change', function() {
        chrome.storage.sync.set({displayStyle: this.value});
        notifyContentScript('updateDisplayStyle', this.value);
      });
      
      debugModeToggle.addEventListener('change', function() {
        chrome.storage.sync.set({debugMode: this.checked});
        notifyContentScript('updateDebugMode', this.checked);
      });
      
      useAIToggle.addEventListener('change', function() {
        chrome.storage.sync.set({useAI: this.checked});
        document.getElementById('aiKeyContainer').style.display = 
          this.checked ? 'block' : 'none';
        notifyContentScript('updateUseAI', this.checked);
      });
      
      aiApiKey.addEventListener('change', function() {
        chrome.storage.sync.set({aiApiKey: this.value});
        notifyContentScript('updateAIKey', this.value);
      });
      
      batchSize.addEventListener('change', function() {
        chrome.storage.sync.set({batchSize: this.value});
        notifyContentScript('updateBatchSize', this.value);
      });
    }
  );
  
  // Helper function to notify content script
  function notifyContentScript(action, value) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url.includes('news.google.com')) {
        chrome.tabs.sendMessage(activeTab.id, {
          action: action,
          value: value
        });
      }
    });
  }
  
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
