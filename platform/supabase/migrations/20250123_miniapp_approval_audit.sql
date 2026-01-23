-- MiniApp Approval Audit Table
-- Tracks all approval status changes for audit trail

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_id_seq TO authenticated;

COMMENT ON TABLE public.notifications IS 'Platform notifications for users';


-- Create miniapp_approvals audit table
CREATE TABLE IF NOT EXISTS public.miniapp_approvals (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'disable')),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rejection_reason TEXT,
  chain_tx_id TEXT,
  request_id TEXT NOT NULL,

  CONSTRAINT fk_miniapp_approvals_app_id
    FOREIGN KEY (app_id) REFERENCES public.miniapp_registry(app_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_miniapp_approvals_app_id ON public.miniapp_approvals(app_id);
CREATE INDEX IF NOT EXISTS idx_miniapp_approvals_reviewed_by ON public.miniapp_approvals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_miniapp_approvals_reviewed_at ON public.miniapp_approvals(reviewed_at DESC);

COMMENT ON TABLE public.miniapp_approvals IS 'Audit trail for MiniApp approval status changes';

ALTER TABLE public.miniapp_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage approvals"
  ON public.miniapp_approvals
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read approvals"
  ON public.miniapp_approvals
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT ON public.miniapp_approvals TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.miniapp_approvals_id_seq TO authenticated;
