import type { RentalAgreement } from "../../src/types/agreement";

export interface ReviewPopulation {
  sample: boolean;
  clean?: boolean;
  agreementNumber: string;
  effectiveAt: string;
  blockers: Array<{ key: string; decision: string }>;
  optionalOmissions: string[];
  wordingChanges?: string[];
}
export interface ReviewFixture {
  blocks: unknown[];
  population: ReviewPopulation;
}
export function populateReview(source: unknown, agreement: RentalAgreement, options?: { sample?: boolean }): ReviewFixture;
export function cleanReview(source: unknown, agreement: RentalAgreement, options?: { sample?: boolean }): ReviewFixture;
