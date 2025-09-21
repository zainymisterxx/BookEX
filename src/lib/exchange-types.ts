/**
 * Exchange Status Tracking and History System
 * Integrates with existing chat system to provide structured exchange management
 */

import { ObjectId } from 'mongodb';

// Exchange status enum
export enum ExchangeStatus {
  PROPOSED = 'proposed',        // Initial proposal sent
  ACCEPTED = 'accepted',        // Both parties agreed
  IN_PROGRESS = 'in_progress',  // Books being exchanged
  COMPLETED = 'completed',      // Exchange finished successfully
  CANCELLED = 'cancelled',      // Exchange cancelled by either party
  DISPUTED = 'disputed'         // Dispute raised, needs resolution
}

// Exchange interface
export interface Exchange {
  _id: ObjectId | string;
  
  // Participants
  proposerId: string;           // User who initiated the exchange
  responderId: string;          // User who received the proposal
  
  // Books being exchanged
  proposerBookId: ObjectId;     // Book offered by proposer
  responderBookId: ObjectId;    // Book requested from responder
  
  // Status tracking
  status: ExchangeStatus;
  statusHistory: ExchangeStatusUpdate[];
  
  // Integration with chat system
  chatId: ObjectId;             // Link to existing chat
  
  // Timestamps
  proposedAt: string;           // When exchange was proposed
  acceptedAt?: string;          // When exchange was accepted
  completedAt?: string;         // When exchange was completed
  updatedAt: string;
  
  // Additional details
  notes?: string;               // Optional notes from proposer
  meetingLocation?: string;     // Where to meet for exchange
  
  // Completion tracking
  proposerConfirmed?: boolean;  // Did proposer confirm completion?
  responderConfirmed?: boolean; // Did responder confirm completion?
  
  // Ratings (after completion)
  proposerRating?: number;      // 1-5 rating from proposer
  responderRating?: number;     // 1-5 rating from responder
  proposerReview?: string;      // Optional review from proposer
  responderReview?: string;     // Optional review from responder
}

// Status update tracking
export interface ExchangeStatusUpdate {
  status: ExchangeStatus;
  timestamp: string;
  updatedBy: string;            // User ID who made the update
  notes?: string;               // Optional notes for the status change
}

/**
 * How this integrates with existing chat system:
 * 
 * 1. Chat System Remains Primary Communication
 *    - Users still chat normally to discuss details
 *    - Chat provides flexibility for negotiations
 * 
 * 2. Exchange System Adds Structure
 *    - Formal "Accept Exchange" button in chat
 *    - Status tracking overlay on chat interface
 *    - Completion confirmation mechanism
 * 
 * 3. Enhanced User Experience
 *    - Users see exchange status in chat header
 *    - Clear action buttons for status changes
 *    - Exchange history separate from all chats
 */
