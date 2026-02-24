/**
 * Get the coordinates of the caret in a textarea relative to the textarea element
 * Based on the textarea-caret-position library
 */

// Properties to copy from textarea to mirror div
const properties = [
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
  'borderStyle',
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
  'MozTabSize',
] as const;

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

/**
 * Get the caret coordinates (relative to the textarea element)
 * @param element - The textarea element
 * @param position - The caret position (selectionStart)
 * @returns Coordinates object with top, left, and height
 */
export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    throw new Error('getCaretCoordinates should only be used in browser');
  }

  // Create a mirror div with the same styling as the textarea
  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  // Default to 'ltr' if not found
  const isInput = element.nodeName === 'INPUT';
  style.whiteSpace = isInput ? 'nowrap' : 'pre-wrap';
  style.wordWrap = 'break-word';

  // Position off-screen
  style.position = 'absolute';
  style.visibility = 'hidden';

  // Copy CSS properties
  properties.forEach((prop) => {
    if (isInput && prop === 'lineHeight') {
      // Special case for input elements
      if (computed.boxSizing === 'border-box') {
        const height = parseInt(computed.height);
        const outerHeight =
          parseInt(computed.paddingTop) +
          parseInt(computed.paddingBottom) +
          parseInt(computed.borderTopWidth) +
          parseInt(computed.borderBottomWidth);
        const targetHeight = outerHeight + parseInt(computed.lineHeight);
        if (height > targetHeight) {
          style.lineHeight = `${height - outerHeight}px`;
        } else if (height === targetHeight) {
          style.lineHeight = computed.lineHeight;
        } else {
          style.lineHeight = '0';
        }
      } else {
        style.lineHeight = computed.height;
      }
    } else {
      // @ts-ignore
      style[prop] = computed[prop];
    }
  });

  // Firefox needs special handling
  if (navigator.userAgent.includes('Firefox')) {
    // Firefox lies about the overflow property for textareas
    if (element.scrollHeight > parseInt(computed.height)) {
      style.overflowY = 'scroll';
    }
  } else {
    style.overflow = 'hidden';
  }

  div.textContent = element.value.substring(0, position);

  if (isInput) {
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');
  }

  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    height: parseInt(computed.lineHeight),
  };

  document.body.removeChild(div);

  return coordinates;
}
