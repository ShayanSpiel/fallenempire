import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateSlug, isColumnMissingError } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient({ canSetCookies: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    const name = String(payload?.name ?? "").trim();
    const description = String(payload?.description ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const slug = generateSlug(name);

    const { data: existing, error: slugCheckError } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugCheckError && !isColumnMissingError(slugCheckError, "slug")) {
      throw slugCheckError;
    }

    if (existing) {
      return NextResponse.json({ error: "Community name taken" }, { status: 409 });
    }

    const insertPayload = {
      name,
      description,
      owner_id: profile.id,
      members_count: 1,
    };

    const insertWithSlug = async (includeSlug: boolean) => {
      const payload = {
        ...insertPayload,
        ...(includeSlug ? { slug } : {}),
      };
      const selectFields = includeSlug
        ? "id, name, slug, description, created_at"
        : "id, name, description, created_at";
      return supabaseAdmin.from("communities").insert(payload).select(selectFields).single();
    };

    let insertResult = await insertWithSlug(true);

    if (isColumnMissingError(insertResult.error, "slug")) {
      insertResult = await insertWithSlug(false);
    }

    if (insertResult.error || !insertResult.data) {
      throw insertResult.error ?? new Error("Failed to create community");
    }

    const community = (insertResult.data as unknown) as {
      id: string;
      slug?: string | null;
      name: string;
      description: string | null;
      created_at: string;
    };

    const { error: rosterError } = await supabaseAdmin.from("community_members").insert({
      community_id: community.id,
      user_id: profile.id,
      role: "founder",
      rank_tier: 0, // Creator is sovereign (rank 0) in the governance system
    });

    if (rosterError) {
      console.error("Failed to seed community roster", rosterError);
    }

    console.log(
      `[Community] Created: ${community.name} (${community.slug ?? community.id})`
    );

    return NextResponse.json({
      ...community,
      slug: community.slug ?? community.id,
    });
  } catch (error) {
    console.error("[Community Create Error]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
