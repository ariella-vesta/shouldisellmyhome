export interface FinancialData {
  currentHomeValue: number;
  currentMortgageBalance: number;
  currentInterestRate: number;
  currentMonthlyPayment: number;
  currentHomeAddress: string;
  newHomePrice: number;
  newInterestRate: number;
  newHomeAddress: string;
  monthlyIncome: number;
  autoDebt: number;
  studentDebt: number;
  creditCardDebt: number;
  otherDebt: number;
  newHomeDetails: NewHomeDetails | null;
}

export interface CalculationResults {
  proceedsFromSale: number;
  newLoanAmount: number;
  newMonthlyPayment: number;
  currentDTI: number;
  newDTI: number;
  monthlyPaymentDifference: number;
}

export interface NewHomeDetails {
    estimatedTaxes: number;
    estimatedInsurance: number;
    marketTrends: string;
}