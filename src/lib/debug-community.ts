/**
 * Debug script to check community loading issues
 */

import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';

export async function debugCommunity(communityId: string) {
  try {
    console.log('🔍 Debugging community:', communityId);
    
    // Check if ObjectId is valid
    const isValid = ObjectId.isValid(communityId);
    console.log('✅ ObjectId valid:', isValid);
    
    if (!isValid) {
      return { error: 'Invalid ObjectId format' };
    }
    
    const client = await clientPromise;
    const db = client.db('bookex');
    
    // Check if community exists
    const community = await db.collection('communities').findOne(
      { _id: new ObjectId(communityId) }
    );
    
    console.log('📊 Community found:', !!community);
    
    if (community) {
      console.log('📋 Community data:', {
        _id: community._id,
        name: community.name,
        members: community.members?.length || 0,
        channels: community.channels?.length || 0,
        createdBy: community.createdBy
      });
    }
    
    // Check posts
    const posts = await db.collection('posts').find(
      { communityId: new ObjectId(communityId) }
    ).toArray();
    
    console.log('📝 Posts found:', posts.length);
    
    return {
      community,
      postsCount: posts.length,
      isValid
    };
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
