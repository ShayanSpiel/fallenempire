# Chat System Installation Checklist

## Pre-Installation
- [ ] Node.js 18+ installed
- [ ] npm or yarn ready
- [ ] Supabase account and project set up
- [ ] Git repository cloned

## Step 1: Install Dependencies
```bash
npm install socket.io socket.io-client ai
```
- [ ] All dependencies installed without errors

## Step 2: Database Migration
Choose one option:

### Option A: Via CLI
```bash
npx supabase migration up
```
- [ ] Migration applied successfully
- [ ] Table `direct_messages` created in Supabase

### Option B: Manual
1. Go to Supabase dashboard → SQL Editor
2. Copy SQL from `/supabase/migrations/20250101_create_direct_messages.sql`
3. Paste and run
- [ ] SQL executed without errors
- [ ] Table and indexes created

### Verify
- [ ] Can see `direct_messages` table in Supabase
- [ ] Can see RLS policies enabled
- [ ] Columns: id, sender_id, recipient_id, content, created_at, updated_at

## Step 3: Environment Variables
Edit `.env.local`:

```env
# Required
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Choose ONE AI provider:

# Option A: Google Gemini
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-pro
GOOGLE_GENERATIVE_AI_API_KEY=your_actual_key_here

# Option B: OpenAI
# AI_PROVIDER=openai
# AI_MODEL=gpt-4
# OPENAI_API_KEY=your_actual_key_here

# Option C: Anthropic Claude
# AI_PROVIDER=anthropic
# AI_MODEL=claude-3-sonnet
# ANTHROPIC_API_KEY=your_actual_key_here

# Optional
# AI_SYSTEM_PROMPT="Your custom system prompt here"
```

- [ ] All required vars set
- [ ] API key(s) valid and working
- [ ] `.env.local` is in `.gitignore` (don't commit secrets!)

## Step 4: File Verification
Verify all new files exist:

### Pages
- [ ] `/app/messages/page.tsx`
- [ ] `/app/messages/[userId]/page.tsx`

### Components
- [ ] `/components/messages/messages-list-client.tsx`
- [ ] `/components/messages/message-thread-client.tsx`

### API Routes
- [ ] `/app/api/messages/route.ts`
- [ ] `/app/api/chat/ai/route.ts`

### Libraries
- [ ] `/lib/socketio.ts`
- [ ] `/lib/socketio-server.ts`
- [ ] `/lib/ai-integration.ts`

### Database
- [ ] `/supabase/migrations/20250101_create_direct_messages.sql`

### Documentation
- [ ] `/CHAT_SYSTEM_IMPLEMENTATION.md`
- [ ] `/CHAT_QUICK_START.md`
- [ ] `/IMPLEMENTATION_SUMMARY.md`

### Community Chat (Updated)
- [ ] `/components/community/community-chat.tsx` (has design token imports)

## Step 5: Run Development Server
```bash
npm run dev
```
- [ ] Server starts without errors
- [ ] No console warnings about missing dependencies
- [ ] Can access http://localhost:3000

## Step 6: Test Direct Messages
1. Open http://localhost:3000 in browser
2. Create test account (Account 1) if not logged in
3. Create another browser tab/window with incognito/private mode
4. Create test account (Account 2)
5. In Account 1, navigate to `/messages`
   - [ ] Page loads without errors
   - [ ] Conversation list is empty (expected)
6. In Account 2, navigate to Account 1's profile (search or link)
7. Send message: "Hello from Account 2"
8. In Account 1, refresh `/messages`
   - [ ] Conversation appears with Account 2's name
   - [ ] Last message preview shows
9. Click on Account 2's conversation
10. Check message appears
    - [ ] Message displays correctly
    - [ ] Avatar and username shown
    - [ ] Timestamp shown
11. Send reply from Account 1: "Hello from Account 1"
12. In Account 2, refresh `/messages/[userId]`
    - [ ] Reply appears in real-time (or after refresh)
    - [ ] Message bubbles on different sides (you vs them)

## Step 7: Test Community Chat
1. Navigate to any community (e.g., `/community/[slug]`)
2. Find community chat section
   - [ ] Chat loads without errors
   - [ ] Messages display with design system styling
3. Send test message
   - [ ] Message appears instantly (optimistic update)
   - [ ] Your avatar shown
   - [ ] Timestamp correct
4. Check browser DevTools for console errors
   - [ ] No red error messages
   - [ ] No warnings about missing styles

## Step 8: Test Design System Compliance
For both DM and community chat:
- [ ] No bright/neon colors (should use theme colors)
- [ ] Spacing consistent (not mixed pixel sizes)
- [ ] Typography readable (not too small)
- [ ] Responsive on phone (rotate browser to mobile size)
- [ ] Dark mode works (if configured)

## Step 9: Test AI Integration (Optional)
1. Open DevTools → Network tab
2. Open DevTools → Console
3. Run test:
```javascript
// In browser console
fetch('/api/chat/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello AI!' })
})
.then(r => r.json())
.then(d => console.log(d.response))
```
- [ ] Response received (check Network tab)
- [ ] No API key errors
- [ ] AI response makes sense
- [ ] No console errors

## Step 10: Performance Check
1. Open DevTools → Performance tab
2. Send 5-10 messages quickly
3. Record performance
   - [ ] No jank/stuttering
   - [ ] Messages appear smoothly
   - [ ] No dropped frames
4. Open DevTools → Application → Storage → IndexedDB
   - [ ] Supabase stores are present (if using subscriptions)

## Step 11: Security Check
1. Open DevTools → Network tab
2. Send message
3. Check request:
   - [ ] API call is to `/api/messages` (POST)
   - [ ] Uses HTTPS (if on production)
   - [ ] API key NOT in request (should be server-side)
   - [ ] User IDs are UUIDs (not predictable)
4. Try to access other user's messages:
   - [ ] Can only see own conversations
   - [ ] Cannot access messages you're not part of
   - [ ] Cannot delete others' messages

## Step 12: Mobile Responsiveness
1. Open DevTools → Device Toolbar (Ctrl+Shift+M)
2. Test on mobile breakpoint (375px width)
   - [ ] Messages list scrollable
   - [ ] Chat input accessible
   - [ ] Send button reachable
   - [ ] No overflow/truncation
3. Test on tablet (768px)
   - [ ] Layout looks good
   - [ ] Text readable
   - [ ] Touch targets large enough

## Step 13: Error Handling
1. Disconnect internet
2. Try to send message
   - [ ] Error message displayed
   - [ ] Can reconnect and retry
3. Reconnect internet
4. Try to send message again
   - [ ] Message sends successfully

## Step 14: Documentation Review
- [ ] Read `/CHAT_QUICK_START.md`
- [ ] Read `/CHAT_SYSTEM_IMPLEMENTATION.md`
- [ ] Understand architecture (pages, components, API, database)
- [ ] Know where to find each feature

## Final Verification Checklist

### Core Features
- [ ] Direct message creation works
- [ ] Real-time message delivery works
- [ ] Conversation search works
- [ ] Community chat works
- [ ] Design system styling applied (no hardcoding)
- [ ] Responsive design works

### Quality
- [ ] No console errors
- [ ] No warning about missing dependencies
- [ ] No missing files
- [ ] Environment variables configured
- [ ] Database migration applied

### Documentation
- [ ] All markdown files exist
- [ ] Code has JSDoc comments
- [ ] Types are defined (TypeScript)
- [ ] Functions documented

### Security
- [ ] RLS policies in place
- [ ] Cannot access other users' messages
- [ ] Authentication required
- [ ] No secrets in code

### Performance
- [ ] Messages load instantly
- [ ] No N+1 queries
- [ ] Optimistic updates work
- [ ] Avatars load efficiently

## Troubleshooting

If any step fails, refer to:
- **General Issues**: `/CHAT_SYSTEM_IMPLEMENTATION.md#Support--Troubleshooting`
- **Setup Issues**: `/CHAT_QUICK_START.md#Troubleshooting`
- **Code Issues**: Check inline comments in component files

## Post-Installation

After verification:
1. [ ] Commit changes to git
2. [ ] Push to repository
3. [ ] Review code with team
4. [ ] Plan Socket.IO integration (if needed)
5. [ ] Plan AI feature integration
6. [ ] Schedule user testing

## Ready for Production?

When all checks pass:
- [ ] System is tested
- [ ] Documentation is complete
- [ ] Security is verified
- [ ] Performance is acceptable
- [ ] Team is trained

You're ready to deploy! 🚀

---

**Need Help?**
- See documentation files mentioned above
- Check browser DevTools for detailed errors
- Review migration logs in Supabase
- Check `.env.local` for correct configuration
