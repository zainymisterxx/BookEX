import { connectToMongoDB } from './mongodb';
import { ObjectId } from 'mongodb';

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: string;
  communities: string[];
}

class PresenceManager {
  private onlineUsers = new Map<string, UserPresence>();
  private userCommunities = new Map<string, Set<string>>();

  async setUserOnline(userId: string, communityId?: string): Promise<void> {
    const now = new Date().toISOString();
    
    // Get user's communities if not provided
    let communities: string[] = [];
    if (communityId) {
      communities = [communityId];
    } else {
      communities = await this.getUserCommunities(userId);
    }

    const presence: UserPresence = {
      userId,
      isOnline: true,
      lastSeen: now,
      communities
    };

    this.onlineUsers.set(userId, presence);
    
    // Update user communities mapping
    communities.forEach(communityId => {
      if (!this.userCommunities.has(communityId)) {
        this.userCommunities.set(communityId, new Set());
      }
      this.userCommunities.get(communityId)!.add(userId);
    });

    console.log(`User ${userId} is now online in communities:`, communities);
  }

  async setUserOffline(userId: string): Promise<void> {
    const presence = this.onlineUsers.get(userId);
    if (presence) {
      presence.isOnline = false;
      presence.lastSeen = new Date().toISOString();
      
      // Remove from all community mappings
      presence.communities.forEach(communityId => {
        const communityUsers = this.userCommunities.get(communityId);
        if (communityUsers) {
          communityUsers.delete(userId);
        }
      });
    }

    console.log(`User ${userId} is now offline`);
  }

  isUserOnline(userId: string): boolean {
    const presence = this.onlineUsers.get(userId);
    return presence?.isOnline || false;
  }

  getOnlineUsersInCommunity(communityId: string): string[] {
    const communityUsers = this.userCommunities.get(communityId);
    return communityUsers ? Array.from(communityUsers) : [];
  }

  getUserPresence(userId: string): UserPresence | null {
    return this.onlineUsers.get(userId) || null;
  }

  getCommunityPresence(communityId: string): UserPresence[] {
    const onlineUserIds = this.getOnlineUsersInCommunity(communityId);
    return onlineUserIds.map(userId => this.getUserPresence(userId)).filter(Boolean) as UserPresence[];
  }

  private async getUserCommunities(userId: string): Promise<string[]> {
    try {
      const { db } = await connectToMongoDB();
      const communities = await db.collection('communities').find({
        'members.userId': userId
      }, {
        projection: { _id: 1 }
      }).toArray();

      return communities.map(community => community._id.toString());
    } catch (error) {
      console.error('Error fetching user communities:', error);
      return [];
    }
  }

  // Clean up old offline users (run periodically)
  cleanupOfflineUsers(): void {
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    
    for (const [userId, presence] of this.onlineUsers.entries()) {
      if (!presence.isOnline && new Date(presence.lastSeen) < cutoffTime) {
        this.onlineUsers.delete(userId);
        
        // Remove from community mappings
        presence.communities.forEach(communityId => {
          const communityUsers = this.userCommunities.get(communityId);
          if (communityUsers) {
            communityUsers.delete(userId);
          }
        });
      }
    }
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();

// Cleanup task - run every 5 minutes
setInterval(() => {
  presenceManager.cleanupOfflineUsers();
}, 5 * 60 * 1000);
