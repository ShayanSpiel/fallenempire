import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (has admin role)
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (adminError || !adminCheck || adminCheck.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Get AI DM setting
    if (action === "getAiDms") {
      const { data: settings } = await supabase
        .from("admin_settings")
        .select("ai_dms_enabled")
        .maybeSingle();

      return NextResponse.json(
        { enabled: settings?.ai_dms_enabled !== false },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (adminError || !adminCheck || adminCheck.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { action, ...payload } = await request.json();

    // Set AI DM setting
    if (action === "setAiDms") {
      const { enabled } = payload;

      // Get or create settings record
      const { data: existingSettings } = await supabase
        .from("admin_settings")
        .select("id")
        .maybeSingle();

      if (existingSettings) {
        // Update existing
        const { error } = await supabase
          .from("admin_settings")
          .update({ ai_dms_enabled: enabled })
          .eq("id", existingSettings.id);

        if (error) {
          console.error("Failed to update settings:", error);
          return NextResponse.json(
            { error: "Failed to update setting" },
            { status: 500 }
          );
        }
      } else {
        // Create new
        const { error } = await supabase
          .from("admin_settings")
          .insert({ ai_dms_enabled: enabled });

        if (error) {
          console.error("Failed to create settings:", error);
          return NextResponse.json(
            { error: "Failed to create setting" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json(
        { success: true, enabled },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/admin/settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
