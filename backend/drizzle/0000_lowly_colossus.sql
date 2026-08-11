CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"chama_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "chamas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"join_code" text NOT NULL,
	"county" text,
	"chama_type" text NOT NULL,
	"voting_model" text NOT NULL,
	"status" text DEFAULT 'pending_setup' NOT NULL,
	"lending_enabled" boolean DEFAULT false NOT NULL,
	"founder_member_id" uuid,
	"founding_date" date,
	"expected_members_min" integer,
	"expected_members_max" integer,
	"minimum_contribution" numeric(12, 2) DEFAULT '0' NOT NULL,
	"contribution_due_day" integer,
	"penalty_rule" jsonb,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chamas_status_check" CHECK ("chamas"."status" in ('pending_setup', 'active', 'suspended')),
	CONSTRAINT "chamas_type_check" CHECK ("chamas"."chama_type" in ('investment_group', 'sacco', 'hybrid')),
	CONSTRAINT "chamas_voting_check" CHECK ("chamas"."voting_model" in ('one_member_one_vote', 'shareholding_weighted')),
	CONSTRAINT "chamas_due_day_check" CHECK ("chamas"."contribution_due_day" is null or "chamas"."contribution_due_day" between 1 and 28)
);
--> statement-breakpoint
ALTER TABLE "chamas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "constitution_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"constitution_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "constitution_acceptances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "constitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "constitutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"role" text NOT NULL,
	"kind" text DEFAULT 'invite_link' NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_url" text NOT NULL,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chama_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"national_id_encrypted" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"next_of_kin_name" text,
	"next_of_kin_phone" text,
	"next_of_kin_relationship" text,
	"role" text DEFAULT 'member' NOT NULL,
	"is_founder" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"kyc_status" text DEFAULT 'pending' NOT NULL,
	"password_hash" text,
	"approved_by_member_id" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_role_check" CHECK ("members"."role" in ('chairperson', 'treasurer', 'secretary', 'member')),
	CONSTRAINT "members_status_check" CHECK ("members"."status" in ('pending_review', 'active', 'suspended', 'exited', 'rejected')),
	CONSTRAINT "members_kyc_check" CHECK ("members"."kyc_status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"chama_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitution_acceptances" ADD CONSTRAINT "constitution_acceptances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitution_acceptances" ADD CONSTRAINT "constitution_acceptances_constitution_id_constitutions_id_fk" FOREIGN KEY ("constitution_id") REFERENCES "public"."constitutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitutions" ADD CONSTRAINT "constitutions_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitutions" ADD CONSTRAINT "constitutions_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_chama_idx" ON "audit_log" USING btree ("chama_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_phone_chama_unique" ON "auth_identities" USING btree ("phone","chama_id");--> statement-breakpoint
CREATE INDEX "auth_identities_phone_idx" ON "auth_identities" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "chamas_slug_unique" ON "chamas" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "chamas_join_code_unique" ON "chamas" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "chamas_status_idx" ON "chamas" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "acceptances_member_constitution_unique" ON "constitution_acceptances" USING btree ("member_id","constitution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "constitutions_chama_version_unique" ON "constitutions" USING btree ("chama_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_unique" ON "invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invites_chama_idx" ON "invites" USING btree ("chama_id");--> statement-breakpoint
CREATE INDEX "kyc_member_idx" ON "kyc_documents" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_phone_per_chama_unique" ON "members" USING btree ("chama_id","phone");--> statement-breakpoint
CREATE INDEX "members_chama_status_idx" ON "members" USING btree ("chama_id","status");--> statement-breakpoint
CREATE INDEX "members_chama_role_idx" ON "members" USING btree ("chama_id","role");--> statement-breakpoint
CREATE INDEX "otp_phone_purpose_idx" ON "otp_verifications" USING btree ("phone","purpose","created_at");--> statement-breakpoint
CREATE INDEX "refresh_member_idx" ON "refresh_tokens" USING btree ("member_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_log" AS PERMISSIVE FOR ALL TO public USING ("audit_log"."chama_id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("audit_log"."chama_id" = current_setting('app.chama_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "chamas" AS PERMISSIVE FOR ALL TO public USING ("chamas"."id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("chamas"."id" = current_setting('app.chama_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "public_join_lookup" ON "chamas" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.public_lookup', true) = 'true');--> statement-breakpoint
CREATE POLICY "global_lookup" ON "chamas" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.global_lookup', true) = 'true');--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "constitution_acceptances" AS PERMISSIVE FOR ALL TO public USING ("constitution_acceptances"."member_id" in (select m.id from members m where m.chama_id = current_setting('app.chama_id', true)::uuid)) WITH CHECK ("constitution_acceptances"."member_id" in (select m.id from members m where m.chama_id = current_setting('app.chama_id', true)::uuid));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "constitutions" AS PERMISSIVE FOR ALL TO public USING ("constitutions"."chama_id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("constitutions"."chama_id" = current_setting('app.chama_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invites" AS PERMISSIVE FOR ALL TO public USING ("invites"."chama_id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("invites"."chama_id" = current_setting('app.chama_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "public_invite_lookup" ON "invites" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.public_lookup', true) = 'true');--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "kyc_documents" AS PERMISSIVE FOR ALL TO public USING ("kyc_documents"."chama_id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("kyc_documents"."chama_id" = current_setting('app.chama_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "members" AS PERMISSIVE FOR ALL TO public USING ("members"."chama_id" = current_setting('app.chama_id', true)::uuid) WITH CHECK ("members"."chama_id" = current_setting('app.chama_id', true)::uuid);