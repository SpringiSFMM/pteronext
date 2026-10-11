/**
 * High-performance ANSI escape sequence parser and renderer for cyber terminal logs.
 * Supports standard 16 colors, 256-color palette (xterm), and 24-bit TrueColor (RGB).
 */

export interface AnsiSpan {
  text: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
}

const ANSI_STANDARD_COLORS: Record<number, string> = {
  30: '#334155', // black (slate-700 for visibility on dark bg)
  31: '#f43f5e', // red (rose-500)
  32: '#10b981', // green (emerald-500)
  33: '#f59e0b', // yellow (amber-500)
  34: '#3b82f6', // blue (blue-500)
  35: '#d946ef', // magenta (fuchsia-500)
  36: '#06b6d4', // cyan (cyan-500)
  37: '#e2e8f0', // white (slate-200)

  // Bright / High-intensity
  90: '#64748b', // bright black (slate-500)
  91: '#fb7185', // bright red
  92: '#34d399', // bright green
  93: '#fbbf24', // bright yellow
  94: '#60a5fa', // bright blue
  95: '#e879f9', // bright magenta
  96: '#22d3ee', // bright cyan
  97: '#ffffff', // bright white
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#0f172a', // bg black
  41: '#881337', // bg red
  42: '#064e3b', // bg green
  43: '#78350f', // bg yellow
  44: '#1e3a8a', // bg blue
  45: '#701a75', // bg magenta
  46: '#164e63', // bg cyan
  47: '#334155', // bg white

  // Bright BG
  100: '#1e293b',
  101: '#9f1239',
  102: '#047857',
  103: '#92400e',
  104: '#1d4ed8',
  105: '#86198f',
  106: '#0e7490',
  107: '#475569',
};

// Convert 256-color index to Hex color
function get256Color(code: number): string {
  if (code < 8) {
    return ANSI_STANDARD_COLORS[30 + code] || '#e2e8f0';
  }
  if (code < 16) {
    return ANSI_STANDARD_COLORS[90 + (code - 8)] || '#ffffff';
  }
  if (code >= 16 && code <= 231) {
    // 6x6x6 color cube
    const c = code - 16;
    const r = Math.floor(c / 36);
    const g = Math.floor((c % 36) / 6);
    const b = c % 6;
    const toHex = (v: number) => (v === 0 ? 0 : v * 40 + 55).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  if (code >= 232 && code <= 255) {
    // Grayscale ramp
    const gray = (code - 232) * 10 + 8;
    const hex = gray.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }
  return '#e2e8f0';
}

/**
 * Strips non-SGR ANSI escape sequences (like cursor positioning, clear line, etc.)
 */
export function cleanRawTerminalText(input: string): string {
  if (!input) return '';
  // Clean carriage returns (take latest line rewrite if present)
  let text = input;
  if (text.includes('\r\n')) {
    text = text.replace(/\r\n/g, '\n');
  } else if (text.includes('\r')) {
    const lines = text.split('\r');
    text = lines[lines.length - 1];
  }
  // Remove terminal control codes like \x1b[2K, \x1b[?25h, etc., while preserving SGR (\x1b[...m)
  text = text.replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnsu]/g, (match) => {
    return match.endsWith('m') ? match : '';
  });
  return text;
}

/**
 * Parses raw text containing ANSI SGR codes into an array of styled spans.
 */
export function parseAnsi(rawText: string): AnsiSpan[] {
  const cleaned = cleanRawTerminalText(rawText);
  if (!cleaned) return [];

  // Regex matching ANSI SGR escape codes: \x1b[...m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  const spans: AnsiSpan[] = [];

  let lastIndex = 0;
  let currentStyle: Omit<AnsiSpan, 'text'> = {};

  let match: RegExpExecArray | null;
  while ((match = ansiRegex.exec(cleaned)) !== null) {
    const textChunk = cleaned.slice(lastIndex, match.index);
    if (textChunk) {
      spans.push({
        text: textChunk,
        ...currentStyle,
      });
    }

    const codeStr = match[1] || '0';
    const codes = codeStr.split(';').map((c) => parseInt(c, 10) || 0);

    let i = 0;
    while (i < codes.length) {
      const code = codes[i];

      if (code === 0) {
        // Reset all styles
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code === 9) {
        currentStyle.strikethrough = true;
      } else if (code === 22) {
        delete currentStyle.bold;
        delete currentStyle.dim;
      } else if (code === 23) {
        delete currentStyle.italic;
      } else if (code === 24) {
        delete currentStyle.underline;
      } else if (code === 29) {
        delete currentStyle.strikethrough;
      } else if (code >= 30 && code <= 37) {
        currentStyle.color = ANSI_STANDARD_COLORS[code];
      } else if (code === 38) {
        // Extended foreground color: 38;5;n or 38;2;r;g;b
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          currentStyle.color = get256Color(codes[i + 2]);
          i += 2;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          const r = Math.min(255, Math.max(0, codes[i + 2]));
          const g = Math.min(255, Math.max(0, codes[i + 3]));
          const b = Math.min(255, Math.max(0, codes[i + 4]));
          currentStyle.color = `rgb(${r}, ${g}, ${b})`;
          i += 4;
        }
      } else if (code === 39) {
        delete currentStyle.color;
      } else if (code >= 40 && code <= 47) {
        currentStyle.backgroundColor = ANSI_BG_COLORS[code];
      } else if (code === 48) {
        // Extended background color: 48;5;n or 48;2;r;g;b
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          currentStyle.backgroundColor = get256Color(codes[i + 2]);
          i += 2;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          const r = Math.min(255, Math.max(0, codes[i + 2]));
          const g = Math.min(255, Math.max(0, codes[i + 3]));
          const b = Math.min(255, Math.max(0, codes[i + 4]));
          currentStyle.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          i += 4;
        }
      } else if (code === 49) {
        delete currentStyle.backgroundColor;
      } else if (code >= 90 && code <= 97) {
        currentStyle.color = ANSI_STANDARD_COLORS[code];
      } else if (code >= 100 && code <= 107) {
        currentStyle.backgroundColor = ANSI_BG_COLORS[code];
      }

      i++;
    }

    lastIndex = ansiRegex.lastIndex;
  }

  // Add trailing plain text
  if (lastIndex < cleaned.length) {
    spans.push({
      text: cleaned.slice(lastIndex),
      ...currentStyle,
    });
  }

  return spans.length > 0 ? spans : [{ text: cleaned }];
}

/**
 * Strips all ANSI codes completely to plain text (e.g. for copying or searching)
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
