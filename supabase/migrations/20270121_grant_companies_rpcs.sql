-- Grant execute on company RPCs for authenticated users

GRANT EXECUTE ON FUNCTION get_user_companies(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_employments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_work_today(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION perform_work(UUID, UUID, UUID) TO authenticated;
