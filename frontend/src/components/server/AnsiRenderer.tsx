import React, { useMemo } from 'react';
import { parseAnsi, AnsiSpan } from './ansi';

interface AnsiRendererProps {
  raw: string;
  searchQuery?: string;
  className?: string;
}

export const AnsiRenderer: React.FC<AnsiRendererProps> = React.memo(({
  raw,
  searchQuery,
  className = '',
}) => {
  const spans = useMemo(() => parseAnsi(raw), [raw]);

  if (!searchQuery) {
    return (
      <span className={className}>
        {spans.map((span, idx) => (
          <span
            key={idx}
            style={{
              color: span.color,
              backgroundColor: span.backgroundColor,
              fontWeight: span.bold ? 700 : span.dim ? 300 : undefined,
              fontStyle: span.italic ? 'italic' : undefined,
              textDecoration: [
                span.underline ? 'underline' : '',
                span.strikethrough ? 'line-through' : '',
              ].filter(Boolean).join(' ') || undefined,
              opacity: span.dim ? 0.7 : undefined,
            }}
          >
            {span.text}
          </span>
        ))}
      </span>
    );
  }

  // Render with search query highlight
  const queryLower = searchQuery.toLowerCase();

  return (
    <span className={className}>
      {spans.map((span, spanIdx) => {
        const text = span.text;
        const textLower = text.toLowerCase();

        if (!textLower.includes(queryLower)) {
          return (
            <span
              key={spanIdx}
              style={{
                color: span.color,
                backgroundColor: span.backgroundColor,
                fontWeight: span.bold ? 700 : undefined,
                fontStyle: span.italic ? 'italic' : undefined,
                textDecoration: span.underline ? 'underline' : undefined,
                opacity: span.dim ? 0.7 : undefined,
              }}
            >
              {text}
            </span>
          );
        }

        // Split text around matched query
        const parts: React.ReactNode[] = [];
        let cursor = 0;

        while (cursor < text.length) {
          const matchIndex = textLower.indexOf(queryLower, cursor);
          if (matchIndex === -1) {
            parts.push(text.slice(cursor));
            break;
          }

          if (matchIndex > cursor) {
            parts.push(text.slice(cursor, matchIndex));
          }

          const matchedStr = text.slice(matchIndex, matchIndex + searchQuery.length);
          parts.push(
            <mark
              key={`match-${cursor}`}
              className="bg-amber-500/30 text-amber-200 border-b border-amber-400 font-semibold px-0.5 rounded-sm"
            >
              {matchedStr}
            </mark>
          );

          cursor = matchIndex + searchQuery.length;
        }

        return (
          <span
            key={spanIdx}
            style={{
              color: span.color,
              backgroundColor: span.backgroundColor,
              fontWeight: span.bold ? 700 : undefined,
              fontStyle: span.italic ? 'italic' : undefined,
            }}
          >
            {parts}
          </span>
        );
      })}
    </span>
  );
});

AnsiRenderer.displayName = 'AnsiRenderer';
