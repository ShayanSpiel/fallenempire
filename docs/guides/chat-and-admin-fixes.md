# Chat and Admin Fixes

## Issues Fixed

### 1. Actor Not Found in Chat API ✅

**Problem:**
```
[Observe] Error during observation: Error: Actor not found: e790a6c6-5cb2-4237-b20f-33ec53856d7c
```

The frontend was sending an invalid `agent_id` (possibly a conversation ID instead of an agent user ID), causing the workflow to fail when trying to fetch the actor's state.

**Solution:**
Added validation in `app/api/chat/agent/route.ts` to verify the agent exists BEFORE invoking the workflow:

```typescript
// Verify agent exists
const { data: agentCheck } = await supabaseAdmin
  .from("users")
  .select("id, username, is_bot")
  .eq("id", agent_id)
  .maybeSingle();

if (!agentCheck) {
  console.error("[ChatAPI] Agent not found:", agent_id);
  return NextResponse.json(
    { error: `Agent not found: ${agent_id}` },
    { status: 404 }
  );
}

if (!agentCheck.is_bot) {
  console.error("[ChatAPI] Not an agent:", agent_id);
  return NextResponse.json(
    { error: "Specified user is not an agent" },
    { status: 400 }
  );
}
```

**Benefits:**
- ✅ Catches invalid agent IDs early with clear error message
- ✅ Prevents workflow execution with bad data
- ✅ Returns proper 404 response to frontend
- ✅ Logs the issue for debugging

### 2. 403 Forbidden on Admin Endpoints ✅

**Problem:**
```
GET /api/admin/workflows 403 in 430ms
GET /api/admin/workflow-runs?limit=25 403 in 1081ms
```

Admin endpoints were returning 403 Forbidden, but there was no logging to diagnose WHY the admin check was failing.

**Solution:**
Enhanced `assertAdmin()` function in both admin API routes with detailed logging:

```typescript
async function assertAdmin(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[Admin] No authenticated user");
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: adminCheck, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role, id, username")
    .eq("auth_id", user.id)
    .maybeSingle();

  console.log("[Admin] Auth check:", {
    auth_id: user.id,
    user: adminCheck?.username,
    role: adminCheck?.role,
    error: adminError?.message
  });

  if (adminError || !adminCheck) {
    console.error("[Admin] User not found or error:", adminError);
    return { error: NextResponse.json({ error: "Forbidden - User not found" }, { status: 403 }) };
  }

  if (adminCheck.role !== "admin") {
    console.warn("[Admin] Non-admin access attempt:", adminCheck.username, "role:", adminCheck.role);
    return { error: NextResponse.json({ error: "Forbidden - Admin role required" }, { status: 403 }) };
  }

  console.log("[Admin] Access granted:", adminCheck.username);
  return { userId: adminCheck.id };
}
```

**Benefits:**
- ✅ Clear logging of auth flow
- ✅ Shows exactly why 403 is returned
- ✅ Helps diagnose user role issues
- ✅ More detailed error messages

## Files Modified

1. **app/api/chat/agent/route.ts**
   - Added agent validation before workflow execution
   - Added logging for debugging
   - Returns proper 404 for invalid agents

2. **app/api/admin/workflows/route.ts**
   - Enhanced assertAdmin() with detailed logging
   - Better error messages

3. **app/api/admin/workflow-runs/route.ts**
   - Enhanced assertAdmin() with detailed logging
   - Better error messages

## Debugging Steps

### For Chat Issues:
Check the server logs for:
```
[ChatAPI] Received request: { agent_id: '...', message: '...', profile_id: '...' }
[ChatAPI] Agent not found: ... (if agent doesn't exist)
[ChatAPI] Not an agent: ... (if user is not a bot)
[ChatAPI] Chatting with agent: ... (if successful)
```

### For Admin Access Issues:
Check the server logs for:
```
[Admin] Auth check: { auth_id: '...', user: '...', role: '...', error: '...' }
[Admin] User not found or error: ... (if user doesn't exist)
[Admin] Non-admin access attempt: ... role: ... (if user lacks admin role)
[Admin] Access granted: ... (if successful)
```

## Next Steps

### To Fix Chat Issue:
The frontend needs to ensure it's sending a valid agent user ID, not a conversation ID. Check where `agent_id` is being set in the message component.

Likely locations:
- `components/messages/message-thread-unified.tsx`
- Message route parameters in Next.js

### To Fix Admin Access:
1. Check server logs when accessing admin panel to see exact reason for 403
2. Verify your user has `role = 'admin'` in the users table
3. Run in Supabase SQL editor:
   ```sql
   SELECT id, username, role, auth_id
   FROM users
   WHERE auth_id = 'YOUR_AUTH_ID';
   ```
4. If role is not 'admin', update it:
   ```sql
   UPDATE users
   SET role = 'admin'
   WHERE auth_id = 'YOUR_AUTH_ID';
   ```

## Testing

Try the following:

1. **Chat API:**
   - Send a chat message to an agent
   - Check logs for agent validation
   - Should see either success or clear error message

2. **Admin Panel:**
   - Navigate to `/admin/dashboard`
   - Check logs for auth flow
   - Should see your username and role in logs
   - If 403, logs will show why

---

**Status:** ✅ Both issues now have proper validation and logging to diagnose problems!
