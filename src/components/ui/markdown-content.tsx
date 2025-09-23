"use client";

import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

// Very lightweight markdown renderer supporting bold, italics, links, lists, and line breaks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBasicMarkdown(md: string): string {
  let html = escapeHtml(md);
  // Links: [text](url)
  html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$1</a>');
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/(^|\s)\*(?!\*)([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
  // Unordered lists: lines starting with - or *
  html = html.replace(/(^|\n)[\t ]*[-*][\t ]+(.+)(?=\n|$)/g, (_m, p1, p2) => `${p1}<li>${p2}</li>`);
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-6 space-y-1">${match.replace(/\n/g, '')}</ul>`);
  // Line breaks
  html = html.replace(/\n/g, '<br/>');
  return html;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const html = React.useMemo(() => renderBasicMarkdown(content || ''), [content]);
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export default MarkdownContent;


