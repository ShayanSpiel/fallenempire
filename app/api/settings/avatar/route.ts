import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateUserRowWithAvailableColumns } from "@/lib/user-profile";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      avatar_style, avatar_background_color, avatar_hair, avatar_eyes, avatar_mouth, avatar_nose,
      avatar_base_color, avatar_hair_color, avatar_eyebrows, avatar_eye_shadow_color,
      avatar_facial_hair, avatar_ears, avatar_earrings, avatar_earring_color,
      avatar_glasses, avatar_glasses_color, avatar_shirt, avatar_shirt_color
    } = body;

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const avatarPayload = {
      avatar_style,
      avatar_background_color,
      avatar_hair,
      avatar_hair_color,
      avatar_base_color,
      avatar_eyebrows,
      avatar_eyes,
      avatar_eye_shadow_color,
      avatar_mouth,
      avatar_nose,
      avatar_facial_hair,
      avatar_ears,
      avatar_earrings,
      avatar_earring_color,
      avatar_glasses,
      avatar_glasses_color,
      avatar_shirt,
      avatar_shirt_color,
    };

    const updateError = await updateUserRowWithAvailableColumns(
      supabase,
      profile.id,
      avatarPayload
    );

    if (updateError) {
      console.error("Avatar update error:", updateError);
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
