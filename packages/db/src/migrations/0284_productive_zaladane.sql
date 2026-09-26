CREATE TABLE "agent_adapter_config_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"adapter_type" text NOT NULL,
	"adapter_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_adapter_config_profiles" ADD CONSTRAINT "agent_adapter_config_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_adapter_config_profiles" ADD CONSTRAINT "agent_adapter_config_profiles_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_adapter_config_profiles_company_idx" ON "agent_adapter_config_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_adapter_config_profiles_agent_adapter_uq" ON "agent_adapter_config_profiles" USING btree ("agent_id","adapter_type") WHERE "agent_adapter_config_profiles"."agent_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_adapter_config_profiles_company_default_uq" ON "agent_adapter_config_profiles" USING btree ("company_id","adapter_type") WHERE "agent_adapter_config_profiles"."agent_id" IS NULL;