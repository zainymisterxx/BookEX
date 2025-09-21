import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-config';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const client = await clientPromise;
    const db = client.db('bookex');

    const searchRegex = new RegExp(query, 'i');
    const results: any[] = [];

    // Search users
    const users = await db.collection('users')
      .find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      })
      .limit(5)
      .toArray();

    users.forEach(user => {
      results.push({
        type: 'user',
        title: user.name,
        subtitle: user.email,
        href: `/admin#users-${user._id}`
      });
    });

    // Search organizations
    const organizations = await db.collection('organizations')
      .find({
        $or: [
          { name: searchRegex },
          { location: searchRegex }
        ]
      })
      .limit(5)
      .toArray();

    organizations.forEach(org => {
      results.push({
        type: 'organization',
        title: org.name,
        subtitle: org.location,
        href: `/admin#organizations-${org._id}`
      });
    });

    // Search reports
    const reports = await db.collection('reports')
      .find({
        $or: [
          { reason: searchRegex },
          { details: searchRegex }
        ]
      })
      .limit(3)
      .toArray();

    reports.forEach(report => {
      results.push({
        type: 'report',
        title: `Report: ${report.reason}`,
        subtitle: report.details?.substring(0, 50) + '...',
        href: `/admin#reports-${report._id}`
      });
    });

    // Limit total results
    return NextResponse.json(results.slice(0, 10));

  } catch (error) {
    console.error('Admin search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
