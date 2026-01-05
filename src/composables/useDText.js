export function useDText() {
  const parseDText = (text) => {
    if (!text) return '';

    let formatted = text;
    const placeholders = [];
    
    // Helper to store safely
    const addPlaceholder = (content) => {
        const id = `__PH_${placeholders.length}__`;
        placeholders.push(content);
        return id;
    };

    // 1. Escape HTML
    formatted = formatted
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // 2. Protect Code and Blocks
    formatted = formatted.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, (m, c) => addPlaceholder(`<blockquote class="dtext-quote">${c}</blockquote>`));
    formatted = formatted.replace(/\[code\]([\s\S]*?)\[\/code\]/g, (m, c) => addPlaceholder(`<pre class="dtext-code">${c}</pre>`));
    formatted = formatted.replace(/\[tn\]([\s\S]*?)\[\/tn\]/g, (m, c) => addPlaceholder(`<div class="dtext-tn">${c}</div>`));

    // 3. Explicit Links (Wiki, URL, Legacy) - Convert to HTML and Store as Placeholder

    // [[Wiki Page]] with optional suffix (e.g. [[cat]]s)
    formatted = formatted.replace(/\[\[(.*?)(?:\|(.*?))?\]\]([a-z]*)/gi, (match, link, label, suffix) => {
        const s = suffix || '';
        let displayText = label;
        if (label === '') displayText = link.replace(/_\(.*\)$/, '');
        else if (!label) displayText = link;
        
        return addPlaceholder(`<span class="wiki-link" data-link="${link}" style="color: #a78bfa; cursor: pointer; text-decoration: underline;">${displayText}${s}</span>`);
    });

    // [url=http://...]Label[/url]
    formatted = formatted.replace(/\[url=(.*?)\](.*?)\[\/url\]/g, (match, url, label) => {
        let finalUrl = url;
        if (url.startsWith('/')) finalUrl = url.startsWith('/posts') ? '/Booru-Explorer/' : `https://danbooru.donmai.us${url}`;
        return addPlaceholder(`<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="dtext-link">${label}</a>`);
    });
    
    // [url]http://...[/url]
    formatted = formatted.replace(/\[url\](.*?)\[\/url\]/g, (match, url) => {
        return addPlaceholder(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="dtext-link">${url}</a>`);
    });

    // "Label":URL (Legacy) using &quot; for quotes
    // Matches: &quot;Label&quot;:http://... OR &quot;Label&quot;:[http://...]
    // Added support for optional brackets [] around the URL
    formatted = formatted.replace(/&quot;(.*?)&quot;:\[?((?:https?:\/\/|\/)[^\s<\]]+)\]?/g, (match, label, path) => {
        let finalUrl = path;
        if (path.startsWith('/')) finalUrl = path.startsWith('/posts') ? '/Booru-Explorer/' : `https://danbooru.donmai.us${path}`;
        return addPlaceholder(`<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="dtext-link">${label}</a>`);
    });

    // Forum Topics: topic #123
    formatted = formatted.replace(/topic #(\d+)/gi, (m, id) => {
        return addPlaceholder(`<a href="https://danbooru.donmai.us/forum_topics/${id}" target="_blank" rel="noopener noreferrer" class="dtext-link">topic #${id}</a>`);
    });

    // Posts: Post #123 or post #123 -> Make clickable
    formatted = formatted.replace(/(?:post|post_id)\s*#(\d+)/gi, (m, id) => {
        return addPlaceholder(`<span class="post-link" data-post-id="${id}" style="color: #a78bfa; cursor: pointer; text-decoration: underline;">post #${id}</span>`);
    });

    // Internal Anchors: "Label":#id
    formatted = formatted.replace(/&quot;(.*?)&quot;:#([\w-]+)/g, (m, label, id) => {
        return addPlaceholder(`<a href="#${id}" class="dtext-link dtext-anchor" data-anchor="${id}">${label}</a>`);
    });

    // 4. Raw URLs
    formatted = formatted.replace(/(https?:\/\/[^\s<"']+)/g, (match) => {
        return addPlaceholder(`<a href="${match}" target="_blank" rel="noopener noreferrer" class="dtext-link">${match}</a>`);
    });

    // 5. Hydration Stubs
    formatted = formatted.replace(/!post #(\d+)/g, (m, id) => addPlaceholder(`<span class="dtext-post-stub" data-post-id="${id}">Loading post #${id}...</span>`));
    formatted = formatted.replace(/!asset #(\d+)/g, (m, id) => addPlaceholder(`<span class="dtext-asset-stub" data-asset-id="${id}">Loading asset #${id}...</span>`));
    
    // {{status:tag}}
    formatted = formatted.replace(/\{\{status:(.*?)\}\}/g, (match, tag) => {
        const fullTag = `status:${tag}`;
        return addPlaceholder(`<span class="status-link" data-tag="${fullTag}" style="color: #f87171; cursor: pointer; text-decoration: underline;">${fullTag}</span>`);
    });

    // Handle [posts] query [/posts] tags - Just show label or content if present, or strip if complex
    // Example: "800x600"[/posts] -> just "800x600"
    formatted = formatted.replace(/"(.*?)"\[\/?posts(?:=[^\]]*)?\]/g, '$1'); 
    formatted = formatted.replace(/\[\/?posts(?:=[^\]]*)?\]/g, ''); 

    // 6. Formatting
    formatted = formatted.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>');
    formatted = formatted.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
    formatted = formatted.replace(/\[s\]([\s\S]*?)\[\/s\]/g, '<s>$1</s>');

    // Headers - Simplify for card preview to bold text
    formatted = formatted.replace(/(?:^|\n)h([1-6])(?:#([\w-]+))?\.\s*(.*?)(?=\r|\n|$)/g, '<br><strong>$3</strong>');

    // Lists - Simplify to bullet points
    formatted = formatted.replace(/(?:^|\n)\*+ (.*?)(?=\r|\n|$)/g, '<br>• $1');

    // Expand - Collapse to simple text
    formatted = formatted.replace(/\[expand(?:=(.*?))?\]([\s\S]*?)\[\/expand\]/g, '<br><em>$1</em><br>$2');

    // Line breaks - Aggressive cleanup for cards
    formatted = formatted.replace(/(\r\n|\n|\r)/g, ' '); // Flatten for card preview (line-clamp works best on inline text)
    formatted = formatted.replace(/[ ]{2,}/g, ' '); // Collapse spaces

    // 7. Restore Placeholders
    // Loop until no placeholders remain (handle nested if any, though our logic is flat for now)
    // We reverse loop to ensure inner placeholders are resolved if we had nesting (we don't really, but safety)
    
    // Actually, simple replacement is fine.
    placeholders.forEach((html, index) => {
        const id = `__PH_${index}__`;
        // Use split/join to replace all occurrences if any (though usually 1)
        formatted = formatted.split(id).join(html);
    });

    return formatted;
  };

  return {
    parseDText
  };
}
