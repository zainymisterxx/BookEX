import { connectToMongoDB } from './mongodb';
import type { Notification } from './types';
import { ObjectId } from 'mongodb';

/**
 * Creates a message notification for a user
 * @param userId - The user who will receive the notification
 * @param senderId - The user who sent the message
 * @param senderName - The name of the user who sent the message
 * @param messagePreview - Preview text of the message
 * @param chatId - The ID of the chat
 * @returns The created notification or null if failed
 */
export async function createMessageNotification(
  userId: string,
  senderId: string,
  senderName: string,
  messagePreview: string,
  chatId: string
): Promise<Notification | null> {
  try {
    const { db } = await connectToMongoDB();
    
    // Truncate message preview to 100 characters
    const truncatedPreview = messagePreview.length > 100 
      ? `${messagePreview.substring(0, 100)}...` 
      : messagePreview;
    
    const notification: Omit<Notification, '_id'> = {
      userId,
      type: 'message',
      title: `New message from ${senderName}`,
      message: truncatedPreview,
      link: `/messages/${chatId}`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: {
        chatId,
        senderId,
        senderName
      }
    };
    
    const result = await db.collection('notifications').insertOne(notification);
    
    return {
      ...notification,
      _id: result.insertedId.toString()
    };
  } catch (error) {
    console.error('Error creating message notification:', error);
    return null;
  }
}

/**
 * Creates an exchange proposal notification for a user
 * @param userId - The user who will receive the notification
 * @param proposerName - The name of the user who proposed the exchange
 * @param bookTitle - The title of the book in the exchange
 * @param exchangeId - The ID of the exchange
 */
export async function createExchangeProposalNotification(
  userId: string,
  proposerName: string,
  bookTitle: string,
  exchangeId: string
): Promise<Notification | null> {
  try {
    const { db } = await connectToMongoDB();
    
    const notification: Omit<Notification, '_id'> = {
      userId,
      type: 'exchange_proposal',
      title: `New exchange proposal from ${proposerName}`,
      message: `${proposerName} wants to exchange "${bookTitle}" with you`,
      link: `/exchanges/${exchangeId}`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: {
        exchangeId,
        bookTitle,
        proposerName
      }
    };
    
    const result = await db.collection('notifications').insertOne(notification);
    
    return {
      ...notification,
      _id: result.insertedId.toString()
    };
  } catch (error) {
    console.error('Error creating exchange proposal notification:', error);
    return null;
  }
}

/**
 * Creates an exchange status update notification for a user
 * @param userId - The user who will receive the notification
 * @param status - The new status of the exchange
 * @param bookTitle - The title of the book in the exchange
 * @param exchangeId - The ID of the exchange
 */
export async function createExchangeUpdateNotification(
  userId: string,
  status: string,
  bookTitle: string,
  exchangeId: string
): Promise<Notification | null> {
  try {
    const { db } = await connectToMongoDB();
    
    const statusMessages: Record<string, string> = {
      'accepted': 'Your exchange proposal was accepted!',
      'rejected': 'Your exchange proposal was declined',
      'completed': 'Exchange completed successfully',
      'cancelled': 'Exchange was cancelled'
    };
    
    const notification: Omit<Notification, '_id'> = {
      userId,
      type: 'exchange_update',
      title: `Exchange update: ${bookTitle}`,
      message: statusMessages[status] || `Exchange status changed to ${status}`,
      link: `/exchanges/${exchangeId}`,
      read: false,
      createdAt: new Date().toISOString(),
      metadata: {
        exchangeId,
        bookTitle,
        status
      }
    };
    
    const result = await db.collection('notifications').insertOne(notification);
    
    return {
      ...notification,
      _id: result.insertedId.toString()
    };
  } catch (error) {
    console.error('Error creating exchange update notification:', error);
    return null;
  }
}

/**
 * Emits a notification through the socket server
 * @param notification - The notification to emit
 * @param userId - The user ID to emit the notification to
 */
export async function emitNotification(notification: Notification, userId: string): Promise<void> {
  try {
    const socketUrl = process.env.SOCKET_URL || 'http://localhost:3001';
    await fetch(`${socketUrl}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'newNotification',
        room: `user_${userId}`,
        data: notification
      })
    });
  } catch (error) {
    console.error('Error emitting notification through socket:', error);
    // Don't throw - notification was already saved to database
  }
}
