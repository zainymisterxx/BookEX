// Utility helpers for normalizing and working with messages
// Ensures consistent access to message text regardless of legacy field name.

import { Message } from './types';

/**
 * Get the displayable text content of a message (prefers `text`, falls back to `content`).
 */
export function getMessageText(msg: Message): string {
  return (msg.text ?? msg.content ?? '').toString();
}

/**
 * Returns a new message object with `text` populated (copy from `content` if needed)
 * without mutating the original reference.
 */
export function normalizeMessage<T extends Message>(msg: T): T {
  if (msg.text || !msg.content) return msg;
  return { ...msg, text: msg.content };
}

/**
 * Normalize an array of messages.
 */
export function normalizeMessages<T extends Message>(msgs: T[]): T[] {
  let changed = false;
  const mapped = msgs.map(m => {
    if (!m.text && m.content) {
      changed = true;
      return { ...m, text: m.content } as T;
    }
    return m;
  });
  return changed ? mapped : msgs;
}

/**
 * Shallow compare to detect dupes (id or timestamp+sender heuristic)
 */
export function isSameMessage(a: Message, b: Message): boolean {
  if (a._id && b._id) return a._id === b._id;
  return a.senderId === b.senderId && a.createdAt === b.createdAt && getMessageText(a) === getMessageText(b);
}
