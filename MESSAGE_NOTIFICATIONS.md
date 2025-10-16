# Message Notifications Integration

## Overview
Users now receive real-time notifications whenever they receive a new message. Notifications are intelligently sent only when the user is NOT actively viewing the chat, preventing notification spam while ensuring users don't miss important messages.

## Features Implemented

### 1. **Notification Creation**
- ✅ Automatic notification when message is sent
- ✅ Notification includes sender name and message preview (truncated to 100 chars)
- ✅ Direct link to the chat for quick access
- ✅ Stored in database for persistence

### 2. **Real-Time Delivery**
- ✅ Notifications emitted via Socket.IO to user's room
- ✅ Instant notification display in UI (via NotificationProvider)
- ✅ Works across multiple tabs/devices

### 3. **Smart Notification Logic**
- ✅ **No notification if user is viewing the chat** - prevents spam
- ✅ Only unread messages trigger notifications
- ✅ Notifications persist across page reloads

### 4. **Active Chat Tracking**
- ✅ Socket server tracks which chat each user is viewing
- ✅ `joinChat` event when user opens a chat
- ✅ `leaveChat` event when user closes a chat
- ✅ Cleanup on disconnect

## Files Modified

### 1. `/src/lib/notification-utils.ts` (NEW FILE)
Utility functions for creating and emitting notifications.

**Functions:**
- `createMessageNotification()` - Creates message notification in database
- `createExchangeProposalNotification()` - For future exchange features
- `createExchangeUpdateNotification()` - For future exchange features
- `emitNotification()` - Emits notification via Socket.IO

**Key Features:**
```typescript
// Creates notification with all required fields
const notification: Notification = {
  userId,
  type: 'message',
  title: `New message from ${senderName}`,
  message: truncatedPreview,
  link: `/messages/${chatId}`,
  read: false,
  createdAt: new Date().toISOString(),
  metadata: { chatId, senderId, senderName }
};
```

### 2. `/server.ts` (UPDATED)
Socket.IO server with notification integration.

**Changes:**
- ✅ Import notification utilities and chat utilities
- ✅ Extended Socket interface to track `activeChatId`
- ✅ Added `leaveChat` event handler
- ✅ Track active chat when user joins
- ✅ Clear active chat when user leaves
- ✅ Create notification after message save
- ✅ Check if receiver is viewing chat before sending notification

**Key Code:**
```typescript
// Check if receiver is viewing the chat
const receiverSockets = await io.in(`user_${receiverId}`).fetchSockets();
const isViewingChat = receiverSockets.some(s => s.activeChatId === chatId);

if (!isViewingChat) {
  const notification = await createMessageNotification(...);
  if (notification) {
    await emitNotification(notification, receiverId);
  }
}
```

### 3. `/src/app/(main)/messages/[id]/page.tsx` (UPDATED)
Chat page component to emit leaveChat on unmount.

**Changes:**
- ✅ Emit `leaveChat` event in cleanup function
- ✅ Ensures server knows when user leaves chat
- ✅ Enables notifications to be sent after user closes chat

## How It Works

### Flow Diagram
```
User A sends message to User B
        ↓
Socket server receives 'personalMessage' event
        ↓
Save message to database (personalMessages collection)
        ↓
Emit 'messageConfirmed' to User A (sender)
        ↓
Emit 'newPersonalMessage' to User B (receiver)
        ↓
Check if User B is viewing this chat
        ↓
    NO: Create notification         YES: Skip notification
        ↓                                  ↓
    Save to DB                    User B sees message immediately
        ↓
    Emit 'newNotification'
        ↓
    User B's NotificationProvider receives it
        ↓
    Notification appears in UI
```

### Active Chat Tracking
```
User opens chat page
        ↓
Socket emits 'joinChat' with chatId
        ↓
Server: socket.activeChatId = chatId
        ↓
User receives message while viewing
        ↓
Server checks: socket.activeChatId === chatId?
        ↓
    YES: No notification sent
        ↓
User closes chat or navigates away
        ↓
Socket emits 'leaveChat' with chatId
        ↓
Server: socket.activeChatId = null
        ↓
User receives message while not viewing
        ↓
Server checks: socket.activeChatId === chatId?
        ↓
    NO: Notification sent!
```

## Notification Data Structure

### In Database (notifications collection)
```json
{
  "_id": "ObjectId",
  "userId": "68bc327e0ec71d3c9d854610",
  "type": "message",
  "title": "New message from John Doe",
  "message": "Hey, is the book still available?",
  "link": "/messages/68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502",
  "read": false,
  "createdAt": "2025-10-16T10:30:00.000Z",
  "metadata": {
    "chatId": "68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502",
    "senderId": "68bc327e0ec71d3c9d854610",
    "senderName": "John Doe"
  }
}
```

### Socket Event Payload
```json
{
  "event": "newNotification",
  "room": "user_68d05d897bca4085aebe2502",
  "data": {
    "_id": "...",
    "userId": "68d05d897bca4085aebe2502",
    "type": "message",
    "title": "New message from John Doe",
    "message": "Hey, is the book still available?",
    "link": "/messages/68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502",
    "read": false,
    "createdAt": "2025-10-16T10:30:00.000Z",
    "metadata": { ... }
  }
}
```

## Testing

### Manual Testing Steps

#### 1. **Basic Notification Flow**
```
Setup:
- Open browser as User A
- Open incognito/another browser as User B

Test:
1. User A logs in
2. User B logs in
3. User A goes to Messages page (not in a specific chat)
4. User B sends message to User A
5. ✅ User A should see notification badge/indicator
6. User A clicks notification
7. ✅ Should navigate to chat with User B
8. ✅ Notification should be marked as read
```

#### 2. **Smart Notification (Active Chat)**
```
Setup:
- User A viewing chat with User B

Test:
1. User A opens chat with User B (actively viewing)
2. User B sends message to User A
3. ✅ User A should NOT receive notification (already viewing)
4. ✅ Message should appear in chat immediately
5. User A closes chat
6. User B sends another message
7. ✅ User A should receive notification (no longer viewing)
```

#### 3. **Multi-Tab Sync**
```
Setup:
- User A opens two browser tabs

Test:
1. Tab 1: User A viewing Messages list
2. Tab 2: User A viewing specific chat with User B
3. User B sends message to User A
4. ✅ Tab 2: No notification (viewing chat)
5. ✅ Tab 1: Message appears in chat list
6. Close Tab 2
7. User B sends another message
8. ✅ Tab 1: Notification appears
```

#### 4. **Notification Persistence**
```
Test:
1. User A receives message notification
2. User A does NOT click it
3. User A refreshes page
4. ✅ Notification should still be visible
5. ✅ Unread count should be accurate
6. User A clicks notification
7. ✅ Notification marked as read
8. Refresh page
9. ✅ Notification no longer shows as unread
```

### Browser Console Verification

**Successful notification creation:**
```
Personal message sent from 68bc327e0ec71d3c9d854610 to 68d05d897bca4085aebe2502
Notification sent to user 68d05d897bca4085aebe2502 for new message
```

**Notification skipped (user viewing chat):**
```
Personal message sent from 68bc327e0ec71d3c9d854610 to 68d05d897bca4085aebe2502
User 68d05d897bca4085aebe2502 is viewing chat 68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502, skipping notification
```

**Client-side notification received:**
```
New notification received: {type: 'message', title: 'New message from...', ...}
```

### Network Tab Verification

**Notification creation (server logs):**
1. Socket.IO event: `personalMessage`
2. Database insert: `personalMessages.insertOne()`
3. Database insert: `notifications.insertOne()`
4. Socket emit: `newNotification` to user room
5. Socket emit: `newPersonalMessage` to receiver

## Edge Cases Handled

### 1. ✅ **Notification Creation Failure**
```typescript
try {
  const notification = await createMessageNotification(...);
  if (notification) {
    await emitNotification(notification, receiverId);
  }
} catch (notificationError) {
  console.error('Error creating message notification:', notificationError);
  // Don't fail the message send if notification fails
}
```
**Result:** Message is still sent and delivered even if notification fails

### 2. ✅ **Socket Emit Failure**
```typescript
export async function emitNotification(notification: Notification, userId: string) {
  try {
    await fetch(`${socketUrl}/emit`, {...});
  } catch (error) {
    console.error('Error emitting notification through socket:', error);
    // Don't throw - notification was already saved to database
  }
}
```
**Result:** Notification persists in database, will be visible on next page load

### 3. ✅ **User Offline**
- Notification saved to database
- When user comes online, NotificationProvider fetches all unread notifications
- User sees notification even if they were offline when message was sent

### 4. ✅ **Multiple Active Sockets**
```typescript
const receiverSockets = await io.in(`user_${receiverId}`).fetchSockets();
const isViewingChat = receiverSockets.some(s => s.activeChatId === chatId);
```
**Result:** Checks ALL user's sockets (all tabs/devices), notification skipped if ANY are viewing the chat

### 5. ✅ **Rapid Messages**
- Each message creates its own notification
- NotificationProvider deduplicates by ID
- Prevents duplicate notifications from race conditions

### 6. ✅ **Message Content Sanitization**
```typescript
const sanitizedContent = content
  .trim()
  .replace(/[<>]/g, '')     // Remove HTML tags
  .slice(0, 2000);          // Limit length

// Truncate preview in notification
const truncatedPreview = messagePreview.length > 100 
  ? `${messagePreview.substring(0, 100)}...` 
  : messagePreview;
```
**Result:** Safe notification preview, prevents XSS attacks

## Future Enhancements

### Potential Improvements:
1. **Notification Preferences**
   - Allow users to disable message notifications
   - Different notification sounds
   - Email notifications for offline messages

2. **Notification Grouping**
   - Group multiple messages from same user
   - "John sent you 3 messages"

3. **Rich Notifications**
   - Show sender avatar in notification
   - Quick reply from notification

4. **Push Notifications**
   - Browser push notifications (Web Push API)
   - Mobile push notifications

5. **Do Not Disturb**
   - Mute notifications during specific hours
   - Mute specific conversations

## Troubleshooting

### Issue: Notifications not appearing
**Check:**
1. NotificationProvider is wrapped around app
2. Socket.IO connection is active (`socket.connected`)
3. User has joined their user room (`joinUserRoom` event)
4. Browser console for errors

**Solution:**
```javascript
// Check in browser console
console.log('Socket connected:', socket?.connected);
console.log('Notifications:', notifications);
console.log('Unread count:', unreadCount);
```

### Issue: Notifications appearing when viewing chat
**Check:**
1. `joinChat` event is being emitted
2. `socket.activeChatId` is set on server
3. Server logs show "is viewing chat, skipping notification"

**Solution:**
```javascript
// Add debugging in chat page
useEffect(() => {
  socketRef.current?.emit('joinChat', id);
  console.log('Joined chat:', id);
}, [id]);
```

### Issue: Notifications not persisting
**Check:**
1. Database write succeeding
2. MongoDB connection active
3. Notification collection has proper indexes

**Solution:**
```bash
# Check MongoDB
db.notifications.find({ userId: "USER_ID" }).sort({ createdAt: -1 }).limit(5)
```

## Related Documentation
- [CHAT_COMPLETE_FIX_SUMMARY.md](./CHAT_COMPLETE_FIX_SUMMARY.md) - Complete chat system fixes
- [UNREAD_INDICATOR_FIX.md](./UNREAD_INDICATOR_FIX.md) - Unread message indicators
- [CHAT_LIST_FIX.md](./CHAT_LIST_FIX.md) - Chat list display fixes

## Summary
✅ Message notifications fully integrated with smart delivery logic
✅ Real-time notifications via Socket.IO
✅ Persistent notifications in database
✅ Active chat tracking prevents notification spam
✅ Edge cases handled gracefully
✅ Ready for production use! 🎉
