import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const searchParams = request.nextUrl.searchParams;
  const communityId = searchParams.get('communityId');
  const q = searchParams.get('q') || '';

  if (!communityId) {
    return NextResponse.json({ error: 'Community ID required' }, { status: 400 });
  }

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to get the profile user ID
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify user is member of community
    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('user_id', profile.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a community member' }, { status: 403 });
    }

    // Search for community members
    const { data: members, error } = await supabase
      .from('community_members')
      .select(
        `
        user_id,
        rank_tier,
        users:user_id (
          id,
          username,
          avatar_url,
          identity_label
        )
      `,
      )
      .eq('community_id', communityId)
      .neq('user_id', profile.id) // Exclude self
      .limit(6);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Filter by query
    let results = members || [];
    if (q) {
      const lowerQ = q.toLowerCase();
      results = results.filter(
        (m) =>
          (m.users as any)?.username?.toLowerCase().includes(lowerQ) ||
          (m.users as any)?.identity_label?.toLowerCase().includes(lowerQ),
      );
    }

    // Map to response format
    const response = results.map((m) => {
      const userData = m.users as any;
      return {
        id: m.user_id,
        username: userData?.username || 'Unknown',
        avatar_url: userData?.avatar_url || null,
        rank_tier: m.rank_tier,
        identity_label: userData?.identity_label || null,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
