CREATE TYPE "public"."chama_status" AS ENUM('pending_setup', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('not_started', 'pending_review', 'in_review', 'approved', 'rejected', 'abandoned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('chairperson', 'treasurer', 'secretary', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending_review', 'active', 'suspended', 'exited');--> statement-breakpoint
CREATE TYPE "public"."onboarding_state" AS ENUM('started', 'phone_verified', 'chama_config_pending', 'details_submitted', 'kyc_pending', 'kyc_in_review', 'kyc_declined', 'kyc_approved', 'constitution_pending', 'constitution_accepted', 'awaiting_governance_approval', 'active', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('signup', 'login', 'password_reset');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"chama_id" text,
	"actor_member_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"county" text NOT NULL,
	"chama_type" text NOT NULL,
	"voting_model" text DEFAULT 'equal_share' NOT NULL,
	"status" "chama_status" DEFAULT 'pending_setup' NOT NULL,
	"founder_member_id" text,
	"lending_enabled" boolean DEFAULT false NOT NULL,
	"min_contribution_amount" numeric(12, 2),
	"contribution_due_day" integer DEFAULT 1,
	"penalty_rule" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chamas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "constitution_acceptances" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"constitution_id" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constitutions" (
	"id" text PRIMARY KEY NOT NULL,
	"chama_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"created_by_member_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"chama_id" text NOT NULL,
	"phone" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by_member_id" text,
	CONSTRAINT "invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"chama_id" text,
	"full_name" text,
	"national_id_encrypted" text,
	"phone" text NOT NULL,
	"email" text,
	"next_of_kin_name" text,
	"next_of_kin_phone" text,
	"next_of_kin_relationship" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"is_founder" boolean DEFAULT false NOT NULL,
	"onboarding_state" "onboarding_state" DEFAULT 'started' NOT NULL,
	"status" "member_status" DEFAULT 'pending_review' NOT NULL,
	"kyc_session_id" text,
	"kyc_status" "kyc_status" DEFAULT 'not_started' NOT NULL,
	"kyc_decision_summary" jsonb,
	"profile_image_url" text,
	"password_hash" text,
	"resume_token" text,
	"resume_token_expires_at" timestamp,
	"approved_by_member_id" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" DEFAULT 'signup' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'didit' NOT NULL,
	"event_id" text,
	"signature_valid" boolean NOT NULL,
	"raw_payload" jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "constitution_acceptances" ADD CONSTRAINT "constitution_acceptances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitution_acceptances" ADD CONSTRAINT "constitution_acceptances_constitution_id_constitutions_id_fk" FOREIGN KEY ("constitution_id") REFERENCES "public"."constitutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitutions" ADD CONSTRAINT "constitutions_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_chama_id_chamas_id_fk" FOREIGN KEY ("chama_id") REFERENCES "public"."chamas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chama_phone_idx" ON "members" USING btree ("chama_id","phone");