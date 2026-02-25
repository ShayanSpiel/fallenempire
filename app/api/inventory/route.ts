import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from auth_id
    const { data: userProfile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the resource type from query params
    const resourceType = request.nextUrl.searchParams.get("type");
    if (!resourceType) {
      return NextResponse.json(
        { error: "Resource type parameter required" },
        { status: 400 }
      );
    }

    // Get resource ID from resource key
    const { data: resource } = await supabase
      .from("resources")
      .select("id")
      .eq("key", resourceType)
      .single();

    if (!resource) {
      return NextResponse.json(
        { error: `Resource "${resourceType}" not found` },
        { status: 404 }
      );
    }

    // Get total quantity of this resource across all quality tiers
    const { data: inventory } = await supabase
      .from("user_inventory")
      .select("quantity")
      .eq("user_id", userProfile.id)
      .eq("resource_id", resource.id);

    const totalQuantity =
      inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return NextResponse.json({
      resource_type: resourceType,
      quantity: totalQuantity,
      resource_id: resource.id,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
