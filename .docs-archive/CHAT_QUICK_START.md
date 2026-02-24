# Chat System Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
npm install socket.io socket.io-client ai
```

### 2. Database Setup
- Run migration: `npx supabase migration up`
- Or copy SQL from `/supabase/migrations/20250101_create_direct_messages.sql`

### 3. Environment Variables
Add to `.env.local`:
```env
# AI
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-pro
GOOGLE_GENERATIVE_AI_API_KEY=your_key
```

### 4. Test It
1. Create 2 test accounts
2. Go to `/messages` in first account
3. Click on second user to start DM
4. Send message - should appear in real-time

## 📁 File Locations

| Feature | Files |
|---------|-------|
| **Direct Messages** | `/app/messages/*`, `/components/messages/*` |
| **Community Chat** | `/components/community/community-chat.tsx` |
| **Socket.IO** | `/lib/socketio.ts`, `/lib/socketio-server.ts` |
| **AI Integration** | `/lib/ai-integration.ts`, `/app/api/chat/ai/*` |
| **Database** | `/supabase/migrations/20250101_create_direct_messages.sql` |

## 🎯 Key Components

### Messages List Page
```typescript
// /app/messages/page.tsx
- Shows all conversations
- Search by username
- Last message preview
- Timestamps
```

### Message Thread
```typescript
// /app/messages/[userId]/page.tsx
- 1-to-1 chat with user
- Real-time messages
- Design system styling
- Send/receive messages
```

### API Endpoints

```
POST /api/messages - Send DM
GET /api/messages?otherUserId=... - Fetch thread
POST /api/chat/ai - Get AI response
```

## 🎨 Design System Usage

All components use `/lib/design-system.ts`:

```typescript
// Don't do this ❌
className="bg-blue-500 text-white px-4 py-2"

// Do this ✅
className={cn(
  semanticColors.interactive.default,
  `px-${spacing.md} py-${spacing.sm}`
)}
```

**Available tokens**:
- `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg`, `spacing.xl`
- `typography.headingLg`, `typography.bodySm`, `typography.meta`
- `semanticColors.text.*`, `semanticColors.background.*`
- `borders.default`, `borders.subtle`, `borders.muted`
- `transitions.fast`, `transitions.normal`, `transitions.slow`

## 🧪 Testing

### Test DMs
```bash
# Terminal 1: Start dev server
npm run dev

# Open browser
# User 1: http://localhost:3000
# User 2: http://localhost:3000 (different browser/incognito)
# User 1: Navigate to /messages
# Send message to User 2
# Should appear in real-time
```

### Test Community Chat
```bash
# Go to any community (/community/[slug])
# Test sending message
# Test /kick command (if leader/founder)
# Verify design styling
```

### Test AI
```bash
curl -X POST http://localhost:3000/api/chat/ai \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello AI!"}'
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Messages not appearing | Check Supabase RLS policies in `/supabase/migrations/20250101_create_direct_messages.sql` |
| Design looks broken | Verify Tailwind CSS is configured, check `/lib/design-system.ts` for token names |
| AI not responding | Check API keys in `.env.local`, verify `GOOGLE_GENERATIVE_AI_API_KEY` is set |
| Real-time not working | Ensure Supabase subscription is active, check browser console for errors |

## 📊 Performance Tips

- **Message pagination**: Add `offset` parameter to message queries
- **Caching**: Use React Query/SWR for message caching
- **Avatar optimization**: Uses seed-based generation (no extra requests)
- **RLS**: Prevents unauthorized access at database layer

## 🔐 Security

✅ Implemented:
- Row-level security on all message tables
- User can only see their own messages
- Recipient validation before sending
- No message spoofing possible
- Messages are encrypted in transit (HTTPS)

## 📚 Full Documentation

See `/CHAT_SYSTEM_IMPLEMENTATION.md` for:
- Complete architecture
- Feature list
- Advanced configuration
- Design decisions
- Troubleshooting guide

## 💡 Common Tasks

### Add a new message feature
1. Update schema if needed
2. Add component in `/components/messages/`
3. Use design tokens from `/lib/design-system.ts`
4. Add API route in `/app/api/messages/`

### Customize AI behavior
1. Edit `/lib/ai-integration.ts`
2. Update system prompt in env vars
3. Modify `generateAIResponse()` function
4. Test via `/api/chat/ai`

### Add Socket.IO event
1. Add listener in `/lib/socketio-server.ts`
2. Add client emitter in `/lib/socketio.ts`
3. Wire up in components
4. Test with browser DevTools

## ✅ Checklist Before Deploy

- [ ] Run migrations: `npx supabase migration up`
- [ ] Set env vars for AI provider
- [ ] Test DM between 2 users
- [ ] Test community chat messaging
- [ ] Verify no console errors
- [ ] Test on mobile
- [ ] Check RLS policies are correct
- [ ] Load test with multiple messages

## 🎯 Next Steps

1. ✅ Basic setup complete
2. → Test DM functionality
3. → Set up Socket.IO server
4. → Configure AI provider
5. → Add typing indicators
6. → Monitor performance
7. → Gather user feedback

---

**Questions?** See full guide at `/CHAT_SYSTEM_IMPLEMENTATION.md`
