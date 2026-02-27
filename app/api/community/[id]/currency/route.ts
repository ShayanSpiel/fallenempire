import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const communityId = params.id;

    if (!communityId) {
      return NextResponse.json(
        { error: 'Community ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Fetch community currency along with community color
    const { data: currency, error } = await supabase
      .from('community_currencies')
      .select(`
        id,
        currency_name,
        currency_symbol,
        exchange_rate_to_gold,
        communities:community_id(color)
      `)
      .eq('community_id', communityId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching community currency:', error);
      return NextResponse.json(
        { error: 'Failed to fetch community currency' },
        { status: 500 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: 'Community currency not found' },
        { status: 404 }
      );
    }

    // Extract community color from the relation
    const community = Array.isArray(currency.communities)
      ? currency.communities[0]
      : currency.communities;

    return NextResponse.json({
      id: currency.id,
      currency_name: currency.currency_name,
      currency_symbol: currency.currency_symbol,
      exchange_rate_to_gold: currency.exchange_rate_to_gold,
      community_color: community?.color || null,
    });
  } catch (error) {
    console.error('Error in currency API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
