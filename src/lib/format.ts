/** Rupee amounts as on the designs: "Rs. 1,600". The currency is NPR. */
export function formatNpr(amount: number) {
  return `Rs. ${amount.toLocaleString('en-IN')}`
}
