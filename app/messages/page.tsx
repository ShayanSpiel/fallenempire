import React from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { MessagesPageUnified } from "@/components/messages/messages-page-unified";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages",
  description: "Your direct messages and group chats.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/messages" },
};

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/");
  }

  // Fetch recent 1-to-1 conversations with message preview
  const { data: dmConversations } = await supabase
    .from("direct_messages")
    .select(`
      id,
      sender_id,
      recipient_id,
      content,
      created_at,
      sender:sender_id(id, username, avatar_url, is_bot),
      recipient:recipient_id(id, username, avatar_url, is_bot)
    `)
    .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

  // Group 1-to-1 conversations by other user and get latest message
  const dmConversationMap = new Map<string, any>();

  if (dmConversations) {
    dmConversations.forEach((msg: any) => {
      const otherUserId = msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === profile.id ? msg.recipient : msg.sender;
      const key = otherUserId;

      if (!dmConversationMap.has(key) && otherUser) {
        dmConversationMap.set(key, msg);
      }
    });
  }

  const dmConvList = Array.from(dmConversationMap.values()).map((msg: any) => {
    const otherUser = msg.sender_id === profile.id ? msg.recipient : msg.sender;
    const isAiChat = otherUser?.is_bot === true;
    return {
      userId: msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id,
      username: otherUser?.username,
      avatar_url: otherUser?.avatar_url,
      lastMessage: msg.content,
      lastMessageTime: msg.created_at,
      isFromYou: msg.sender_id === profile.id,
      type: isAiChat ? ("ai" as const) : ("1to1" as const),
    };
  });

  // Fetch group conversations
  let groupConvList: {
    groupId: string;
    name: string;
    lastMessage: string;
    lastMessageTime: string;
    isFromYou: boolean;
    type: "group";
    participantCount: number;
  }[] = [];

  const { data: groupSummaries, error: groupSummariesError } = await supabase.rpc(
    "get_user_group_conversation_summaries",
    { p_user_id: profile.id }
  );

  if (!groupSummariesError && groupSummaries) {
    groupConvList = groupSummaries.map((row: any) => ({
      groupId: row.group_id,
      name: row.name,
      lastMessage: row.last_message_content || "No messages yet",
      lastMessageTime: row.last_message_at || row.updated_at,
      isFromYou: row.last_message_user_id === profile.id,
      type: "group" as const,
      participantCount: row.participant_count || 0,
    }));
  } else {
    const { data: groupParticipations } = await supabase
      .from("group_conversation_participants")
      .select(
        `
        group_conversation_id,
        group_conversations:group_conversation_id(
          id, name, created_at, updated_at
        )
      `
      )
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false, foreignTable: "group_conversations" });

    groupConvList = await Promise.all(
      (groupParticipations || []).map(async (participation: any) => {
        const groupId = participation.group_conversation_id;
        const { data: messages } = await supabase
          .from("group_messages")
          .select(
            `
            id, user_id, content, created_at,
            users:user_id(id, username)
          `
          )
          .eq("group_conversation_id", groupId)
          .order("created_at", { ascending: false })
          .limit(1);

        const latestMsg = messages?.[0];
        const { data: participantCount } = await supabase
          .from("group_conversation_participants")
          .select("id", { count: "exact" })
          .eq("group_conversation_id", groupId);

        return {
          groupId,
          name: participation.group_conversations.name,
          lastMessage: latestMsg?.content || "No messages yet",
          lastMessageTime: latestMsg?.created_at || participation.group_conversations.updated_at,
          isFromYou: latestMsg?.user_id === profile.id,
          type: "group" as const,
          participantCount: participantCount?.length || 0,
        };
      })
    );
  }

  // Combine and sort by last message time
  const allConversations = [
    ...dmConvList,
    ...groupConvList,
  ].sort((a, b) => {
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  return (
    <MessagesPageUnified
      currentUserId={profile.id}
      currentUsername={profile.username}
      currentAvatarUrl={profile.avatar_url}
      conversations={allConversations}
    />
  );
}
