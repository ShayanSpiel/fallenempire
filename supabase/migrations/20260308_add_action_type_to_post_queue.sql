-- Ensure the post processing queue tracks what triggered each job

ALTER TABLE IF EXISTS post_processing_queue
ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'post.created';

ALTER TABLE post_processing_queue
ALTER COLUMN action_type SET DEFAULT 'post.created';

CREATE INDEX IF NOT EXISTS idx_post_queue_action_type
  ON post_processing_queue(action_type);
