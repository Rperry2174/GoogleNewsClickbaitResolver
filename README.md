# GoogleNewsClickbaitResolver

A Chrome extension that identifies clickbait headlines on Google News and provides the key information without requiring clicks.

## Features

- **Clickbait Detection**: Automatically identifies headlines that withhold crucial information
- **Content Extraction**: Fetches and analyzes the actual article content
- **Information Display**: Shows the key information directly alongside the headline
- **User Controls**: Toggle the extension on/off and customize how information is displayed
- **Privacy Focused**: Processes all content locally without sending data to external servers

## Installation

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension will automatically work when you visit Google News

## How It Works

The extension identifies clickbait headlines using pattern matching for common clickbait tactics:

- Headlines ending with questions
- Headlines using phrases like "here's why," "this is how," or "the reason is"
- Headlines promising information without delivering it
- Headlines using vague pronouns without clear references
- Headlines teasing information that should be in the headline itself

When a clickbait headline is detected, the extension:

1. Fetches the actual article content
2. Extracts the key information that answers the headline's implicit question
3. Displays this information alongside the original headline
4. Marks the headline with a small indicator icon

## User Options

Click the extension icon to access the popup menu with these options:

- **Enable/Disable**: Toggle the extension on or off
- **Display Style**: Choose how the resolved information appears
  - Inline (after headline)
  - Below headline
  - Tooltip on hover
- **Report Issue**: Report problematic headlines or false positives

## Development

### Project Structure

- `manifest.json`: Extension configuration
- `popup.html` & `popup.js`: User interface for settings
- `content.js`: Main content script that processes Google News pages
- `background.js`: Background service worker for handling article fetching
- `logger.js`: Utility for extensive console logging (easily toggled)
- `PROMPT.md`: Original project requirements

### Local Development

1. Make changes to the code
2. Reload the extension in Chrome's extension manager
3. Test the changes on Google News

## License

MIT License