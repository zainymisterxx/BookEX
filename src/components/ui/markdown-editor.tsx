"use client";

import React, { useState } from 'react';
import { Textarea } from './textarea';
import { Button } from './button';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MarkdownEditor({ value, onChange, disabled, placeholder, className }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs text-muted-foreground">Formatting: **bold**, *italic*, [link](https://)</div>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowPreview(p => !p)}>
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div className="border rounded-md px-3 py-2 bg-secondary/40">
          {/* Lazy import to avoid circular refs */}
          {/** @ts-expect-error dynamic import in client */}
          {React.createElement(require('./markdown-content').MarkdownContent, { content: value })}
        </div>
      ) : (
        <Textarea
          placeholder={placeholder}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="resize-none"
        />
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Tips:</span>
        <code>**bold**</code>
        <code>*italic*</code>
        <code>[text](https://url)</code>
        <code>- list item</code>
      </div>
    </div>
  );
}

export default MarkdownEditor;


