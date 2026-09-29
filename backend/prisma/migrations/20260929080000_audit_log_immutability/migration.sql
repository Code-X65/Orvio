-- Audit records are append-only. The migration role owns the bounded retention
-- procedure below; deploy the running API with a distinct, non-owner role.
CREATE TABLE "audit_log_retention_authority" (
  "role_name" NAME PRIMARY KEY
);

INSERT INTO "audit_log_retention_authority" ("role_name") VALUES (CURRENT_USER);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs are append-only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "audit_log_retention_authority" WHERE "role_name" = CURRENT_USER
  ) THEN
    RAISE EXCEPTION 'audit_logs may only be deleted by the retention procedure';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION purge_expired_audit_logs(retention_days INTEGER DEFAULT 1825)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF retention_days < 1825 THEN
    RAISE EXCEPTION 'audit retention cannot be shorter than 1825 days';
  END IF;

  DELETE FROM public.audit_logs
  WHERE created_at < CURRENT_TIMESTAMP - make_interval(days => retention_days);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM PUBLIC;
REVOKE ALL ON TABLE "audit_log_retention_authority" FROM PUBLIC;
