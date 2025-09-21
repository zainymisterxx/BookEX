'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface HighlightedTextProps {
  text: string;
  searchTerm: string;
  className?: string;
  highlightClassName?: string;
}

export function HighlightedText({ 
  text, 
  searchTerm, 
  className,
  highlightClassName 
}: HighlightedTextProps) {
  if (!searchTerm.trim()) {
    return <span className={className}>{text}</span>;
  }

  // Split the search term by spaces to handle multiple words
  const searchTerms = searchTerm.trim().split(/\s+/).filter(Boolean);
  
  // Create a regex that matches any of the search terms (case-insensitive)
  const regex = new RegExp(`(${searchTerms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
  ).join('|')})`, 'gi');

  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part matches any search term
        const isHighlighted = searchTerms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        );

        if (isHighlighted) {
          return (
            <mark
              key={index}
              className={cn(
                'bg-yellow-200 dark:bg-yellow-800 px-1 rounded text-foreground',
                highlightClassName
              )}
            >
              {part}
            </mark>
          );
        }

        return part;
      })}
    </span>
  );
}

// Component for highlighting search terms in book cards
interface HighlightedBookTitleProps {
  title: string;
  searchTerm: string;
  className?: string;
}

export function HighlightedBookTitle({ 
  title, 
  searchTerm, 
  className 
}: HighlightedBookTitleProps) {
  return (
    <HighlightedText
      text={title}
      searchTerm={searchTerm}
      className={cn('font-semibold line-clamp-2', className)}
      highlightClassName="bg-primary/20 dark:bg-primary/30 text-primary-foreground"
    />
  );
}

// Component for highlighting search terms in author names
interface HighlightedAuthorProps {
  author: string;
  searchTerm: string;
  className?: string;
}

export function HighlightedAuthor({ 
  author, 
  searchTerm, 
  className 
}: HighlightedAuthorProps) {
  return (
    <HighlightedText
      text={author}
      searchTerm={searchTerm}
      className={cn('text-sm text-muted-foreground', className)}
      highlightClassName="bg-accent/70 text-accent-foreground"
    />
  );
}

// Component for search snippets (showing context around matched terms)
interface SearchSnippetProps {
  text: string;
  searchTerm: string;
  maxLength?: number;
  className?: string;
}

export function SearchSnippet({ 
  text, 
  searchTerm, 
  maxLength = 150,
  className 
}: SearchSnippetProps) {
  if (!searchTerm.trim() || !text) {
    const truncated = text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
    return <span className={className}>{truncated}</span>;
  }

  // Find the first occurrence of any search term
  const searchTerms = searchTerm.trim().split(/\s+/).filter(Boolean);
  let firstMatchIndex = -1;
  let matchedTerm = '';

  for (const term of searchTerms) {
    const index = text.toLowerCase().indexOf(term.toLowerCase());
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index;
      matchedTerm = term;
    }
  }

  if (firstMatchIndex === -1) {
    // No match found, return truncated text
    const truncated = text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
    return <span className={className}>{truncated}</span>;
  }

  // Extract context around the match
  const contextLength = Math.floor((maxLength - matchedTerm.length) / 2);
  const start = Math.max(0, firstMatchIndex - contextLength);
  const end = Math.min(text.length, firstMatchIndex + matchedTerm.length + contextLength);
  
  let snippet = text.substring(start, end);
  
  // Add ellipsis if we truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return (
    <HighlightedText
      text={snippet}
      searchTerm={searchTerm}
      className={cn('text-sm text-muted-foreground line-clamp-2', className)}
      highlightClassName="bg-accent/50 text-accent-foreground"
    />
  );
}
