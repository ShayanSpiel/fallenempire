-- Allow employees to end their own employment contracts

CREATE OR REPLACE FUNCTION public.get_public_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$;

DROP POLICY IF EXISTS "Employees can end their own contracts" ON employment_contracts;
CREATE POLICY "Employees can end their own contracts" ON employment_contracts
FOR UPDATE USING (
  employee_id = public.get_public_user_id()
  AND active = true
)
WITH CHECK (
  employee_id = public.get_public_user_id()
  AND active = false
);
