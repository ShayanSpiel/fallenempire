import React from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MessageThreadUnified } from "@/components/messages/message-thread-unified";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Group Chat",
  description: "Group message conversation.",
  robots: { index: false, follow: false },
};

export default async function GroupChatPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
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

  const { data: group } = await supabase
    .from("group_conversations")
    .select("id, name, description, created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) {
    redirect("/messages");
  }

  // Verify user is member of group or creator
  if (group.created_by !== currentProfile.id) {
    const { data: membership } = await supabase
      .from("group_conversation_participants")
      .select("id")
      .eq("group_conversation_id", groupId)
      .eq("user_id", currentProfile.id)
      .maybeSingle();

    if (!membership) {
      redirect("/messages");
    }
  }

  // Fetch group participants
  const { data: participantsData } = await supabase
    .from("group_conversation_participants")
    .select(`
      user_id, role,
      users:user_id(id, username, avatar_url, is_bot)
    `)
    .eq("group_conversation_id", groupId);

  const participants = (participantsData || []).map((p: any) => ({
    id: p.users.id,
    username: p.users.username,
    avatar_url: p.users.avatar_url,
    is_bot: p.users.is_bot,
    role: p.role,
  }));

  // Fetch message history for group
  const { data: messages } = await supabase
    .from("group_messages")
    .select(`
      id,
      user_id,
      group_conversation_id,
      content,
      created_at,
      users:user_id(id, username, avatar_url)
    `)
    .eq("group_conversation_id", groupId)
    .order("created_at", { ascending: true })
    .limit(50);

  // Map messages to thread format
  const formattedMessages = (messages || []).map((msg: any) => ({
    id: msg.id,
    sender_id: msg.user_id,
    group_conversation_id: msg.group_conversation_id,
    content: msg.content,
    created_at: msg.created_at,
    sender: {
      id: msg.users.id,
      username: msg.users.username,
      avatar_url: msg.users.avatar_url,
    },
  }));

  return (
    <MessageThreadUnified
      currentUserId={currentProfile.id}
      currentUsername={currentProfile.username}
      currentAvatarUrl={currentProfile.avatar_url}
      threadType="group"
      threadId={groupId}
      participants={participants}
      initialMessages={formattedMessages}
      threadName={group.name}
    />
  );
}
