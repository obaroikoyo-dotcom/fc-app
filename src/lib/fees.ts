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
