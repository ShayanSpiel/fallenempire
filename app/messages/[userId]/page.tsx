import React from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MessageThreadUnified } from "@/components/messages/message-thread-unified";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Direct Message",
  description: "Direct message conversation.",
  robots: { index: false, follow: false },
};

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch current user profile
  const { data: currentProfile } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!currentProfile) {
    redirect("/");
  }

  // Fetch other user profile
  const { data: otherProfile } = await supabase
    .from("users")
    .select("id, username, avatar_url, is_bot")
    .eq("id", userId)
    .maybeSingle();

  if (!otherProfile) {
    redirect("/messages");
  }

  // Fetch message history between the two users
  const { data: messagesData } = await supabase
    .from("direct_messages")
    .select(`
      id,
      sender_id,
      recipient_id,
      content,
      created_at,
      sender:sender_id(id, username, avatar_url)
    `)
    .or(`and(sender_id.eq.${currentProfile.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${currentProfile.id})`)
    .order("created_at", { ascending: true })
    .limit(50);

  // Determine thread type based on is_bot flag
  const threadType = otherProfile.is_bot ? "ai" : "1to1";

  // Format messages to match ThreadMessage type
  const messages = (messagesData || []).map((msg: any) => ({
    id: msg.id,
    sender_id: msg.sender_id,
    recipient_id: msg.recipient_id,
    content: msg.content,
    created_at: msg.created_at,
    sender: msg.sender,
  }));

  return (
    <MessageThreadUnified
      currentUserId={currentProfile.id}
      currentUsername={currentProfile.username}
      currentAvatarUrl={currentProfile.avatar_url}
      threadType={threadType}
      threadId={otherProfile.id}
      participants={[
        {
          id: currentProfile.id,
          username: currentProfile.username,
          avatar_url: currentProfile.avatar_url,
        },
        {
          id: otherProfile.id,
          username: otherProfile.username,
          avatar_url: otherProfile.avatar_url,
          is_bot: otherProfile.is_bot,
        },
      ]}
      initialMessages={messages}
    />
  );
}
