/**
 * Test script to verify community fixes
 * This script tests the community membership and chat functionality
 */

import clientPromise from './mongodb';
import { isMember, getMemberInfo } from './community-permissions';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class CommunityFixTester {
  private results: TestResult[] = [];

  private addResult(test: string, passed: boolean, message: string, details?: any) {
    this.results.push({ test, passed, message, details });
    console.log(`${passed ? '✅' : '❌'} ${test}: ${message}`);
  }

  async testCommunityCreation() {
    console.log('\n🧪 Testing Community Creation...');
    
    try {
      const client = await clientPromise;
      const db = client.db('bookex');
      
      // Find a recently created community
      const recentCommunity = await db.collection('communities').findOne(
        { channels: { $exists: true, $ne: [] } },
        { sort: { createdAt: -1 } }
      );
      
      if (recentCommunity) {
        const hasChannels = recentCommunity.channels && recentCommunity.channels.length > 0;
        const hasDefaultChannels = recentCommunity.channels?.some((c: any) => 
          c.name === 'General' || c.name === 'Chat'
        );
        
        this.addResult(
          'Community has channels',
          hasChannels,
          hasChannels ? 'Community has channels array' : 'Community missing channels',
          { channelCount: recentCommunity.channels?.length || 0 }
        );
        
        this.addResult(
          'Community has default channels',
          hasDefaultChannels,
          hasDefaultChannels ? 'Community has default General/Chat channels' : 'Community missing default channels',
          { channels: recentCommunity.channels }
        );
      } else {
        this.addResult(
          'Community creation test',
          false,
          'No communities found to test'
        );
      }
    } catch (error) {
      this.addResult(
        'Community creation test',
        false,
        'Error testing community creation',
        error
      );
    }
  }

  async testMembershipChecks() {
    console.log('\n🧪 Testing Membership Checks...');
    
    try {
      const client = await clientPromise;
      const db = client.db('bookex');
      
      // Get a community with members
      const community = await db.collection('communities').findOne({
        'members.0': { $exists: true }
      });
      
      if (community) {
        const member = community.members[0];
        const isMemberResult = isMember(member.userId, community as any);
        
        this.addResult(
          'isMember function works',
          isMemberResult,
          isMemberResult ? 'User correctly identified as member' : 'User not identified as member',
          { userId: member.userId, role: member.role }
        );
        
        // Test with non-member
        const nonMemberResult = isMember('nonexistent-user-id', community as any);
        this.addResult(
          'isMember function rejects non-members',
          !nonMemberResult,
          !nonMemberResult ? 'Non-member correctly rejected' : 'Non-member incorrectly accepted'
        );
        
        // Test member info retrieval
        const memberInfo = getMemberInfo(member.userId, community as any);
        this.addResult(
          'getMemberInfo function works',
          memberInfo !== null,
          memberInfo ? 'Member info retrieved successfully' : 'Failed to retrieve member info',
          memberInfo
        );
      } else {
        this.addResult(
          'Membership check test',
          false,
          'No communities with members found to test'
        );
      }
    } catch (error) {
      this.addResult(
        'Membership check test',
        false,
        'Error testing membership checks',
        error
      );
    }
  }

  async testChannelStructure() {
    console.log('\n🧪 Testing Channel Structure...');
    
    try {
      const client = await clientPromise;
      const db = client.db('bookex');
      
      const communities = await db.collection('communities').find({
        channels: { $exists: true, $ne: [] }
      }).toArray();
      
      if (communities.length > 0) {
        const community = communities[0];
        const channels = community.channels || [];
        
        this.addResult(
          'Community has channels',
          channels.length > 0,
          `Community has ${channels.length} channels`,
          { channelCount: channels.length }
        );
        
        // Check channel structure
        const validChannels = channels.every((c: any) => 
          c._id && c.name && c.type && ['forum', 'chat'].includes(c.type)
        );
        
        this.addResult(
          'Channels have valid structure',
          validChannels,
          validChannels ? 'All channels have required fields' : 'Some channels missing required fields',
          { channels }
        );
        
        // Check for default channels
        const hasForumChannel = channels.some((c: any) => c.type === 'forum');
        const hasChatChannel = channels.some((c: any) => c.type === 'chat');
        
        this.addResult(
          'Has forum channel',
          hasForumChannel,
          hasForumChannel ? 'Community has forum channel' : 'Community missing forum channel'
        );
        
        this.addResult(
          'Has chat channel',
          hasChatChannel,
          hasChatChannel ? 'Community has chat channel' : 'Community missing chat channel'
        );
      } else {
        this.addResult(
          'Channel structure test',
          false,
          'No communities with channels found to test'
        );
      }
    } catch (error) {
      this.addResult(
        'Channel structure test',
        false,
        'Error testing channel structure',
        error
      );
    }
  }

  async testDatabaseConsistency() {
    console.log('\n🧪 Testing Database Consistency...');
    
    try {
      const client = await clientPromise;
      const db = client.db('bookex');
      
      // Check for communities with old member format
      const oldFormatCommunities = await db.collection('communities').find({
        'members.0': { $type: 'string' }
      }).toArray();
      
      this.addResult(
        'No old member format',
        oldFormatCommunities.length === 0,
        oldFormatCommunities.length === 0 ? 'All communities use new member format' : `${oldFormatCommunities.length} communities still use old member format`,
        { oldFormatCount: oldFormatCommunities.length }
      );
      
      // Check for communities without channels
      const communitiesWithoutChannels = await db.collection('communities').find({
        $or: [
          { channels: { $exists: false } },
          { channels: { $size: 0 } }
        ]
      }).toArray();
      
      this.addResult(
        'All communities have channels',
        communitiesWithoutChannels.length === 0,
        communitiesWithoutChannels.length === 0 ? 'All communities have channels' : `${communitiesWithoutChannels.length} communities missing channels`,
        { missingChannelsCount: communitiesWithoutChannels.length }
      );
      
    } catch (error) {
      this.addResult(
        'Database consistency test',
        false,
        'Error testing database consistency',
        error
      );
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Community Fix Tests...\n');
    
    await this.testCommunityCreation();
    await this.testMembershipChecks();
    await this.testChannelStructure();
    await this.testDatabaseConsistency();
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (total - passed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
    
    console.log('\n✅ All tests completed!');
  }

  getResults() {
    return this.results;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new CommunityFixTester();
  tester.runAllTests().catch(console.error);
}
