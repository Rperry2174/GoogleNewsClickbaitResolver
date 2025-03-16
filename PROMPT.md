# Original Project Prompt

Create a Chrome extension called "GoogleNewsClickbaitResolver" that identifies headlines on Google News that hide their key information behind clicks. The extension should:

1. Target Google News pages (news.google.com) specifically

2. Identify headlines that withhold crucial information, such as:
   - Headlines ending with questions
   - Headlines using phrases like "here's why," "this is how," or "the reason is"
   - Headlines promising information without delivering it ("X reveals shocking truth")
   - Headlines using vague pronouns ("this," "it," "they") without clear references
   - Headlines teasing information that should be in the headline itself

3. For each identified headline:
   - Fetch and analyze the actual article content without requiring user clicks
   - Extract the key information that answers the headline's implicit question
   - Display this information directly alongside or below the original headline
   - Clearly mark which headlines have been augmented

4. Include features for users to:
   - Toggle the extension on/off
   - Adjust how the resolved information is displayed
   - Report false positives or missed clickbait

5. Optimize for performance by:
   - Implementing efficient scraping and text analysis
   - Using caching to avoid re-processing previously analyzed articles
   - Processing articles asynchronously to maintain browsing speed

6. Respect user privacy by processing content locally without sending data to external servers

The extension should provide a non-intrusive, seamless experience that saves users time by eliminating unnecessary clicks to get basic information.