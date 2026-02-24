-- Fix battle mechanics in one shot - just run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS VOID AS $$
DECLARE
  battle_record RECORD;
  v_battle RECORD;
  v_winner_id UUID;
  v_loser_id UUID;
  v_member_id UUID;
BEGIN
  FOR battle_record IN
    SELECT id FROM public.battles
    WHERE status = 'active' AND ends_at <= NOW()
  LOOP
    -- Resolve battle outcome
    PERFORM public.resolve_battle_outcome(battle_record.id);

    -- Apply battle mechanics
    BEGIN
      -- Get updated battle info
      SELECT * INTO v_battle FROM battles WHERE id = battle_record.id;

      -- Determine winner/loser based on outcome
      IF v_battle.status = 'attacker_win' THEN
        v_winner_id := v_battle.attacker_community_id;
        v_loser_id := v_battle.defender_community_id;
      ELSIF v_battle.status = 'defender_win' THEN
        v_winner_id := v_battle.defender_community_id;
        v_loser_id := v_battle.attacker_community_id;
      ELSE
        CONTINUE; -- Battle not resolved, skip
      END IF;

      IF v_winner_id IS NULL OR v_loser_id IS NULL THEN
        CONTINUE; -- Missing communities, skip
      END IF;

      -- WINNER EFFECTS
      PERFORM apply_momentum(v_winner_id);
      IF v_battle.status = 'attacker_win' AND v_battle.hex_id IS NOT NULL THEN
        PERFORM track_conquest(v_winner_id, v_battle.hex_id);
      END IF;
      UPDATE community_battle_state SET current_win_streak = current_win_streak + 1 WHERE community_id = v_winner_id;

      -- LOSER EFFECTS
      PERFORM apply_disarray(v_loser_id);
      UPDATE community_battle_state SET current_win_streak = 0 WHERE community_id = v_loser_id;

      -- Apply morale penalty to all loser members
      UPDATE users u SET morale = GREATEST(0, morale - 10)
      FROM community_members cm
      WHERE cm.user_id = u.id AND cm.community_id = v_loser_id AND cm.left_at IS NULL;

      INSERT INTO morale_events (user_id, morale_change, event_type, event_trigger)
      SELECT cm.user_id, -10, 'battle', 'defeat'
      FROM community_members cm
      WHERE cm.community_id = v_loser_id AND cm.left_at IS NULL;

      -- Add rage to each loser member
      FOR v_member_id IN
        SELECT user_id FROM community_members WHERE community_id = v_loser_id AND left_at IS NULL
      LOOP
        PERFORM add_rage(v_member_id, 'battle_loss', jsonb_build_object('battle_id', battle_record.id));
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Battle mechanics failed for %: %', battle_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
