export function useDText() {
  const parseDText = (text) => {
    if (!text) return '';

    // Escape HTML first to prevent XSS
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // 1. Block-level elements (Quotes, Code)
    // [quote]...[/quote]
    formatted = formatted.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, '<blockquote class="dtext-quote">$1</blockquote>');
    
    // [code]...[/code]
    formatted = formatted.replace(/\[code\]([\s\S]*?)\[\/code\]/g, '<pre class="dtext-code">$1</pre>');

    // 2. Inline Styles
    // [b]bold[/b]
    formatted = formatted.replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>');
    
    // [i]italic[/i]
    formatted = formatted.replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>');
    
    // [u]underline[/u]
    formatted = formatted.replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>');
    
    // [s]strikethrough[/s]
    formatted = formatted.replace(/\[s\](.*?)\[\/s\]/g, '<s>$1</s>');

    // 3. Links
    
    // [[Wiki Page]] or [[Wiki Page|Label]] or [[Wiki Page|]]
    formatted = formatted.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (match, link, label) => {
        let displayText = label;
        // Handle [[page|]] (empty alias) - Danbooru uses this to strip qualifiers
        if (label === '') {
            displayText = link.replace(/_\(.*\)$/, '');
        } else if (!label) {
            displayText = link;
        }
        return `<span class="wiki-link" data-link="${link}" style="color: #a78bfa; cursor: pointer; text-decoration: underline;">${displayText}</span>`;
    });

    // [url=http://...]Label[/url]
    formatted = formatted.replace(/\[url=(.*?)\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="dtext-link">$2</a>');
    
    // "Label":[Url] (Note: quotes are already escaped to &quot;)
    formatted = formatted.replace(/&quot;(.*?)&quot;:\[(.*?)\]/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="dtext-link">$1</a>');

    // "Label":/url (Non-bracketed links)
    formatted = formatted.replace(/&quot;(.*?)&quot;:(\/[^\s<]+)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="dtext-link">$1</a>');

    // "Label":#id (Internal Anchors)
    formatted = formatted.replace(/&quot;(.*?)&quot;:#([\w\-]+)/g, '<a href="#$2" class="dtext-link dtext-anchor" data-anchor="$2">$1</a>');

    // !post #id (Post Stub for hydration)
    formatted = formatted.replace(/!post #(\d+)/g, '<span class="dtext-post-stub" data-post-id="$1">Loading post #$1...</span>');

    // !asset #id (Asset Stub for hydration)
    formatted = formatted.replace(/!asset #(\d+)/g, '<span class="dtext-asset-stub" data-asset-id="$1">Loading asset #$1...</span>');

    // [tn]...[/tn] (Thumbnail container)
    formatted = formatted.replace(/\[tn\]([\s\S]*?)\[\/tn\]/g, '<div class="dtext-tn">$1</div>');

    // [url]http://...[/url]
    formatted = formatted.replace(/\[url\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="dtext-link">$1</a>');

    // topic #id (Forum links)
    formatted = formatted.replace(/topic #(\d+)/gi, '<a href="https://danbooru.donmai.us/forum_topics/$1" target="_blank" rel="noopener noreferrer" class="dtext-link">topic #$1</a>');

    // Raw URLs (simple detection)
    formatted = formatted.replace(/(?<!["=])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="dtext-link">$1</a>');


    // [expand=Title]Content[/expand]
    formatted = formatted.replace(/\[expand=(.*?)\]([\s\S]*?)\[\/expand\]/g, (match, title, content) => {
        const id = 'acc-' + Math.random().toString(36).substr(2, 9);
        const isEmpty = !content || !content.trim();
        const finalContent = isEmpty ? '<span class="dtext-empty">No results found.</span>' : content;
        
        return `<div class="dtext-accordion">
            <input type="checkbox" id="${id}" class="accordion-checkbox">
            <label for="${id}" class="accordion-header">${title}</label>
            <div class="accordion-content"><div>${finalContent}</div></div>
        </div>`;
    });
    
    // [expand]Content[/expand]
    formatted = formatted.replace(/\[expand\]([\s\S]*?)\[\/expand\]/g, (match, content) => {
        const id = 'acc-' + Math.random().toString(36).substr(2, 9);
        const isEmpty = !content || !content.trim();
        const finalContent = isEmpty ? '<span class="dtext-empty">No results found.</span>' : content;

        return `<div class="dtext-accordion">
            <input type="checkbox" id="${id}" class="accordion-checkbox">
            <label for="${id}" class="accordion-header">Expand</label>
            <div class="accordion-content"><div>${finalContent}</div></div>
        </div>`;
    });

    // 4. Headers (h1. to h6.) - Supports h1. and h1#id.
    // h4. Title
    formatted = formatted.replace(/(?:^|\n)h([1-6])(?:#([\w\-]+))?\.\s*(.*?)(?=\r|\n|$)/g, (match, level, id, content) => {
        const idAttr = id ? ` id="dtext-${id}"` : '';
        return `<h${level}${idAttr}>${content}</h${level}>`;
    });

    // 5. Lists (simple numeric and bullet)
    // ** Nested Item
    formatted = formatted.replace(/(?:^|\n)\*\* (.*?)(?=\r|\n|$)/g, '<div class="dtext-list-item nested"><span>$1</span></div>');

    // * Item
    formatted = formatted.replace(/(?:^|\n)\* (.*?)(?=\r|\n|$)/g, (match, content) => {
        // Check if the item contains a post or asset preview stub
        const isPreview = content.includes('dtext-post-stub') || content.includes('dtext-asset-stub');
        if (isPreview) {
            // Robustly separate the stub from the label (stripping the colon)
            const firstColon = content.indexOf(':');
            if (firstColon !== -1) {
                const stub = content.substring(0, firstColon).trim();
                const label = content.substring(firstColon + 1).trim();
                if (label) {
                    return `<div class="dtext-list-item dtext-preview-item"><span>${stub}<span class="preview-label">${label}</span></span></div>`;
                }
            }
            return `<div class="dtext-list-item dtext-preview-item"><span>${content}</span></div>`;
        }
        return `<div class="dtext-list-item"><span>${content}</span></div>`;
    });

    // 6. Line breaks - Paragraph-like logic
    // - Danbooru DText: Double newline = new paragraph/break
    // - Single newline = space (usually)
    
    // First, protect <br> that might have been added by stubs/etc (though currently we use divs/spans)
    
    // Replace double newlines with a special placeholder to avoid being caught by single newline rule
    formatted = formatted.replace(/(\r\n\r\n|\n\n|\r\r)/g, '<br><br>');
    
    // Replace single newlines with spaces (if they are not already inside a tag or followed/preceded by block elements)
    // For now, let's just make it simpler: single newline -> space, but don't break headers/lists
    // Headers and lists already match ^|\n, so we can replace \n with spaces if not followed by * or h[1-6]
    formatted = formatted.replace(/\n(?!\*|\bh[1-6]\.)/g, ' ');

    // Cleanup extra spaces
    formatted = formatted.replace(/[ ]{2,}/g, ' ');
    
    // Finally convert remaining newlines (at start of headers/lists) to <br> to ensure they stack
    formatted = formatted.replace(/\n/g, '<br>');

    // Cleanup whitespace around block elements
    formatted = formatted.replace(/(<\/h[1-6]>)<br>/g, '$1');
    formatted = formatted.replace(/<br>(<h[1-6]>)/g, '$1');
    formatted = formatted.replace(/(<\/div>)<br>(<div)/g, '$1$2');

    return formatted;
  };

  return {
    parseDText
  };
}
