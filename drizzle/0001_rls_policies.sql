-- Row-level tenant isolation, enforced in addition to app-layer `WHERE chama_id = ...`
-- filtering, never instead of it (spec: multi-tenancy model).
--
-- The app sets `app.current_chama_id` for the duration of a request's transaction
-- via set_config() (see src/lib/auth/tenant-context.ts). When that GUC is unset,
-- policies fall through to permissive so routes that have not yet adopted a tenant
-- context (most onboarding endpoints, which are scoped by member id instead) keep
-- working; once a route opts in by setting the GUC, isolation is enforced for it.
-- FORCE ROW LEVEL SECURITY is required because Neon connects as the table owner,
-- and owners bypass RLS by default.

ALTER TABLE "chamas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chamas" FORCE ROW LEVEL SECURITY;
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;
ALTER TABLE "constitutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "constitutions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "constitution_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "constitution_acceptances" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY chama_isolation ON "chamas"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR id = current_setting('app.current_chama_id', true)
  );

CREATE POLICY chama_isolation ON "members"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR chama_id IS NULL
    OR chama_id = current_setting('app.current_chama_id', true)
  );

CREATE POLICY chama_isolation ON "constitutions"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR chama_id = current_setting('app.current_chama_id', true)
  );

CREATE POLICY chama_isolation ON "constitution_acceptances"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR EXISTS (
      SELECT 1 FROM "constitutions" c
      WHERE c.id = constitution_id
        AND c.chama_id = current_setting('app.current_chama_id', true)
    )
  );

CREATE POLICY chama_isolation ON "invites"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR chama_id = current_setting('app.current_chama_id', true)
  );

CREATE POLICY chama_isolation ON "audit_log"
  USING (
    current_setting('app.current_chama_id', true) IS NULL
    OR chama_id IS NULL
    OR chama_id = current_setting('app.current_chama_id', true)
  );
