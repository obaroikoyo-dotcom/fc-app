// What a brand is charged and what a creator receives for one deal.
//
// This mirrors supabase/functions/create-payment-intent, which is the only
// place the real charge is computed (from the campaign budget and the brand's
// real Enterprise flag in the database - never from anything the browser
// sends). The numbers here are for display only, so if you change a rate,
// change it in both places.
//
// Standard brands: +5% platform fee on top of the budget; the creator
// receives 90% of the budget. Card processing is covered by that fee.
// Enterprise brands: no FlipCollab platform fee on either side (creator gets
// 100%), but a flat card processing fee of 2.5% + 20p of the budget is added to
// the brand's charge to cover Stripe's cost of taking the card payment.

export const BRAND_PLATFORM_FEE_RATE = 0.05;
export const CREATOR_PLATFORM_FEE_RATE = 0.10;
export const ENTERPRISE_PROCESSING_FEE_RATE = 0.025;
export const ENTERPRISE_PROCESSING_FEE_FIXED_PENCE = 20;

export interface DealBreakdown {
  budget: number;        // pence - the campaign budget
  brandFee: number;      // pence - FlipCollab's 5% (0 for Enterprise)
  processingFee: number; // pence - card processing (Enterprise only)
  totalCharge: number;   // pence - what the brand's card is charged
  creatorCut: number;    // pence - FlipCollab's 10% off the creator (0 for Enterprise)
  creatorPayout: number; // pence - what the creator receives
}

export function dealBreakdown(budgetPence: number, isEnterprise: boolean): DealBreakdown {
  const budget = Math.max(0, Math.round(budgetPence));
  const brandFee = isEnterprise ? 0 : Math.round(budget * BRAND_PLATFORM_FEE_RATE);
  const processingFee = isEnterprise && budget > 0
    ? Math.round(budget * ENTERPRISE_PROCESSING_FEE_RATE) + ENTERPRISE_PROCESSING_FEE_FIXED_PENCE
    : 0;
  const creatorCut = isEnterprise ? 0 : Math.round(budget * CREATOR_PLATFORM_FEE_RATE);
  return {
    budget,
    brandFee,
    processingFee,
    totalCharge: budget + brandFee + processingFee,
    creatorCut,
    creatorPayout: budget - creatorCut,
  };
}

// 123456 -> "£1,234.56"
export function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 9000 -> "£90", 10080 -> "£100.80": whole pounds without the pence, anything else with them.
export function formatPounds(pence: number): string {
  const digits = pence % 100 === 0 ? 0 : 2;
  return `£${(pence / 100).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// Brands see FlipCollab's two fees as one: the 5% on top of what they pay and the 10% off
// what the creator gets, both worked out on the same budget (15% of it in all).
export const COMBINED_PLATFORM_FEE_PERCENT = Math.round((BRAND_PLATFORM_FEE_RATE + CREATOR_PLATFORM_FEE_RATE) * 100);

// Prices in the chat are talked about as what the creator gets, while the database keeps the
// deal's budget in whole pounds. These two convert between them.

// What the creator gets (pence) for a deal at this budget (whole pounds).
export function creatorNetPence(budgetPounds: number, isEnterprise: boolean): number {
  return dealBreakdown(budgetPounds * 100, isEnterprise).creatorPayout;
}

// The smallest budget (whole pounds) that gives the creator at least this much (pence).
export function budgetForCreatorNet(netPence: number, isEnterprise: boolean): number {
  const wanted = Math.max(0, Math.round(netPence));
  const share = isEnterprise ? 1 : 1 - CREATOR_PLATFORM_FEE_RATE;
  let budget = Math.max(1, Math.ceil(wanted / (100 * share)));
  while (creatorNetPence(budget, isEnterprise) < wanted) budget++;
  while (budget > 1 && creatorNetPence(budget - 1, isEnterprise) >= wanted) budget--;
  return budget;
}
