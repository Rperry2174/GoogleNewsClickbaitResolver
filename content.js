// Initialize settings
let isActive = true;
let displayStyle = 'inline';
let processedHeadlines = new Set();
let articleCache = {};

// Load settings from storage
chrome.storage.sync.get(['active', 'displayStyle', 'cache'], function(result) {
  Logger.info('Extension initializing with settings:', result);
  
  isActive = result.active !== undefined ? result.active : true;
  displayStyle = result.displayStyle || 'inline';
  articleCache = result.cache || {};
  
  Logger.debug('Settings loaded', {
    active: isActive,
    displayStyle: displayStyle,
    cacheSize: Object.keys(articleCache).length
  });
  
  // Start processing if active
  if (isActive) {
    Logger.info('Extension is active, processing page');
    processGoogleNewsPage();
    setupObserver();
  } else {
    Logger.info('Extension is disabled');
  }
});

// Process Google News page
function processGoogleNewsPage() {
  Logger.time('processGoogleNewsPage');
  
  // Find all headline elements
  const headlines = findHeadlineElements();
  Logger.info(`Found ${headlines.length} potential headlines on page`);
  
  let clickbaitCount = 0;
  
  headlines.forEach(headline => {
    if (processedHeadlines.has(headline)) {
      Logger.debug('Headline already processed, skipping', headline);
      return;
    }
    
    const headlineText = headline.textContent.trim();
    Logger.debug('Analyzing headline:', headlineText);
    
    if (isClickbait(headlineText)) {
      clickbaitCount++;
      Logger.info(`Detected clickbait headline: "${headlineText}"`);
      processedHeadlines.add(headline);
      markAsClickbait(headline);
      
      // Extract article URL
      const articleLink = findArticleLink(headline);
      
      if (articleLink) {
        Logger.debug('Found article link:', articleLink);
        fetchArticleSummary(articleLink, summary => {
          if (summary) {
            Logger.info(`Adding summary to headline: "${headlineText}"`);
            Logger.debug('Summary content:', summary);
            addSummaryToHeadline(headline, summary);
          } else {
            Logger.warn(`Failed to get summary for: "${headlineText}"`);
          }
        });
      } else {
        Logger.warn(`No article link found for headline: "${headlineText}"`);
      }
    } else {
      Logger.debug(`Not clickbait: "${headlineText}"`);
    }
  });
  
  Logger.info(`Found ${clickbaitCount} clickbait headlines out of ${headlines.length} total headlines`);
  Logger.timeEnd('processGoogleNewsPage');
}

// Find headline elements on Google News
function findHeadlineElements() {
  Logger.time('findHeadlineElements');
  // This selector needs to be adjusted based on Google News' current DOM structure
  const selectors = ['h3', 'h4', '.ipQwMb'];
  Logger.debug('Using selectors to find headlines:', selectors);
  
  const headlines = document.querySelectorAll('h3, h4, .ipQwMb');
  Logger.timeEnd('findHeadlineElements');
  return headlines;
}

// Find the article link associated with a headline
function findArticleLink(headlineElement) {
  // First try to find link within the headline
  let link = headlineElement.querySelector('a');
  
  // If not found, try parent elements
  if (!link) {
    let current = headlineElement;
    while (current && current !== document.body) {
      if (current.tagName === 'A' && current.href) {
        link = current;
        break;
      }
      current = current.parentElement;
    }
  }
  
  return link ? link.href : null;
}

// Check if headline is likely clickbait
function isClickbait(headline) {
  Logger.time('isClickbait');
  
  const clickbaitPatterns = [
    // Headlines ending with questions
    /\?$/i,
    
    // "Here's why/how" patterns
    /here['']s\s+why/i,
    /here['']s\s+how/i,
    /this\s+is\s+how/i,
    /the\s+reason\s+is/i,
    
    // Promising information without delivering
    /reveals\s+(shocking|surprising)/i,
    /you\s+won['']t\s+believe/i,
    /what\s+happens\s+next/i,
    
    // Vague pronouns
    /^this\s+is\s+\w+/i,
    /^it['']s\s+\w+/i,
    /^they\s+\w+/i,
    
    // Teasing information
    /find\s+out/i,
    /wait\s+until\s+you\s+see/i,
    /will\s+leave\s+you\s+speechless/i
  ];
  
  // Check each pattern against the headline
  for (const pattern of clickbaitPatterns) {
    if (pattern.test(headline)) {
      Logger.debug(`Headline matched pattern: ${pattern}`, headline);
      Logger.timeEnd('isClickbait');
      return true;
    }
  }
  
  Logger.timeEnd('isClickbait');
  return false;
}

// Mark headline as clickbait (visual indicator)
function markAsClickbait(headlineElement) {
  // Add a visual indicator class
  headlineElement.classList.add('clickbait-headline');
  
  // Insert a small indicator icon
  const indicator = document.createElement('span');
  indicator.classList.add('clickbait-indicator');
  indicator.innerHTML = '🔍'; // Magnifying glass icon
  indicator.title = 'Clickbait headline detected';
  
  headlineElement.appendChild(indicator);
}

// Fetch article summary
function fetchArticleSummary(articleUrl, callback) {
  // Check cache first
  if (articleCache[articleUrl] && (Date.now() - articleCache[articleUrl].timestamp < 3600000)) {
    callback(articleCache[articleUrl].summary);
    return;
  }
  
  // Request article content from background script
  chrome.runtime.sendMessage(
    {
      action: 'fetchArticle',
      url: articleUrl
    },
    response => {
      if (response && response.summary) {
        callback(response.summary);
      } else {
        callback(null);
      }
    }
  );
}

// Add summary to headline
function addSummaryToHeadline(headlineElement, summary) {
  const summaryElement = document.createElement('div');
  summaryElement.classList.add('clickbait-summary');
  summaryElement.textContent = summary;
  
  // Apply different display styles based on user preference
  switch (displayStyle) {
    case 'inline':
      summaryElement.classList.add('inline-summary');
      headlineElement.appendChild(summaryElement);
      break;
    
    case 'below':
      summaryElement.classList.add('below-summary');
      headlineElement.parentNode.insertBefore(summaryElement, headlineElement.nextSibling);
      break;
    
    case 'tooltip':
      summaryElement.classList.add('tooltip-summary');
      headlineElement.appendChild(summaryElement);
      
      // Show on hover
      headlineElement.addEventListener('mouseenter', () => {
        summaryElement.style.display = 'block';
      });
      
      headlineElement.addEventListener('mouseleave', () => {
        summaryElement.style.display = 'none';
      });
      
      // Initially hidden
      summaryElement.style.display = 'none';
      break;
  }
}

// Setup observer for dynamically loaded content
function setupObserver() {
  Logger.info('Setting up MutationObserver for dynamic content');
  
  const observer = new MutationObserver((mutations) => {
    Logger.debug(`Observed ${mutations.length} mutations on page`);
    
    let shouldProcess = false;
    let addedNodesCount = 0;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        addedNodesCount += mutation.addedNodes.length;
        shouldProcess = true;
      }
    });
    
    if (shouldProcess) {
      Logger.info(`Detected ${addedNodesCount} new nodes, reprocessing page`);
      processGoogleNewsPage();
    }
  });
  
  // Observe the entire document for changes
  observer.observe(document.body, { childList: true, subtree: true });
  Logger.debug('MutationObserver started');
}

// Apply styles for our added elements
function applyStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .clickbait-headline {
      position: relative;
    }
    
    .clickbait-indicator {
      display: inline-block;
      margin-left: 8px;
      font-size: 14px;
      color: #1a73e8;
      cursor: help;
    }
    
    .clickbait-summary {
      font-size: 12px;
      line-height: 1.4;
      color: #555;
      background-color: #f8f9fa;
      border-radius: 4px;
      padding: 8px;
      margin-top: 5px;
      border-left: 3px solid #1a73e8;
    }
    
    .tooltip-summary {
      position: absolute;
      z-index: 100;
      width: 250px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      background-color: white;
    }
  `;
  
  document.head.appendChild(style);
}

// Apply styles immediately
applyStyles();

// Handle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleActive') {
    isActive = request.value;
    
    if (isActive) {
      processGoogleNewsPage();
      setupObserver();
    }
    // Note: We don't remove existing summaries when disabled
  }
  
  else if (request.action === 'updateDisplayStyle') {
    displayStyle = request.value;
    
    // Clear processed headlines to reprocess with new style
    processedHeadlines.clear();
    
    // Remove existing summaries
    document.querySelectorAll('.clickbait-summary').forEach(el => el.remove());
    
    // Reprocess with new style
    if (isActive) {
      processGoogleNewsPage();
    }
  }
  
  else if (request.action === 'reportIssue') {
    // Simple implementation: show a small form to report the issue
    const form = document.createElement('div');
    form.classList.add('issue-report-form');
    form.innerHTML = `
      <div class="report-overlay">
        <div class="report-container">
          <h3>Report Issue</h3>
          <p>Please click on the problematic headline and describe the issue:</p>
          <textarea id="issue-description" placeholder="Describe the issue..."></textarea>
          <div class="report-buttons">
            <button id="cancel-report">Cancel</button>
            <button id="submit-report">Submit</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(form);
    
    // Add event listeners for the form
    document.getElementById('cancel-report').addEventListener('click', () => {
      form.remove();
    });
    
    document.getElementById('submit-report').addEventListener('click', () => {
      const description = document.getElementById('issue-description').value;
      // In a real extension, we would send this to a server
      console.log('Issue reported:', description);
      form.innerHTML = '<div class="report-overlay"><div class="report-container"><h3>Thank You</h3><p>Your report has been submitted.</p><button id="close-report">Close</button></div></div>';
      document.getElementById('close-report').addEventListener('click', () => {
        form.remove();
      });
    });
    
    // Add styles for the report form
    const style = document.createElement('style');
    style.textContent = `
      .report-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .report-container {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        width: 400px;
        max-width: 90%;
      }
      
      #issue-description {
        width: 100%;
        height: 100px;
        margin: 10px 0;
        padding: 5px;
      }
      
      .report-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `;
    document.head.appendChild(style);
  }
});
