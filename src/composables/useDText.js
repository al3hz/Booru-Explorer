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

    // [[Wiki Page]]
    formatted = formatted.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (match, link, label) => {
        let displayText = label;
        if (label === '') displayText = link.replace(/_\(.*\)$/, '');
        else if (!label) displayText = link;
        return addPlaceholder(`<span class="wiki-link" data-link="${link}" style="color: #a78bfa; cursor: pointer; text-decoration: underline;">${displayText}</span>`);
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
    // Matches: &quot;Label&quot;:http://... OR &quot;Label&quot;:/...
    formatted = formatted.replace(/&quot;(.*?)&quot;:((?:https?:\/\/|\/)[^\s<]+)/g, (match, label, path) => {
        let finalUrl = path;
        if (path.startsWith('/')) finalUrl = path.startsWith('/posts') ? '/Booru-Explorer/' : `https://danbooru.donmai.us${path}`;
        return addPlaceholder(`<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="dtext-link">${label}</a>`);
    });

    // Forum Topics: topic #123
    formatted = formatted.replace(/topic #(\d+)/gi, (m, id) => {
        return addPlaceholder(`<a href="https://danbooru.donmai.us/forum_topics/${id}" target="_blank" rel="noopener noreferrer" class="dtext-link">topic #${id}</a>`);
    });

    // Internal Anchors: "Label":#id
    formatted = formatted.replace(/&quot;(.*?)&quot;:#([\w\-]+)/g, (m, label, id) => {
        return addPlaceholder(`<a href="#${id}" class="dtext-link dtext-anchor" data-anchor="${id}">${label}</a>`);
    });

    // 4. Raw URLs (Now safe to be greedy because other links are hidden)
    formatted = formatted.replace(/(https?:\/\/[^\s<"']+)/g, (match) => {
        return addPlaceholder(`<a href="${match}" target="_blank" rel="noopener noreferrer" class="dtext-link">${match}</a>`);
    });

    // 5. Hydration Stubs (convert to placeholders to protect them)
    formatted = formatted.replace(/!post #(\d+)/g, (m, id) => addPlaceholder(`<span class="dtext-post-stub" data-post-id="${id}">Loading post #${id}...</span>`));
    formatted = formatted.replace(/!asset #(\d+)/g, (m, id) => addPlaceholder(`<span class="dtext-asset-stub" data-asset-id="${id}">Loading asset #${id}...</span>`));
    
    // {{status:tag}}
    formatted = formatted.replace(/\{\{status:(.*?)\}\}/g, (match, tag) => {
        const fullTag = `status:${tag}`;
        return addPlaceholder(`<span class="status-link" data-tag="${fullTag}" style="color: #f87171; cursor: pointer; text-decoration: underline;">${fullTag}</span>`);
    });

    // 6. Formatting that could contain placeholders (like bolding a link)
    // We let these run *around* placeholders. Placeholders are just weird text now.
    
    // [b]...[/b]
    formatted = formatted.replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>');
    // [i]...[/i]
    formatted = formatted.replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>');
    // [u]...[/u]
    formatted = formatted.replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>');
    // [s]...[/s]
    formatted = formatted.replace(/\[s\](.*?)\[\/s\]/g, '<s>$1</s>');

    // Headers
    formatted = formatted.replace(/(?:^|\n)h([1-6])(?:#([\w\-]+))?\.\s*(.*?)(?=\r|\n|$)/g, (match, level, id, content) => {
        const idAttr = id ? ` id="dtext-${id}"` : '';
        return `<h${level}${idAttr}>${content}</h${level}>`;
    });

    // Lists
    formatted = formatted.replace(/(?:^|\n)\*\* (.*?)(?=\r|\n|$)/g, '<div class="dtext-list-item nested"><span>$1</span></div>');
    formatted = formatted.replace(/(?:^|\n)\* (.*?)(?=\r|\n|$)/g, (match, content) => {
        // We can't easily check for stubs inside content now because they are placeholders.
        // But the CSS logic for dtext-preview-item works on structure.
        // We'll just render generic item and let styles/JS handle specific layout if needed.
        // Or we can peek: if content includes __PH_... and that placeholder is a stub.
        // For simplicity, just render standard list item.
        return `<div class="dtext-list-item"><span>${content}</span></div>`;
    });

    // Expand
    // Note: [expand] might contain placeholders. 
    formatted = formatted.replace(/\[expand(?:=(.*?))?\]([\s\S]*?)\[\/expand\]/g, (match, title, content) => {
        const id = 'acc-' + Math.random().toString(36).substr(2, 9);
        const displayTitle = title || 'Expand';
        const finalContent = (!content || !content.trim()) ? '<span class="dtext-empty">No results found.</span>' : content;
        
        return `<div class="dtext-accordion">
            <input type="checkbox" id="${id}" class="accordion-checkbox">
            <label for="${id}" class="accordion-header">${displayTitle}</label>
            <div class="accordion-content"><div>${finalContent}</div></div>
        </div>`;
    });

    // Line breaks
    formatted = formatted.replace(/(\r\n\r\n|\n\n|\r\r)/g, '<br><br>');
    formatted = formatted.replace(/\n(?!\*|\bh[1-6]\.)/g, ' '); // Single newline -> space
    formatted = formatted.replace(/[ ]{2,}/g, ' ');
    formatted = formatted.replace(/\n/g, '<br>'); // Remaining newlines for headers/lists

    // Cleanup whitespace around headers/divs
    formatted = formatted.replace(/(<\/h[1-6]>)<br>/g, '$1');
    formatted = formatted.replace(/<br>(<h[1-6]>)/g, '$1');
    formatted = formatted.replace(/(<\/div>)<br>(<div)/g, '$1$2');

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
