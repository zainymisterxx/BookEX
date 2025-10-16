# Message Notification System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MESSAGE NOTIFICATION FLOW                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐                                           ┌──────────┐
│  User A  │                                           │  User B  │
│ (Sender) │                                           │(Receiver)│
└────┬─────┘                                           └────┬─────┘
     │                                                      │
     │ 1. Send Message                                     │
     │ (personalMessage event)                             │
     ├──────────────────────────┐                         │
     │                          │                         │
     │                    ┌─────▼─────────┐              │
     │                    │ Socket Server │              │
     │                    │   (server.ts) │              │
     │                    └─────┬─────────┘              │
     │                          │                         │
     │                          │ 2. Save Message         │
     │                          ├─────────────────────┐   │
     │                          │                     │   │
     │                    ┌─────▼─────────┐    ┌─────▼───▼──────┐
     │ 3. Confirm         │   MongoDB     │    │ personalMessages│
     │ ◄──────────────────┤  (Database)   │    │   collection    │
     │ (messageConfirmed) └───────────────┘    └─────────────────┘
     │                          │                         │
     │                          │ 4. Check Active Chat    │
     │                          ├─────────────────────┐   │
     │                          │                     │   │
     │                    ┌─────▼─────────┐          │   │
     │                    │ Is User B     │          │   │
     │                    │ viewing chat? │          │   │
     │                    └─────┬─────────┘          │   │
     │                          │                     │   │
     │              NO ◄────────┼────────► YES       │   │
     │                          │                     │   │
     │             ┌────────────▼────────┐            │   │
     │             │ Create Notification │            │   │
     │             │ (notification-utils)│            │   │
     │             └────────────┬────────┘            │   │
     │                          │                     │   │
     │                          │ 5. Save            │   │
     │                          ├─────────────────┐   │   │
     │                          │                 │   │   │
     │                    ┌─────▼─────────┐ ┌────▼───▼──┐│
     │                    │ notifications │ │  Skip      ││
     │                    │  collection   │ │Notification││
     │                    └─────┬─────────┘ └────────────┘│
     │                          │                     │   │
     │                          │ 6. Emit Event       │   │
     │                          ├──────────────────────┐  │
     │                          │                      │  │
     │                          │     ┌────────────────▼──▼──┐
     │                          │     │  newNotification     │
     │                          │     │  (Socket.IO event)   │
     │                          │     └────────────────┬─────┘
     │                          │                      │
     │                          │ 7. Receive          │
     │                          │ ◄───────────────────┤
     │                          │                      │
     │                    ┌─────▼────────────┐         │
     │                    │NotificationProvider│        │
     │                    │   (React Context) │        │
     │                    └─────┬─────────────┘        │
     │                          │                      │
     │                          │ 8. Display           │
     │                          ├─────────────────────►│
     │                          │                      │
     │                    ┌─────▼─────────┐            │
     │                    │  UI Displays  │            │
     │                    │ 🔔 Badge with │            │
     │                    │  Notification │            │
     │                    └───────────────┘            │
     │                                                 │
```

## Active Chat Detection Logic

```
┌───────────────────────────────────────────────────────────────┐
│              SHOULD NOTIFICATION BE SENT?                     │
└───────────────────────────────────────────────────────────────┘

    Message Received by User B
              ↓
    ┌─────────────────────┐
    │ Fetch all User B's  │
    │   active sockets    │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │ Check each socket's │
    │   activeChatId      │
    └──────────┬──────────┘
               │
        ┌──────▼──────┐
        │ Any socket  │
        │ viewing this│
        │   chat?     │
        └──────┬──────┘
               │
      ┌────────┴────────┐
      │                 │
   YES│              NO │
      │                 │
      ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   Skip      │   │   Create    │
│Notification │   │Notification │
└─────────────┘   └──────┬──────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Save to DB   │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │Emit via Socket│
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │User sees 🔔  │
                  └──────────────┘
```

## Socket Event Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    SOCKET EVENTS TIMELINE                       │
└────────────────────────────────────────────────────────────────┘

User Opens Chat Page
        │
        ▼
┌───────────────┐
│   connect     │ ◄─── Socket.IO connection established
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  joinUserRoom │ ◄─── Join personal notification room
│  (user_123)   │      (user_${userId})
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   joinChat    │ ◄─── Join specific chat room
│  (chat_456)   │      (chatId)
└───────┬───────┘      socket.activeChatId = chatId
        │
        │
        │ ... user chats ...
        │
        ▼
┌───────────────┐
│  leaveChat    │ ◄─── Leave chat (navigate away)
│  (chat_456)   │      socket.activeChatId = null
└───────┬───────┘
        │
        │ ... user does other things ...
        │
        ▼
┌───────────────┐
│  disconnect   │ ◄─── Socket disconnected
└───────────────┘      Cleanup all rooms


RECEIVING NOTIFICATIONS:
════════════════════════

Chat Page (viewing chat):
┌──────────────────────────────────┐
│ newPersonalMessage event         │ ◄─── Message appears in chat
│ NO newNotification event         │ ◄─── No notification!
└──────────────────────────────────┘

Other Pages (not viewing chat):
┌──────────────────────────────────┐
│ newPersonalMessage event         │ ◄─── Update chat list
│ newNotification event            │ ◄─── Show notification 🔔
└──────────────────────────────────┘
```

## State Tracking

```
┌─────────────────────────────────────────────────────────────┐
│                SOCKET STATE MANAGEMENT                       │
└─────────────────────────────────────────────────────────────┘

SERVER SIDE (server.ts):
────────────────────────
socket.userId         : "68bc327e0ec71d3c9d854610"
socket.activeChatId   : "68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502"
socket.rooms          : Set(["socketId", "user_68bc...", "chat_68bc..."])


CLIENT SIDE (messages-page.tsx):
────────────────────────────────
selectedChat._id      : "68bc327e0ec71d3c9d854610_68d05d897bca4085aebe2502"
messages              : Array<Message>
notifications         : Array<Notification>  ◄─── From NotificationProvider
unreadCount          : 3


NOTIFICATION PROVIDER (notification-provider.tsx):
──────────────────────────────────────────────────
notifications         : Array<Notification>
  └─ type: 'message'
  └─ link: '/messages/chatId'
  └─ read: false
  └─ metadata.chatId: "chatId"
```

## Database Collections

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE SCHEMA                           │
└─────────────────────────────────────────────────────────────┘

personalMessages Collection:
────────────────────────────
{
  _id: ObjectId,
  senderId: String,         // "68bc327e0ec71d3c9d854610"
  receiverId: String,       // "68d05d897bca4085aebe2502"
  content: String,          // "Hey, is the book available?"
  createdAt: ISOString,     // "2025-10-16T10:30:00.000Z"
  read: Boolean             // false
}

notifications Collection:
─────────────────────────
{
  _id: ObjectId,
  userId: String,           // "68d05d897bca4085aebe2502" (receiver)
  type: 'message',
  title: String,            // "New message from John Doe"
  message: String,          // "Hey, is the book available?"
  link: String,             // "/messages/68bc327e...68d05d..."
  read: Boolean,            // false
  createdAt: ISOString,     // "2025-10-16T10:30:00.000Z"
  metadata: {
    chatId: String,         // "68bc327e...68d05d..."
    senderId: String,       // "68bc327e0ec71d3c9d854610"
    senderName: String      // "John Doe"
  }
}
```

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────┐
│                USER EXPERIENCE SCENARIOS                     │
└─────────────────────────────────────────────────────────────┘

SCENARIO 1: User receives message while browsing
────────────────────────────────────────────────

[User B on Home Page]
         │
         ▼
[User A sends message]
         │
         ▼
┌────────────────────┐
│   🔔 Notification  │ ◄─── Badge appears in header
│  "New message from │      Shows unread count
│     John Doe"      │
└────────┬───────────┘
         │
         │ [User clicks notification]
         ▼
┌────────────────────┐
│  Navigate to Chat  │ ◄─── Opens chat directly
│  /messages/chatId  │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Notification 🟢   │ ◄─── Marked as read
│  marked as read    │      Badge count decreases
└────────────────────┘


SCENARIO 2: User receives message while in chat
────────────────────────────────────────────────

[User B in Chat with User A]
         │
         ▼
[User A sends message]
         │
         ▼
┌────────────────────┐
│  Message appears   │ ◄─── Real-time message
│  in chat window    │      NO notification!
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Auto-marked read  │ ◄─── Viewing = read
│  No notification   │
└────────────────────┘


SCENARIO 3: Multiple messages
──────────────────────────────

[User receives 3 messages]
         │
         ▼
┌────────────────────┐
│   🔔 Badge: 3      │ ◄─── Shows total unread
└────────┬───────────┘
         │
         │ [Opens notification panel]
         ▼
┌────────────────────┐
│ 1. John: "Hi!"     │ ◄─── All notifications listed
│ 2. Sarah: "Book?"  │
│ 3. Mike: "Thanks"  │
└────────┬───────────┘
         │
         │ [Clicks one notification]
         ▼
┌────────────────────┐
│  Opens that chat   │ ◄─── Navigate to specific chat
│  Marks as read     │      Count decreases to 2
└────────────────────┘
```

## Notification Badge States

```
┌─────────────────────────────────────────────────────────────┐
│              NOTIFICATION INDICATOR STATES                   │
└─────────────────────────────────────────────────────────────┘

Header Badge:
─────────────

 No Notifications          Has Notifications
┌──────────────┐          ┌──────────────┐
│   🔔         │          │   🔔  [3]    │ ◄─── Red badge with count
│              │          │              │
└──────────────┘          └──────────────┘


Chat List:
──────────

 No Unread Messages       Has Unread Messages
┌──────────────────┐     ┌──────────────────┐
│ 👤 John Doe      │     │ 👤 John Doe  [2] │ ◄─── Unread count
│ "Hello!"         │     │ "New message"    │
└──────────────────┘     └──────────────────┘


Notification Panel:
───────────────────

┌─────────────────────────────────────┐
│ Notifications               [3]     │
├─────────────────────────────────────┤
│ 🔴 New message from John Doe        │ ◄─── Unread (red dot)
│    "Hey, is the book available?"    │
│    2 minutes ago                    │
├─────────────────────────────────────┤
│ ⚪ New message from Sarah           │ ◄─── Read (no dot)
│    "Thanks for the book!"           │
│    1 hour ago                       │
└─────────────────────────────────────┘
```

## Summary

✅ **Smart Notifications** - Only sent when user is NOT viewing the chat
✅ **Real-Time Updates** - Instant delivery via Socket.IO
✅ **Persistent Storage** - Saved to MongoDB for offline users
✅ **Multi-Device Sync** - Works across all tabs and devices
✅ **Clean UX** - No notification spam, intuitive indicators
✅ **Fail-Safe** - Messages delivered even if notifications fail

🎉 **Production Ready!**
