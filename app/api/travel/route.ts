import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's public ID
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { destinationHex } = await request.json();

    if (!destinationHex || typeof destinationHex !== "string") {
      return NextResponse.json(
        { error: "Destination hex is required" },
        { status: 400 }
      );
    }

    // Call the travel function
    const { data: travelResult, error: travelError } = await supabase.rpc(
      "travel_to_hex",
      {
        p_user_id: profile.id,
        p_destination_hex: destinationHex,
      }
    );

    if (travelError) {
      console.error("Travel error:", travelError);
      return NextResponse.json(
        { error: "Failed to travel", details: travelError.message },
        { status: 500 }
      );
    }

    if (!travelResult.success) {
      return NextResponse.json(
        { error: travelResult.error || "Travel failed", ...travelResult },
        { status: 400 }
      );
    }

    return NextResponse.json(travelResult);
  } catch (error) {
    console.error("Travel API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch user's current location or all travel destinations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "location";

    // If fetching all destinations for the search dropdown
    if (type === "destinations") {
      const supabase = await createSupabaseServerClient();

      // Call the RPC function to get all travel destinations (no auth required)
      const { data: destinations, error: destinationsError } = await supabase.rpc(
        "get_travel_destinations"
      );

      if (destinationsError) {
        console.error("Destinations fetch error:", destinationsError);
        return NextResponse.json(
          { error: "Failed to fetch destinations", details: destinationsError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(destinations);
    }

    // Otherwise fetch user's current location (requires auth)
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's public ID
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user location
    const { data: locationData, error: locationError } = await supabase.rpc(
      "get_user_location",
      {
        p_user_id: profile.id,
      }
    );

    if (locationError) {
      console.error("Location fetch error:", locationError);
      return NextResponse.json(
        { error: "Failed to fetch location" },
        { status: 500 }
      );
    }

    return NextResponse.json(locationData);
  } catch (error) {
    console.error("Travel API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
