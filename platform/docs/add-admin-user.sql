-- ============================================================================
-- Add Admin User for MiniApp Management System
-- ============================================================================
-- Instructions:
-- 1. Go to https://supabase.com/dashboard/project/dmonstzalbldzzdbbcdj/sql
-- 2. First, run the query below to see existing users:
--    SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;
-- 3. Copy a user_id from the results
-- 4. Uncomment and edit the INSERT statement below with the actual user_id and email
-- 5. Run the INSERT statement to add the user as an admin
-- ============================================================================

-- Step 1: List existing users (run this first)
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Step 2: Add admin user (uncomment and edit after finding user_id)
-- Replace 'YOUR_USER_ID_HERE' with the actual UUID from step 1
-- Replace 'your-email@example.com' with the actual email

-- INSERT INTO public.admin_emails (user_id, email, role)
-- VALUES (
--     'YOUR_USER_ID_HERE',  -- e.g., '550e8400-e29b-41d4-a716-446655440000'
--     'your-email@example.com',
--     'admin'
-- )
-- ON CONFLICT (email) DO UPDATE SET
--     role = EXCLUDED.role,
--     updated_at = NOW();

-- Step 3: Verify the admin was added (run after INSERT)
-- SELECT * FROM public.admin_emails;

-- ============================================================================
-- Alternative: If you need to create a new user first
-- ============================================================================
-- You can create a user through the Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter email and password
-- 4. Click "Create user"
-- 5. Copy the user ID from the users list
-- 6. Use the INSERT statement above to add them as admin
-- ============================================================================
