// Initialize settings
let isActive = true;
let displayStyle = 'inline';
let processedHeadlines = new Set();
let articleCache = {};
let debugMode = true;
let useAI = true;
let batchSize = 10;
let maxHeadlines = 20;
let aiEndpoint = 'https://api.openai.com/v1/chat/completions';
let aiApiKey = ''; // Will need to be set by the user in the popup

// Load settings from storage
chrome.storage.sync.get([
  'active', 
  'displayStyle', 
  'cache', 
  'debugMode', 
  'useAI', 
  'batchSize',
  'maxHeadlines',
  'aiEndpoint',
  'aiApiKey'
], function(result) {
  Logger.info('Extension initializing with settings:', result);
  
  isActive = result.active !== undefined ? result.active : true;
  displayStyle = result.displayStyle || 'inline';
  articleCache = result.cache || {};
  debugMode = result.debugMode !== undefined ? result.debugMode : true;
  useAI = result.useAI !== undefined ? result.useAI : true;
  batchSize = result.batchSize || 10;
  maxHeadlines = result.maxHeadlines || 20;
  aiEndpoint = result.aiEndpoint || 'https://api.openai.com/v1/chat/completions';
  aiApiKey = result.aiApiKey || '';
  
  // Update logger debug mode
  window.Logger.setDebugMode(debugMode);
  
  Logger.debug('Settings loaded', {
    active: isActive,
    displayStyle: displayStyle,
    cacheSize: Object.keys(articleCache).length,
    debugMode: debugMode,
    useAI: useAI,
    batchSize: batchSize,
    maxHeadlines: maxHeadlines
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
  
  // If debug mode is on and no headlines were processed yet, pause for verification
  if (debugMode && processedHeadlines.size === 0) {
    // Show debug information about the first 5 headlines we found
    Logger.group('First few headlines found (debug mode)');
    
    Array.from(headlines).slice(0, 5).forEach((headline, i) => {
      const text = headline.textContent.trim();
      Logger.info(`Headline ${i+1}: "${text}"`);
      
      // Log the path to help identify this element's location in the DOM
      let domPath = [];
      let element = headline;
      while (element && element !== document.body) {
        let identifier = element.tagName.toLowerCase();
        if (element.id) {
          identifier += `#${element.id}`;
        } else if (element.className) {
          identifier += `.${element.className.replace(/\s+/g, '.')}`;
        }
        domPath.unshift(identifier);
        element = element.parentElement;
      }
      
      Logger.debug(`DOM path: ${domPath.join(' > ')}`);
    });
    
    Logger.groupEnd();
    
    // Mark the first headline in debug mode
    if (headlines.length > 0) {
      const firstHeadline = headlines[0];
      const headlineText = firstHeadline.textContent.trim();
      
      Logger.clickbait(`DEBUG MODE: Adding visual indicator to first headline: "${headlineText}"`);
      processedHeadlines.add(firstHeadline);
      markAsClickbait(firstHeadline);
    }
  }
  
  // Ask user if they want to continue processing all headlines
  if (useAI) {
    // Process headlines in batches to save tokens
    processHeadlinesWithAI(headlines);
  } else {
    // Process headlines with traditional pattern matching
    processHeadlinesWithPatterns(headlines);
  }
  
  Logger.timeEnd('processGoogleNewsPage');
}

// Process headlines using traditional pattern matching
function processHeadlinesWithPatterns(headlines) {
  Logger.info('Processing headlines with pattern matching');
  
  // Filter out already processed headlines
  const unprocessedHeadlines = Array.from(headlines).filter(headline => !processedHeadlines.has(headline));
  Logger.debug(`${unprocessedHeadlines.length} unprocessed headlines to analyze`);
  
  // Apply a limit to avoid processing too many headlines
  const maxHeadlinesToProcess = maxHeadlines > 0 ? maxHeadlines : unprocessedHeadlines.length;
  const limitedHeadlines = unprocessedHeadlines.slice(0, maxHeadlinesToProcess);
  
  if (limitedHeadlines.length < unprocessedHeadlines.length) {
    Logger.info(`Limiting processing to ${limitedHeadlines.length} headlines out of ${unprocessedHeadlines.length} total (to avoid excessive processing)`);
  }
  
  let clickbaitCount = 0;
  
  limitedHeadlines.forEach(headline => {
    const headlineText = headline.textContent.trim();
    Logger.debug('Analyzing headline:', headlineText);
    
    if (isClickbait(headlineText)) {
      clickbaitCount++;
      Logger.clickbait(`Detected clickbait headline: "${headlineText}"`);
      processedHeadlines.add(headline);
      markAsClickbait(headline);
      
      // In debug mode, we only add visual indicators, not summaries
      if (!debugMode) {
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
      }
    } else {
      Logger.debug(`Not clickbait: "${headlineText}"`);
    }
  });
  
  Logger.info(`Found ${clickbaitCount} clickbait headlines out of ${limitedHeadlines.length} processed (from ${headlines.length} total)`);
}

// Process headlines using AI in batches
function processHeadlinesWithAI(headlines) {
  Logger.info('Processing headlines with AI in batches');
  
  // Filter out already processed headlines
  const unprocessedHeadlines = Array.from(headlines).filter(headline => !processedHeadlines.has(headline));
  Logger.debug(`${unprocessedHeadlines.length} unprocessed headlines to analyze`);
  
  // Apply a limit to avoid processing too many headlines
  // This helps prevent excessive API usage and keeps the extension focused on main content
  const maxHeadlinesToProcess = maxHeadlines > 0 ? maxHeadlines : unprocessedHeadlines.length;
  const limitedHeadlines = unprocessedHeadlines.slice(0, maxHeadlinesToProcess);
  
  if (limitedHeadlines.length < unprocessedHeadlines.length) {
    Logger.info(`Limiting processing to ${limitedHeadlines.length} headlines out of ${unprocessedHeadlines.length} total (to avoid excessive processing)`);
  }
  
  // Process in batches
  const batches = [];
  for (let i = 0; i < limitedHeadlines.length; i += batchSize) {
    batches.push(limitedHeadlines.slice(i, i + batchSize));
  }
  
  Logger.info(`Split headlines into ${batches.length} batches of up to ${batchSize} headlines each`);
  
  // Process each batch
  batches.forEach((batch, batchIndex) => {
    processHeadlineBatch(batch, batchIndex);
  });
}

// Process a single batch of headlines with AI
function processHeadlineBatch(headlines, batchIndex) {
  Logger.time(`processBatch-${batchIndex}`);
  
  // Extract headline texts and create headline map for reference
  const headlineTexts = [];
  const headlineMap = new Map();
  
  headlines.forEach(headline => {
    const text = headline.textContent.trim();
    headlineTexts.push(text);
    headlineMap.set(text, headline);
  });
  
  Logger.debug(`Batch ${batchIndex} headlines:`, headlineTexts);
  
  // If we don't have an API key, simulate AI for now
  if (!aiApiKey) {
    Logger.warn('No AI API key provided, simulating AI detection');
    simulateAIDetection(headlineTexts, headlineMap, batchIndex);
    return;
  }
  
  // Call AI API to analyze headlines
  callAIService(headlineTexts, batchIndex).then(results => {
    Logger.debug(`Batch ${batchIndex} AI results:`, results);
    
    // Process results
    let batchClickbaitCount = 0;
    
    results.forEach((result, i) => {
      const headlineText = headlineTexts[i];
      const headline = headlineMap.get(headlineText);
      
      if (result.isClickbait) {
        batchClickbaitCount++;
        Logger.clickbait(`AI detected clickbait: "${headlineText}"`, {
          confidence: result.confidence,
          reason: result.reason
        });
        
        processedHeadlines.add(headline);
        markAsClickbait(headline);
        
        // In debug mode, we only show visual indicators, not summaries
        if (!debugMode) {
          const articleLink = findArticleLink(headline);
          if (articleLink) {
            // If the AI returned a summary, use it directly
            if (result.summary) {
              addSummaryToHeadline(headline, result.summary);
            } else {
              // Otherwise fetch from the article
              fetchArticleSummary(articleLink, summary => {
                if (summary) {
                  addSummaryToHeadline(headline, summary);
                }
              });
            }
          }
        }
      } else {
        Logger.debug(`AI: Not clickbait: "${headlineText}"`);
      }
    });
    
    Logger.info(`Batch ${batchIndex}: Found ${batchClickbaitCount} clickbait headlines out of ${headlines.length}`);
    Logger.timeEnd(`processBatch-${batchIndex}`);
  }).catch(error => {
    Logger.error(`Error analyzing batch ${batchIndex}:`, error);
    Logger.timeEnd(`processBatch-${batchIndex}`);
  });
}

// Simulate AI detection for testing without an API key
function simulateAIDetection(headlineTexts, headlineMap, batchIndex) {
  Logger.info(`Simulating AI detection for batch ${batchIndex}`);
  
  // Simple simulation: use the pattern matching but add some randomness
  const results = headlineTexts.map(text => {
    const isClickbaitByPattern = isClickbait(text);
    const randomFactor = Math.random() > 0.7; // 30% chance to flip the result for variety
    
    const isClickbait = randomFactor ? !isClickbaitByPattern : isClickbaitByPattern;
    
    return {
      isClickbait,
      confidence: Math.random() * 0.5 + 0.5, // Random confidence between 0.5 and 1.0
      reason: isClickbait ? 
        "This headline appears to withhold key information to encourage clicks." :
        "This headline provides adequate information about the content.",
      summary: isClickbait ? `The key information in this article is: ${generateFakeSummary(text)}` : null
    };
  });
  
  // Process the simulated results
  let batchClickbaitCount = 0;
  
  results.forEach((result, i) => {
    const headlineText = headlineTexts[i];
    const headline = headlineMap.get(headlineText);
    
    if (result.isClickbait) {
      batchClickbaitCount++;
      Logger.clickbait(`Simulated AI detected clickbait: "${headlineText}"`, {
        confidence: result.confidence,
        reason: result.reason
      });
      
      processedHeadlines.add(headline);
      markAsClickbait(headline);
      
      // In debug mode, we only add visual indicators, not summaries
      if (!debugMode && result.summary) {
        addSummaryToHeadline(headline, result.summary);
      }
    } else {
      Logger.debug(`Simulated AI: Not clickbait: "${headlineText}"`);
    }
  });
  
  Logger.info(`Batch ${batchIndex}: Found ${batchClickbaitCount} clickbait headlines out of ${headlineTexts.length}`);
  Logger.timeEnd(`processBatch-${batchIndex}`);
}

// Generate a fake summary for testing
function generateFakeSummary(headline) {
  const templates = [
    "The article explains that the situation was caused by economic factors and policy decisions.",
    "According to experts, the primary reason is changing consumer behavior and market competition.",
    "Research shows that this trend has been developing for several years due to technological advancements.",
    "Multiple sources confirm that the key factor was unexpected regulatory changes.",
    "The main point is that several interconnected factors contributed to this outcome."
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

// Call the AI service to analyze headlines
async function callAIService(headlines, batchIndex) {
  Logger.debug(`Preparing to call AI service for batch ${batchIndex}`);
  
  if (!aiApiKey) {
    throw new Error('No AI API key provided');
  }
  
  const prompt = `Analyze the following headlines from Google News and determine which ones are clickbait. For each headline, provide a JSON object with properties: isClickbait (boolean), confidence (number 0-1), reason (string), and summary (string or null if not clickbait).

Consider a headline as clickbait if it:
- Ends with a question
- Uses phrases like "here's why", "this is how", or "the reason is"
- Promises information without delivering it
- Uses vague pronouns without clear references
- Teases information that should be in the headline itself

Headlines to analyze:
${headlines.map((h, i) => `${i+1}. "${h}"`).join('\n')}

Provide results as a JSON array with one object per headline, in the same order as the input headlines.`;
  
  try {
    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that analyzes news headlines to identify clickbait.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    Logger.debug(`AI service response for batch ${batchIndex}:`, data);
    
    try {
      // Extract the content from the response
      const content = data.choices[0].message.content;
      
      // Parse the JSON from the content
      // We need to handle both when it returns just the JSON array and when it wraps it in markdown code blocks
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }
      
      const results = JSON.parse(jsonStr);
      return results;
    } catch (parseError) {
      Logger.error('Error parsing AI response:', parseError);
      Logger.debug('Raw response content:', data.choices[0].message.content);
      throw new Error('Failed to parse AI response');
    }
  } catch (error) {
    Logger.error(`Error calling AI service for batch ${batchIndex}:`, error);
    // Fall back to pattern matching
    return headlines.map(text => ({
      isClickbait: isClickbait(text),
      confidence: 0.7,
      reason: 'Determined by pattern matching due to AI service error',
      summary: null
    }));
  }
}

// Find headline elements on Google News
function findHeadlineElements() {
  Logger.time('findHeadlineElements');
  
  // More specific selectors for Google News headlines
  // These selectors target only the main article headlines, not navigation or other elements
  const selectors = [
    // Main article headlines
    'article h3', 
    'article h4',
    // Headlines in specific Google News containers
    '.DY5T1d', // Article title class
    '.JtKRv', // Main headline class
    '.ipQwMb' // Another headline class used by Google News
  ];
  
  Logger.debug('Using selectors to find headlines:', selectors);
  
  // Join all selectors for the query
  const selectorString = selectors.join(', ');
  const headlines = document.querySelectorAll(selectorString);
  
  // Filter out any elements that are too short to be headlines
  // or might be navigation elements, timestamps, etc.
  const filteredHeadlines = Array.from(headlines).filter(headline => {
    const text = headline.textContent.trim();
    // Must be at least 15 characters to be a reasonable headline
    return text.length > 15 && text.length < 500;
  });
  
  // Log all headlines found to see what we're analyzing
  const allHeadlines = filteredHeadlines.map(headline => {
    return {
      text: headline.textContent.trim(),
      element: headline
    };
  });
  
  // Create a clear table view of all headlines
  Logger.info(`Found ${filteredHeadlines.length} potential headlines (filtered from ${headlines.length} elements)`);
  Logger.table(allHeadlines.map((h, i) => ({
    index: i,
    headline: h.text.substring(0, 80) + (h.text.length > 80 ? '...' : ''),
    length: h.text.length
  })));
  
  Logger.timeEnd('findHeadlineElements');
  return filteredHeadlines;
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
  
  // Apply additional styling when in debug mode
  if (debugMode) {
    // Highlight the text in a different color
    headlineElement.style.color = '#e91e63'; // Pink color for clickbait text
    headlineElement.style.fontWeight = 'bold';
    
    // Add a more prominent debug indicator
    const debugIndicator = document.createElement('span');
    debugIndicator.classList.add('debug-clickbait-indicator');
    debugIndicator.innerHTML = '⚠️ CLICKBAIT'; 
    debugIndicator.title = 'Debug mode: Clickbait detected';
    
    // Insert the debug indicator after the headline
    headlineElement.appendChild(debugIndicator);
  }
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
    
    .debug-clickbait-indicator {
      display: inline-block;
      margin-left: 12px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: bold;
      color: white;
      background-color: #e91e63;
      border-radius: 4px;
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
    Logger.info(`Extension ${isActive ? 'activated' : 'deactivated'}`);
    
    if (isActive) {
      processGoogleNewsPage();
      setupObserver();
    }
    // Note: We don't remove existing summaries when disabled
  }
  
  else if (request.action === 'updateDisplayStyle') {
    displayStyle = request.value;
    Logger.info(`Display style updated to: ${displayStyle}`);
    
    // Clear processed headlines to reprocess with new style
    processedHeadlines.clear();
    
    // Remove existing summaries
    document.querySelectorAll('.clickbait-summary').forEach(el => el.remove());
    
    // Reprocess with new style
    if (isActive) {
      processGoogleNewsPage();
    }
  }
  
  else if (request.action === 'updateDebugMode') {
    debugMode = request.value;
    Logger.setDebugMode(debugMode);
    Logger.info(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
    
    if (debugMode && isActive) {
      // Reprocess to add the debug headline
      processGoogleNewsPage();
    }
  }
  
  else if (request.action === 'updateUseAI') {
    useAI = request.value;
    Logger.info(`AI detection ${useAI ? 'enabled' : 'disabled'}`);
    
    if (isActive) {
      // Reprocess with new detection method
      processedHeadlines.clear();
      document.querySelectorAll('.clickbait-summary').forEach(el => el.remove());
      processGoogleNewsPage();
    }
  }
  
  else if (request.action === 'updateAIKey') {
    aiApiKey = request.value;
    Logger.info(`AI API key ${aiApiKey ? 'updated' : 'removed'}`);
  }
  
  else if (request.action === 'updateBatchSize') {
    batchSize = parseInt(request.value, 10);
    Logger.info(`Batch size updated to: ${batchSize}`);
  }
  
  else if (request.action === 'updateMaxHeadlines') {
    maxHeadlines = parseInt(request.value, 10);
    Logger.info(`Max headlines limit updated to: ${maxHeadlines === 0 ? 'No limit' : maxHeadlines}`);
  }
  
  else if (request.action === 'reportIssue') {
    Logger.info('Opening issue report form');
    
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
      Logger.info('Issue reported:', description);
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
