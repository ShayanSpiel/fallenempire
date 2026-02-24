/**
 * Mention and trigger detection utilities
 */

export interface TriggerMatch {
  trigger: '/' | '@' | null;
  query: string;
  startIndex: number;
  endIndex: number;
}

export interface MentionMatch {
  username: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detect trigger (/ or @) at cursor position
 * Returns the trigger type, query string, and indices
 */
export function detectTrigger(text: string, cursorPos: number): TriggerMatch {
  // Look backwards from cursor position for / or @
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i];

    // Stop at whitespace
    if (char === ' ' || char === '\n') {
      break;
    }

    // Check if this is a trigger character
    if (char === '@' || char === '/') {
      const query = text.substring(i + 1, cursorPos);

      // For @ mentions, require no spaces in query
      if (char === '@' && !query.includes(' ')) {
        return {
          trigger: '@',
          query,
          startIndex: i,
          endIndex: cursorPos,
        };
      }

      // For / commands, check if at line start or after space
      if (char === '/') {
        const isAtLineStart = i === 0 || text[i - 1] === '\n';
        if (isAtLineStart) {
          return {
            trigger: '/',
            query,
            startIndex: i,
            endIndex: cursorPos,
          };
        }
      }
      // If we found a trigger char but conditions aren't met, stop searching
      break;
    }
  }

  return {
    trigger: null,
    query: '',
    startIndex: cursorPos,
    endIndex: cursorPos,
  };
}

/**
 * Extract all @mentions from text
 */
export function extractMentions(text: string): MentionMatch[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: MentionMatch[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Get cursor position coordinates in textarea
 * Uses textarea-caret-position library approach
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
): { top: number; left: number; height: number } {
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  // Clone relevant styles
  const props = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
  ];

  props.forEach((prop) => {
    div.style[prop as any] = style[prop as any];
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  document.body.appendChild(div);

  const textBeforeCaret = textarea.value.substring(0, textarea.selectionStart);
  div.textContent = textBeforeCaret;

  const span = document.createElement('span');
  span.textContent = textarea.value.substring(textarea.selectionStart) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop - textarea.scrollTop + parseInt(style.borderTopWidth) + parseInt(style.paddingTop),
    left: span.offsetLeft - textarea.scrollLeft + parseInt(style.borderLeftWidth) + parseInt(style.paddingLeft),
    height: parseInt(style.lineHeight),
  };

  document.body.removeChild(div);

  return coordinates;
}

/**
 * Replace text at position with new text
 */
export function replaceAtPosition(
  text: string,
  startIndex: number,
  endIndex: number,
  replacement: string,
): string {
  return text.substring(0, startIndex) + replacement + text.substring(endIndex);
}

/**
 * Insert text at cursor position
 */
export function insertAtCursor(
  text: string,
  cursorPos: number,
  insertion: string,
): { text: string; cursorPos: number } {
  const newText = text.substring(0, cursorPos) + insertion + text.substring(cursorPos);
  return {
    text: newText,
    cursorPos: cursorPos + insertion.length,
  };
}

/**
 * Highlight mentions in text (for rendering)
 * Returns object with regular text and mention nodes
 */
export function highlightMentions(text: string): (string | { type: 'mention'; username: string })[] {
  const mentions = extractMentions(text);

  if (mentions.length === 0) {
    return [text];
  }

  const parts: (string | { type: 'mention'; username: string })[] = [];
  let lastIndex = 0;

  mentions.forEach((mention) => {
    if (mention.startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, mention.startIndex));
    }
    parts.push({
      type: 'mention' as const,
      username: mention.username,
    });
    lastIndex = mention.endIndex;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Filter items by query (simple text matching)
 */
export function filterByQuery<T extends { label: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    item.label.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Fuzzy match for better search
 */
export function fuzzyMatch(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText.startsWith(lowerQuery)) return 100; // Exact start match
  if (lowerText.includes(lowerQuery)) return 50; // Contains match

  let matches = 0;
  let queryIndex = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      matches++;
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length ? matches : 0;
}

/**
 * Filter and sort by relevance
 */
export function filterAndSortByQuery<T extends { label: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query) return items;

  const scored = items
    .map((item) => ({
      item,
      score: fuzzyMatch(query, item.label),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}
