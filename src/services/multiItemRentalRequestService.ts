import { createSupabaseRentalRequestItemRepository } from "../domain/adapters/supabaseItemRepositories";
import { createSupabaseRentalRequestWorkflowRepository } from "../domain/adapters/supabaseRentalRequestWorkflowRepository";
import { createRentalRequestItemService } from "../domain/services/rentalRequestItemService";
import { createRentalRequestWorkflowService } from "../domain/services/rentalRequestWorkflowService";
import { rentalRequestItemFeatureFlags } from "../config/featureFlags";
import { publicSupabase, supabase } from "../lib/supabase";

export const publicRentalRequestWorkflowService =
  createRentalRequestWorkflowService(
    createSupabaseRentalRequestWorkflowRepository(publicSupabase),
    rentalRequestItemFeatureFlags
  );

export const adminRentalRequestWorkflowService =
  createRentalRequestWorkflowService(
    createSupabaseRentalRequestWorkflowRepository(supabase),
    rentalRequestItemFeatureFlags
  );

export const adminRentalRequestItemService = createRentalRequestItemService(
  createSupabaseRentalRequestItemRepository(supabase),
  rentalRequestItemFeatureFlags
);
