# Chat System Implementation Guide

## Overview

This document covers the complete implementation of a scalable, performance-optimized Direct Message (DM) and Community Chat system with AI-first capabilities.

## Architecture

### Components

#### 1. **Direct Messages System**
- **Page**: `/app/messages/page.tsx` - Messages list view
- **Page**: `/app/messages/[userId]/page.tsx` - Individual chat thread
- **Client Component**: `/components/messages/messages-list-client.tsx` - Conversation list UI
- **Client Component**: `/components/messages/message-thread-client.tsx` - Chat window UI
- **API Route**: `/app/api/messages/route.ts` - Message CRUD operations

#### 2. **Community Chat System**
- **Component**: `/components/community/community-chat.tsx` - Refactored with design tokens
- **Location**: Integrated into `/app/community/[slug]/page.tsx`
- **API Route**: `/app/api/community/chat/route.ts` - (existing, unchanged)

#### 3. **Real-time Messaging**
- **Client Socket.IO**: `/lib/socketio.ts`
- **Server Socket.IO**: `/lib/socketio-server.ts`
- **Features**:
  - Real-time message delivery
  - Typing indicators
  - User presence
  - Community member count updates

#### 4. **AI Integration**
- **AI Module**: `/lib/ai-integration.ts`
- **API Route**: `/app/api/chat/ai/route.ts`
- **Features**:
  - AI responses in both DM and community chats
  - AI commands (`/summarize`, `/analyze`, `/brainstorm`)
  - Conversation history support
  - Multiple provider support (Gemini, OpenAI, Claude)

#### 5. **Database**
- **Migration**: `/supabase/migrations/20250101_create_direct_messages.sql`
- **Tables**:
  - `direct_messages` - DM message storage
  - `community_messages` - (existing)

### Design System Integration

All UI components use design tokens from `/lib/design-system.ts`:
- **Spacing**: `spacing.xs` to `spacing.3xl`
- **Typography**: `typography.displayLg` to `typography.meta`
- **Colors**: `semanticColors` for consistent theming
- **Borders**: `borders.default`, `borders.subtle`, `borders.muted`
- **Transitions**: `transitions.fast`, `transitions.normal`, `transitions.slow`
- **Components**: `cardStyles`, `badgeStyles`, `formStyles`

**Zero hardcoded colors or pixel values** - everything uses design tokens.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client ai
```

### 2. Environment Variables

Add to `.env.local`:

```env
# Socket.IO
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# AI Integration
AI_PROVIDER=gemini  # or openai, anthropic
AI_MODEL=gemini-1.5-pro
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

AI_SYSTEM_PROMPT="You are a helpful AI assistant in eIntelligence..."
```

### 3. Database Migration

Run the Supabase migration:

```bash
npx supabase migration up
```

Or manually run the SQL from `/supabase/migrations/20250101_create_direct_messages.sql` in Supabase dashboard.

### 4. Socket.IO Server Setup

In your Next.js server (e.g., in a custom server file or API middleware):

```typescript
import { createSocketIOServer } from "@/lib/socketio-server";
import { createServer } from "http";

const httpServer = createServer();
const io = createSocketIOServer(httpServer);

httpServer.listen(3000);
```

## Features

### Direct Messages

✅ **Implemented**:
- Send/receive messages between users
- Real-time message delivery via Supabase subscriptions
- Conversation list with last message preview
- Search conversations by username
- Message timestamps and formatting
- Optimistic updates for instant feedback
- Responsive UI on mobile/tablet
- Design system compliance (no hardcoding)

🔄 **Socket.IO Integration** (Ready to implement):
- Replace Supabase subscriptions with Socket.IO for better performance
- Real-time typing indicators
- Read receipts
- User online/offline status

⚡ **AI Features** (Ready to implement):
- Message AI assistant in DMs
- Summarization of conversations
- Smart replies
- Context-aware responses

### Community Chat

✅ **Implemented**:
- Send/receive messages in community
- Role-based badges (Founder, Leader, Member)
- Commands system (`/kick`, `/mute`)
- Two panels: Chat & Command Center
- Rank caching for performance
- Message history loading
- Optimistic message updates
- Design system refactoring (converted to use design tokens)

🔄 **Enhancements**:
- Socket.IO real-time optimization
- AI command responses
- Message pinning/favorites
- Reactions/emojis

### AI Interactions

✅ **Implemented**:
- AI response API endpoint
- AI command parsing (`/ai`, `/summarize`, `/analyze`, `/brainstorm`)
- Conversation history support
- Multi-provider support

🔄 **Integration Points**:
- Wire up AI responses in community chat
- Wire up AI responses in DMs
- Add typing indicator for AI processing
- Store AI-generated messages in database

## Usage Examples

### Sending a Direct Message

```typescript
// Client side
const response = await fetch("/api/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    recipientId: "user-id",
    content: "Hello!",
  }),
});
```

### Requesting AI Response

```typescript
const response = await fetch("/api/chat/ai", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "What are the benefits of direct democracy?",
    conversationHistory: [], // optional
  }),
});

const data = await response.json();
console.log(data.response);
```

### Socket.IO Events

```typescript
import { initializeSocket, joinDMRoom, emitDMMessage } from "@/lib/socketio";

const socket = initializeSocket();

// Join a DM room
socket.emit("dm:join", { userId: "current-user-id" });

// Send a message
socket.emit("dm:send", {
  recipientId: "other-user-id",
  message: "Hello!",
});

// Listen for messages
socket.on("dm:received", (data) => {
  console.log("New message:", data.message);
});
```

## Performance Considerations

### Message Loading
- Initial messages limited to **50** for DMs and community chats
- Pagination support ready (add `offset` parameter)
- Indexes on `sender_id`, `recipient_id`, `created_at`

### Caching
- Member rank caching in community chat (reduces DB queries)
- Avatar seed-based generation (no extra requests)

### Real-time Performance
- Optimistic updates for instant UI feedback
- Debounced subscription updates
- Socket.IO with websocket + polling fallback
- Room-based broadcasting for efficiency

### Database RLS
- Row-level security on all message tables
- Users can only see their own messages
- Enforced at database layer for security

## Design System Compliance

All UI components follow the design system with **zero hardcoded values**:

✅ **Spacing**: Using `spacing.xs` through `spacing.3xl`
✅ **Typography**: Using semantic tokens like `typography.headingMd`, `typography.bodySm`
✅ **Colors**: Using `semanticColors` for all text/backgrounds
✅ **Borders**: Using `borders.default`, `borders.subtle`
✅ **Transitions**: Using `transitions.fast`, `transitions.normal`
✅ **Component styles**: Using `cardStyles`, `badgeStyles`, `formStyles`

## File Structure

```
app/
├── api/
│   ├── chat/ai/route.ts (NEW)
│   ├── community/chat/route.ts (existing)
│   └── messages/route.ts (NEW)
├── messages/ (NEW)
│   ├── page.tsx (NEW)
│   └── [userId]/page.tsx (NEW)
└── community/[slug]/page.tsx (existing)

components/
├── community/
│   └── community-chat.tsx (UPDATED - design tokens)
└── messages/ (NEW)
    ├── messages-list-client.tsx (NEW)
    └── message-thread-client.tsx (NEW)

lib/
├── ai-integration.ts (NEW)
├── design-system.ts (existing)
├── socketio.ts (NEW)
└── socketio-server.ts (NEW)

supabase/migrations/
└── 20250101_create_direct_messages.sql (NEW)
```

## Testing Checklist

- [ ] Create account and access `/messages` page
- [ ] Send DM to another user
- [ ] Receive DM in real-time
- [ ] Search conversations
- [ ] Visit community chat
- [ ] Send community message
- [ ] Verify design system styling (no hardcoded colors)
- [ ] Test responsive design on mobile
- [ ] Test AI response endpoint
- [ ] Test with/without network (offline handling)
- [ ] Verify RLS policies work correctly
- [ ] Load test with many messages
- [ ] Test Socket.IO connection fallback

## Next Steps

1. **Install dependencies**: `npm install socket.io socket.io-client ai`
2. **Run database migration**: Apply SQL to Supabase
3. **Set environment variables**: Add API keys and Socket.IO URL
4. **Test DM system**: Send messages between users
5. **Integrate Socket.IO**: Replace Supabase subscriptions
6. **Wire AI responses**: Connect AI to both chat systems
7. **Add typing indicators**: Implement with Socket.IO events
8. **Performance optimization**: Monitor and optimize database queries
9. **User testing**: Gather feedback and iterate

## Support & Troubleshooting

### Messages not sending
- Check API route at `/api/messages`
- Verify authentication (user must be logged in)
- Check Supabase RLS policies

### Real-time not working
- Ensure Socket.IO server is running
- Check `NEXT_PUBLIC_SOCKET_URL` environment variable
- Verify websocket connection in browser DevTools

### AI responses not working
- Check API key for chosen provider (Gemini, OpenAI, etc)
- Verify `AI_PROVIDER` and `AI_MODEL` env vars
- Check `/api/chat/ai` endpoint logs

### Design issues
- All styling should use `/lib/design-system.ts`
- Never hardcode colors or spacing
- Use `cn()` to combine design tokens
- Check Tailwind CSS is configured for custom tokens

## Architecture Decisions

1. **Supabase Realtime + Socket.IO**: Hybrid approach
   - Supabase for reliability and instant feedback
   - Socket.IO for optimized real-time features (typing, presence)

2. **Design Tokens**: Everything parameterized
   - Single source of truth for styling
   - Easy theme updates
   - Consistent across all components

3. **Optimistic Updates**: Better UX
   - Messages appear instantly
   - Rolled back on error
   - Combined with server confirmation

4. **AI as Participant**: Not special handling
   - AI treated like any other user
   - Can send/receive messages normally
   - Commands extend functionality

5. **Room-based Broadcasting**: Scalable real-time
   - Socket.IO rooms for efficient broadcasting
   - Direct messages to individual sockets
   - Community messages to room members
