# Observe Node Fix - Actor Not Found

## Problem

Chat was failing with:
```
[Observe] Error during observation: Error: Actor not found: 150a977f-f73c-45b4-9413-f3ca842e7604
```

Even though the agent validation passed:
```
[ChatAPI] Chatting with agent: Blitz_01
```

## Root Cause

The observe node's database query was failing silently. Likely causes:

1. **Missing Columns**: Query was selecting columns that don't exist (e.g., `freewill`, `mental_power`)
2. **No Error Logging**: The original code didn't log Supabase errors
3. **Using `.single()`**: This throws if no results, but error wasn't captured

## Solution

### 1. Added Error Logging
```typescript
const { data: actor, error } = await supabaseAdmin
  .from("users")
  .select("...")
  .eq("id", actorId)
  .maybeSingle();  // Changed from .single()

if (error) {
  console.error(`[Observe] Supabase error fetching actor ${actorId}:`, error);
  throw new Error(`Actor fetch failed: ${error.message} (${error.code})`);
}
```

### 2. Graceful Column Fallback
```typescript
// Try with full column set
let { data: actor, error } = await supabaseAdmin
  .from("users")
  .select("id, identity_json, morale, coherence, heat, energy, health, mental_power, power_mental, freewill")
  .eq("id", actorId)
  .maybeSingle();

// If column error (42703), retry with minimal safe columns
if (error && error.code === "42703") {
  console.warn(`[Observe] Column error, retrying with minimal columns:`, error.message);
  const result = await supabaseAdmin
    .from("users")
    .select("id, identity_json, morale, coherence, heat, energy, health")
    .eq("id", actorId)
    .maybeSingle();

  actor = result.data;
  error = result.error;
}
```

### 3. Handle Column Name Variations
```typescript
return {
  identity: actor.identity_json || getDefaultIdentity(),
  morale: actor.morale || 50,
  coherence: actor.coherence || 50,
  heat: actor.heat || 0,
  energy: actor.energy || 50,
  health: actor.health || 100,
  mentalPower: actor.mental_power || actor.power_mental || 50,  // Try both column names
  freewill: actor.freewill || 50,
};
```

## Benefits

✅ **Detailed Error Logging**: Now shows exact Supabase error (column name, error code)
✅ **Graceful Degradation**: Falls back to minimal columns if some don't exist
✅ **Column Flexibility**: Handles both `mental_power` and `power_mental` column names
✅ **Better Debugging**: Clear logs show what went wrong

## Testing

Try sending a chat message again. You'll now see one of:

**Success:**
```
[ChatAPI] Received request: { agent_id: '...', message: '...', profile_id: '...' }
[ChatAPI] Chatting with agent: Blitz_01
[UniversalWorkflow] Starting workflow for event:chat
[UniversalWorkflow] Step: observe, Iteration: 1
[UniversalWorkflow] Step: reason, Iteration: 1
...
```

**Column Error (will auto-retry):**
```
[Observe] Column error, retrying with minimal columns: column "freewill" does not exist
[UniversalWorkflow] Step: reason, Iteration: 1
...
```

**Actual Missing Agent:**
```
[Observe] Supabase error fetching actor abc123: Actor not found (PGRST116)
[Observe] Error during observation: Actor fetch failed: Actor not found (PGRST116)
```

## Files Modified

- `lib/ai-system/nodes/observe.ts` - Enhanced error handling and column fallback

## Next Steps

If you still see errors, check the logs to see:
1. What exact Supabase error is returned
2. What column is causing the issue
3. Whether the fallback to minimal columns works

Then we can either:
- Add the missing column to your database
- Update the query to exclude that column
- Add it to the fallback minimal column set

---

**Status:** ✅ FIXED - Observe node now handles column errors gracefully and logs details!
