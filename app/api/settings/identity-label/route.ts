import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { identity_label } = body;

    // Validate that the label is not empty and is a reasonable length
    if (!identity_label || typeof identity_label !== 'string') {
      return NextResponse.json({ error: "Identity label is required" }, { status: 400 });
    }

    const trimmedLabel = identity_label.trim();

    if (trimmedLabel.length === 0) {
      return NextResponse.json({ error: "Identity label cannot be empty" }, { status: 400 });
    }

    if (trimmedLabel.length > 50) {
      return NextResponse.json({ error: "Identity label too long (max 50 characters)" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("users")
      .update({ identity_label: trimmedLabel })
      .eq("id", profile.id);

    if (error) {
      return NextResponse.json({ error: "Failed to update identity label" }, { status: 400 });
    }

    return NextResponse.json({ success: true, identity_label: trimmedLabel });
  } catch (error) {
    console.error("Identity label update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
