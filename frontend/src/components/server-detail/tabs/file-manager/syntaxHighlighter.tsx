import React from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';

export interface LanguageInfo {
  id: string;
  label: string;
  prismGrammar: string;
}

export function detectLanguage(filename: string): LanguageInfo {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
    return { id: 'yaml', label: 'YAML', prismGrammar: 'yaml' };
  }
  if (lower.endsWith('.json')) {
    return { id: 'json', label: 'JSON', prismGrammar: 'json' };
  }
  if (
    lower.endsWith('.properties') ||
    lower.endsWith('.conf') ||
    lower.endsWith('.cfg') ||
    lower.endsWith('.ini') ||
    lower.endsWith('.env')
  ) {
    return { id: 'ini', label: 'PROPERTIES', prismGrammar: 'ini' };
  }
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) {
    return { id: 'bash', label: 'SHELL', prismGrammar: 'bash' };
  }
  if (lower.endsWith('.sql')) {
    return { id: 'sql', label: 'SQL', prismGrammar: 'sql' };
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return { id: 'markdown', label: 'MARKDOWN', prismGrammar: 'markdown' };
  }
  if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.svg')) {
    return { id: 'markup', label: 'XML', prismGrammar: 'markup' };
  }
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.mjs')) {
    return { id: 'javascript', label: 'JAVASCRIPT', prismGrammar: 'javascript' };
  }
  if (lower.endsWith('.log')) {
    return { id: 'log', label: 'LOG', prismGrammar: 'plain' };
  }
  return { id: 'plain', label: 'PLAIN TEXT', prismGrammar: 'plain' };
}

function getTokenClass(type: string, alias?: string | string[]): string {
  const aliases = Array.isArray(alias) ? alias.join(' ') : (alias || '');

  switch (type) {
    case 'comment':
    case 'shebang':
      return 'text-slate-500 italic';
    case 'string':
      return 'text-emerald-300';
    case 'number':
      return 'text-amber-400 font-mono';
    case 'boolean':
      return 'text-purple-400 font-semibold';
    case 'key':
    case 'property':
    case 'atrule':
      return 'text-violet-300 font-semibold';
    case 'keyword':
      return 'text-fuchsia-400 font-bold';
    case 'function':
    case 'class-name':
    case 'builtin':
      return 'text-amber-200';
    case 'variable':
    case 'parameter':
    case 'assign-left':
      return 'text-yellow-300';
    case 'operator':
      return 'text-pink-400';
    case 'punctuation':
      return 'text-slate-400';
    case 'tag':
      return 'text-rose-400';
    case 'attr-name':
      return 'text-violet-300 font-medium';
    case 'attr-value':
      return 'text-emerald-300';
    case 'url':
      return 'text-amber-300 underline';
    case 'important':
      return 'text-rose-400 font-bold';
    default:
      if (aliases.includes('attr-name') || aliases.includes('atrule')) {
        return 'text-violet-300 font-medium';
      }
      if (aliases.includes('variable')) {
        return 'text-yellow-300';
      }
      if (aliases.includes('important')) {
        return 'text-purple-400 font-semibold';
      }
      return 'text-slate-200';
  }
}

function renderTokenNode(token: string | Prism.Token, key: string): React.ReactNode {
  if (typeof token === 'string') {
    return token;
  }

  // Custom enrichment for ini/properties values
  if (token.type === 'value' && Array.isArray(token.content)) {
    return (
      <span key={key}>
        {token.content.map((item, idx) => {
          if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed === 'true' || trimmed === 'false') {
              return (
                <span key={idx} className="text-purple-400 font-semibold">
                  {item}
                </span>
              );
            }
            if (/^\d+(\.\d+)?$/.test(trimmed)) {
              return (
                <span key={idx} className="text-amber-400 font-mono">
                  {item}
                </span>
              );
            }
            return (
              <span key={idx} className="text-emerald-300">
                {item}
              </span>
            );
          }
          return renderTokenNode(item, `${key}-${idx}`);
        })}
      </span>
    );
  }

  const className = getTokenClass(token.type, token.alias);

  let children: React.ReactNode;
  if (Array.isArray(token.content)) {
    children = token.content.map((child, idx) => renderTokenNode(child, `${key}-${idx}`));
  } else if (typeof token.content === 'object' && token.content !== null) {
    children = renderTokenNode(token.content, `${key}-inner`);
  } else {
    children = token.content;
  }

  return (
    <span key={key} className={className}>
      {children}
    </span>
  );
}

function renderLogHighlights(code: string): React.ReactNode {
  const lines = code.split('\n');
  return lines.map((line, lineIdx) => {
    // Check log level patterns like [14:20:01 INFO]: or [DEBUG]:
    const match = line.match(/^(\[.*?\])\s*(\[.*?\])?(.*)$/);
    if (match) {
      const part1 = match[1];
      const part2 = match[2] || '';
      const rest = match[3] || '';

      const isError = line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception');
      const isWarn = line.includes('WARN');
      const isInfo = line.includes('INFO');
      const isDebug = line.includes('DEBUG');

      const levelColor = isError
        ? 'text-rose-400 font-bold'
        : isWarn
        ? 'text-amber-400 font-semibold'
        : isInfo
        ? 'text-emerald-400 font-medium'
        : isDebug
        ? 'text-zinc-400 font-medium'
        : 'text-slate-400';

      return (
        <React.Fragment key={lineIdx}>
          <span className="text-slate-500">{part1}</span>
          {part2 && <span className={`ml-1.5 ${levelColor}`}>{part2}</span>}
          <span className={isError ? 'text-rose-300' : isWarn ? 'text-amber-200' : 'text-slate-200'}>
            {rest}
          </span>
          {lineIdx < lines.length - 1 && '\n'}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={lineIdx}>
        <span className="text-slate-300">{line}</span>
        {lineIdx < lines.length - 1 && '\n'}
      </React.Fragment>
    );
  });
}

export function highlightCode(code: string, languageInfo: LanguageInfo): React.ReactNode {
  if (languageInfo.id === 'log') {
    return renderLogHighlights(code);
  }

  const grammar = Prism.languages[languageInfo.prismGrammar] || Prism.languages.plain;
  if (!grammar) {
    return code;
  }

  try {
    const tokens = Prism.tokenize(code, grammar);
    const rendered = tokens.map((token, idx) => renderTokenNode(token, `t-${idx}`));
    // Ensure trailing newline renders height matching textarea
    if (code.endsWith('\n')) {
      return (
        <>
          {rendered}
          {'\n '}
        </>
      );
    }
    return rendered;
  } catch (err) {
    console.error('Highlighting error:', err);
    return code;
  }
}
