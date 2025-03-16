// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(function() {
  console.log('[GoogleNewsClickbaitResolver] Extension installed/updated');
  
  chrome.storage.sync.set({
    active: true,
    displayStyle: 'inline',
    cache: {},
    debugMode: true,
    useAI: true,
    batchSize: 10,  // Process headlines in batches of 10
    maxHeadlines: 20, // Maximum number of headlines to process
    aiEndpoint: 'https://api.openai.com/v1/chat/completions'
  });
  
  console.log('[GoogleNewsClickbaitResolver] Default settings initialized');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'fetchArticle') {
    // Check cache first
    chrome.storage.sync.get(['cache'], function(result) {
      const cache = result.cache || {};
      
      if (cache[request.url] && (Date.now() - cache[request.url].timestamp < 3600000)) { // 1 hour cache
        sendResponse(cache[request.url]);
      } else {
        // Fetch article content
        fetch(request.url)
          .then(response => response.text())
          .then(html => {
            // Simple implementation - in practice, we would use more robust parsing
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract article content (this is a simplified approach)
            const articleContent = extractArticleContent(doc);
            const articleSummary = summarizeArticle(articleContent);
            
            // Update cache
            cache[request.url] = {
              summary: articleSummary,
              timestamp: Date.now()
            };
            
            chrome.storage.sync.set({cache: cache});
            sendResponse({summary: articleSummary});
          })
          .catch(error => {
            console.error('Error fetching article:', error);
            sendResponse({error: 'Failed to fetch article'});
          });
      }
    });
    
    // Need to return true to indicate async response
    return true;
  }
});

// Extract main content from article
function extractArticleContent(doc) {
  // This is a simplified implementation
  // In a real extension, we would use a more robust content extraction algorithm
  
  // Try to find main article content by common selectors
  const contentSelectors = [
    'article', '.article-body', '.article-content',
    '[itemprop="articleBody"]', '.story-body'
  ];
  
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      return element.textContent;
    }
  }
  
  // Fallback: get all paragraphs
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  return paragraphs.map(p => p.textContent).join(' ');
}

// Analyze and summarize article content
function summarizeArticle(content) {
  // This is a simplified implementation
  // In a real extension, we would use NLP techniques to properly summarize
  
  // Simple approach: extract first couple of sentences
  const sentences = content.split(/[.!?]\s+/);
  
  // Take first 2-3 substantive sentences (more than a few words)
  const substantiveSentences = sentences.filter(s => s.split(' ').length > 5);
  return substantiveSentences.slice(0, 2).join('. ') + '.';
}
