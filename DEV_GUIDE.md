# BookEx: Comprehensive Developer Guide

## 1. Introduction

Welcome to the BookEx developer team! This guide serves as a comprehensive resource for understanding the BookEx web application's architecture, data management, and development patterns.

**BookEx** is a Next.js application designed to create a community for book lovers to buy, sell, exchange, and donate books. It features user management, community discussions, real-time messaging, and AI-powered assistance, all built on a modern, robust tech stack.

---

## 2. Architecture with Next.js & MongoDB

### 2.1. Project Directory Structure

```
/
├── src/
│   ├── app/
│   │   ├── (main)/         # Main application routes with shared layout
│   │   │   ├── ... (books, community, profile, etc.)
│   │   │   ├── layout.tsx    # Shared layout for the main app (Header, Footer)
│   │   │   └── page.tsx      # Home page
│   │   ├── admin/            # Protected admin routes
│   │   │   ├── layout.tsx    # Server-side security for the admin panel
│   │   │   └── page.tsx      # Admin dashboard
│   │   ├── api/auth/         # NextAuth.js authentication routes
│   │   │   └── [...nextauth]/route.ts
│   │   ├── actions.ts      # All Next.js Server Actions for backend logic
│   │   ├── globals.css     # Global styles and ShadCN theme variables
│   │   └── layout.tsx      # Root layout for the entire application
│   ├── ai/
│   │   ├── flows/          # Genkit AI flows (server-side functions)
│   │   └── genkit.ts       # Genkit initialization
│   ├── components/
│   │   ├── ui/             # Reusable ShadCN UI components
│   │   └── *.tsx           # General reusable components (e.g., BookCard, Header)
│   ├── lib/
│   │   ├── data.ts         # Server-side data fetching functions (using MongoDB)
│   │   ├── mongodb.ts      # MongoDB client connection utility
│   │   ├── types.ts        # Core TypeScript type definitions for our data models
│   │   └── utils.ts        # Utility functions (e.g., `cn` for Tailwind classes)
├── .env                  # Environment variables (MONGODB_URI, NEXTAUTH_SECRET)
├── server.ts             # Socket.IO server for real-time messaging & notifications
├── DEV_GUIDE.md          # This developer guide
└── package.json          # Project dependencies
```

### 2.2. Purpose of Major Files & Folders

-   **`src/app/actions.ts`**: **CRITICAL FILE.** This file contains all the backend logic for the application, implemented as Next.js Server Actions. Any operation that modifies data (creating a book, liking a post, sending a message) is handled here. These functions are executed securely on the server.
-   **`src/lib/data.ts`**: This file contains all server-side functions that **read** data from MongoDB. These are used primarily by Server Components (`page.tsx`) to get the initial data needed to render a page.
-   **`src/lib/types.ts`**: The single source of truth for our data structures. Every MongoDB document has a corresponding TypeScript interface defined here (e.g., `Book`, `User`, `Community`).
-   **`src/lib/mongodb.ts`**: A robust, singleton-pattern utility for establishing and reusing the connection to your MongoDB Atlas cluster. This is essential for performance in a serverless environment.
-   **`src/app/api/auth/[...nextauth]/route.ts`**: This is the core of our authentication system, powered by `next-auth`. It handles user login with credentials, password hashing/comparison, and JWT-based session management.
-   **`server.ts`**: A standalone `socket.io` server that runs alongside Next.js. It manages real-time chat messages and pushes live notifications to clients, making the application highly interactive.
-   **`src/app/admin/layout.tsx`**: This layout contains server-side logic that uses `next-auth`'s `getSession` to verify a user's session and check their `role`, ensuring only authenticated administrators can access these routes.

### 2.3. MongoDB Integration Details

Our application is built on MongoDB, leveraging its flexibility and performance.

#### Data Models & Collections

Our data models in `src/lib/types.ts` map directly to MongoDB collections:

| Type (in `types.ts`) | MongoDB Collection | Description                                                               |
| -------------------- | -------------------- | ------------------------------------------------------------------------- |
| `User`               | `users`              | Stores user profiles, hashed passwords, roles, and wishlists.             |
| `Book`               | `books`              | Contains all book listings for sale or exchange.                          |
| `Community`          | `communities`        | Stores community groups, member lists, and embeds posts.                  |
| `Chat`               | `chats`              | Stores metadata and embedded messages for conversations between users.    |
| `Report`             | `reports`            | User-submitted reports for content moderation by admins.                  |
| `Organization`       | `organizations`      | Information about organizations approved for donations.                   |
| `Review`             | `reviews`            | User-submitted reviews and ratings for other users.                       |

#### Server Actions for CRUD Operations

All data modifications are handled through Server Actions in `src/app/actions.ts`.

-   **Create:** We use `collection.insertOne()` to create new documents.
    *   **Example (in `listBook` action):** `await db.collection("books").insertOne(newBook);`
-   **Read (Server-side):** In `src/lib/data.ts`, we use `find()`, `findOne()`, and aggregation pipelines for fetching data in Server Components.
    *   **Example (in `getRecentListings`):** `await db.collection("books").find({}).sort({ createdAt: -1 }).limit(count).toArray();`
-   **Update:** We use `collection.updateOne()` with atomic operators like `$set`, `$inc`, `$addToSet`, and `$pull`.
    *   **Example (in `togglePostLike` action):** `{ $addToSet: { "posts.$.likedBy": userId }, $inc: { "posts.$.likes": 1 } }`
-   **Delete:** We use `collection.deleteOne()` for removing documents.
    *   **Example (in `removeContentAndResolveReport` action):** `await db.collection("books").deleteOne({ _id: new ObjectId(contentId) });`

---

## 3. Getting Started & Best Practices

### 3.1. Environment Setup

1.  **Create a MongoDB Atlas Cluster:** Go to MongoDB Atlas, create a new project, and deploy a free-tier (M0) cluster.
2.  **Get Connection String:** From your cluster, click "Connect", select "Drivers", and copy the Node.js connection string.
3.  **Configure Firewall:** Add your local machine's IP address and `0.0.0.0/0` (to allow connections from Vercel/App Hosting) to the IP Access List in Atlas.
4.  **Create Database User:** Create a database user with read/write permissions.
5.  **Update Environment Variables:** Add the MongoDB connection string and a secure secret for `next-auth` to your `.env` file.
    ```env
    MONGODB_URI="mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority"
    NEXTAUTH_SECRET="<generate a secure random string>"
    NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
    ```

### 3.2. Performance: Database Indexing

**This is critical for a scalable application.** MongoDB does not automatically index fields. To ensure fast queries, you must manually create indexes in your MongoDB Atlas cluster for any fields you search or sort by frequently.

**Automated Database Setup:**

For convenience, we've provided an automated script to create all required indexes:

```bash
npm run setup:db
```

This script creates optimized indexes for all collections including text search indexes for the enhanced search functionality.

**Recommended Indexes Created Automatically:**

*   **`books` collection:**
    *   `type_city_created`: Compound index for filtering by type, city, and sorting by creation date
    *   `seller_created`: Index for seller's books sorted by date
    *   `genre_condition`: Compound index for filtering by genre and condition
    *   `text_search`: Text search index for title, author, and description
    *   `price_index`: Sparse index for price range filtering
*   **`users` collection:**
    *   `email_unique`: Unique index for fast login lookups
    *   `city_index`: Index for location-based features
    *   `wishlist_search`: Text search for user wishlists
*   **`communities` collection:**
    *   `creator_created`: Index for creator's communities
    *   `members_index`: Index for member searches
    *   `community_text_search`: Text search for community names and descriptions
*   **`chats` collection:**
    *   `chat_participants`: Index for participant lookups
    *   `book_chats`: Index for book-related chats

**Manual Setup (Alternative):**

If you prefer to create indexes manually in MongoDB Atlas, refer to the definitions in `src/lib/database-optimization.ts`.

### 3.3. Potential Pitfalls & Debugging

-   **`_id` vs. `id`:** Always use `_id` when interacting directly with MongoDB. Our TypeScript types correctly define `_id` as `ObjectId | string` because it is an `ObjectId` on the server but becomes a `string` when serialized and passed to the client. Always wrap string IDs with `new ObjectId(id)` before performing a server-side query.
-   **Serialization:** Server Components cannot handle complex data types like `ObjectId`. Always serialize data before returning it from a server-side function (`data.ts` or `actions.ts`) using `JSON.parse(JSON.stringify(data))`.
-   **Server-Side Auth:** When writing new Server Actions, always validate the user's session on the server by calling `getSession()` from `next-auth`. Do not trust user IDs or roles passed from the client.
-   **Embedded Documents:** We embed posts within communities and messages within chats. This is efficient for reads but be mindful that MongoDB documents have a 16MB size limit. For a larger-scale application, you might refactor these to be in their own collections with reference IDs.

This guide provides a solid foundation for maintaining and extending the BookEx application. Welcome to the team!
