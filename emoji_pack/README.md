# 🎫 Ticketary Custom Emoji Pack

This directory contains the custom-generated `.png` icons that you can upload to your Discord server as custom emojis.

## How to use:
1. **Upload Emojis**: Go to your Discord Server Settings -> **Emoji** -> **Upload Emoji**.
2. Upload the PNG files from this folder.
3. **Get Custom Emoji IDs**:
   - In any Discord text channel, type `\:emoji_name:` (e.g. `\:ticket:`) and press Enter.
   - Discord will output the raw emoji tag format, which looks like this: `<:ticket:1262304052361035857>` (or `<a:loading:1262304052361035857>` if animated).
4. **Configure `emojis.json`**:
   - Copy that raw tag.
   - Open the root file [emojis.json](file:///c:/Users/PC/Downloads/archive-2025-12-06T091253+0100/emojis.json).
   - Replace the unicode character (like `"🎫"`) with your custom tag (like `"<:ticket:1262304052361035857>"`).
5. Restart your bot, and it will now render your beautiful custom server emojis!

## Custom Emojis Template:
```json
{
  "ticket": "<:ticket:YOUR_EMOJI_ID>",
  "key": "<:key:YOUR_EMOJI_ID>",
  "claim": "<:claim:YOUR_EMOJI_ID>",
  "close": "<:close:YOUR_EMOJI_ID>",
  "success": "<:success:YOUR_EMOJI_ID>",
  "error": "<:error:YOUR_EMOJI_ID>",
  "loading": "<:loading:YOUR_EMOJI_ID>",
  "premium": "<:premium:YOUR_EMOJI_ID>",
  "star": "<:star:YOUR_EMOJI_ID>",
  "ping": "<:ping:YOUR_EMOJI_ID>",
  "help": "<:help:YOUR_EMOJI_ID>",
  "setup": "<:setup:YOUR_EMOJI_ID>"
}
```
