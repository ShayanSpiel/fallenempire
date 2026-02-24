-- Fix companies/employment/work history RLS to use public.users IDs

DROP POLICY IF EXISTS "Companies are viewable by everyone" ON companies;
CREATE POLICY "Companies are viewable by everyone" ON companies
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own companies" ON companies;
CREATE POLICY "Users can create their own companies" ON companies
FOR INSERT WITH CHECK (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
CREATE POLICY "Users can update their own companies" ON companies
FOR UPDATE USING (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
CREATE POLICY "Users can delete their own companies" ON companies
FOR DELETE USING (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Employment contracts viewable by involved parties" ON employment_contracts;
CREATE POLICY "Employment contracts viewable by involved parties" ON employment_contracts
FOR SELECT USING (
  employee_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can create contracts" ON employment_contracts;
CREATE POLICY "Company owners can create contracts" ON employment_contracts
FOR INSERT WITH CHECK (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can update contracts" ON employment_contracts;
CREATE POLICY "Company owners can update contracts" ON employment_contracts
FOR UPDATE USING (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can delete contracts" ON employment_contracts;
CREATE POLICY "Company owners can delete contracts" ON employment_contracts
FOR DELETE USING (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Users can view their own work history" ON work_history;
CREATE POLICY "Users can view their own work history" ON work_history
FOR SELECT USING (
  user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create their own work records" ON work_history;
CREATE POLICY "Users can create their own work records" ON work_history
FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);
