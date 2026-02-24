import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    const { communityId, hexId, regionName } = payload ?? {};

    if (!communityId || !hexId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify user is founder of the community
    const { data: memberRole } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", communityId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!memberRole || memberRole.role !== "founder") {
      return NextResponse.json({ error: "Only founders can rename regions" }, { status: 403 });
    }

    // Verify the region is owned by the community
    const { data: region, error: regionError } = await supabase
      .from("world_regions")
      .select("hex_id, owner_community_id")
      .eq("hex_id", hexId)
      .eq("owner_community_id", communityId)
      .maybeSingle();

    if (regionError || !region) {
      return NextResponse.json({ error: "Region not found or not owned by community" }, { status: 404 });
    }

    // Sanitize region name (trim and limit length)
    const sanitizedName = String(regionName ?? "").trim().slice(0, 100);

    // Update custom region name (allow NULL to reset to default province name)
    const { error: updateError } = await supabaseAdmin
      .from("world_regions")
      .update({ custom_name: sanitizedName || null } as Record<string, any>)
      .eq("hex_id", hexId);

    if (updateError) {
      if (updateError.message?.includes("custom_name")) {
        return NextResponse.json(
          { error: "Feature not yet available. Please wait for the migration to complete." },
          { status: 503 }
        );
      }
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      hexId,
      regionName: sanitizedName || null,
    });
  } catch (error) {
    console.error("[Region Update Error]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
