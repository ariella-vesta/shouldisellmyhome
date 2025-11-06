import { GoogleGenAI, Type } from "@google/genai";
import { FinancialData, CalculationResults, NewHomeDetails } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is not set. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const getEstimatedHomeValue = async (address: string): Promise<number> => {
  if (!address) {
    throw new Error("Address is required to estimate home value.");
  }

  const prompt = `Based on the following US address, provide a realistic estimated home value.
Address: "${address}"
Respond with ONLY a single integer number representing the value in USD, without any commas, currency symbols, or other text. For example: 550000`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    const text = response.text.trim();
    const value = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (isNaN(value) || value === 0) {
        console.error("Failed to parse estimated value from Gemini response:", text);
        throw new Error("Could not estimate a value for this address. Please enter a value manually.");
    }
    return value;
  } catch (error) {
    console.error("Error fetching estimated value from Gemini API:", error);
    throw new Error("Could not estimate a value for this address. Please enter a value manually.");
  }
};

export const getNewHomeDetails = async (address: string, price: number): Promise<NewHomeDetails> => {
    if (!address) {
        throw new Error("Address is required to get home details.");
    }

    const prompt = `Act as a real estate data provider. For the property at the address "${address}" with an estimated price of $${price.toLocaleString()}, provide the following details in a JSON object:
- A realistic estimated annual property tax amount.
- A realistic estimated annual homeowner's insurance cost.
- A brief, 1-2 sentence summary of the current local real estate market trends for that area.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        estimatedTaxes: {
                            type: Type.NUMBER,
                            description: "Estimated annual property tax in USD.",
                        },
                        estimatedInsurance: {
                            type: Type.NUMBER,
                            description: "Estimated annual homeowner's insurance in USD.",
                        },
                        marketTrends: {
                            type: Type.STRING,
                            description: "A brief summary of local market trends.",
                        },
                    },
                    required: ["estimatedTaxes", "estimatedInsurance", "marketTrends"],
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const details = JSON.parse(jsonStr);
        
        if (!details.estimatedTaxes || !details.estimatedInsurance || !details.marketTrends) {
            throw new Error("AI response was missing required fields.");
        }

        return details;
    } catch (error) {
        console.error("Error fetching new home details from Gemini API:", error);
        throw new Error("Could not retrieve details for the new address. Please check the address and try again.");
    }
};


export const getFinancialAnalysis = async (
  data: FinancialData,
  results: CalculationResults
): Promise<string> => {
  const financialSummary = [
    `- Current Home Value: $${data.currentHomeValue.toLocaleString()}`,
    (data.currentHomeAddress ? `- Current Home Address: ${data.currentHomeAddress}` : null),
    `- Current Mortgage Balance: $${data.currentMortgageBalance.toLocaleString()}`,
    `- Current Interest Rate: ${data.currentInterestRate}%`,
    `- Current Total Monthly Home Payment: $${data.currentMonthlyPayment.toLocaleString()}`,
    `- New Home Price: $${data.newHomePrice.toLocaleString()}`,
    (data.newHomeAddress ? `- New Home Address: ${data.newHomeAddress}` : null),
    `- New Interest Rate: ${data.newInterestRate}%`,
    `- Gross Monthly Income: $${data.monthlyIncome.toLocaleString()}`,
    `- Monthly Non-Housing Debts: $${(data.autoDebt + data.studentDebt + data.creditCardDebt + data.otherDebt).toLocaleString()}`
  ].filter(Boolean).join('\n    ');

  const newHomeDetailsSummary = data.newHomeDetails ? `
    Here are some AI-generated estimates for the new property:
    - Estimated Annual Property Tax: $${data.newHomeDetails.estimatedTaxes.toLocaleString()}
    - Estimated Annual Homeowner's Insurance: $${data.newHomeDetails.estimatedInsurance.toLocaleString()}
    - Local Market Snapshot: ${data.newHomeDetails.marketTrends}
    ` : '';


  const prompt = `
    You are a helpful financial analyst assistant for homeowners. Your role is to provide a balanced, qualitative analysis based on the financial data provided. Do not give direct financial advice or tell the user what to do. Instead, highlight potential pros, cons, risks, and factors they should consider. Be empathetic and clear.

    Here is the user's financial summary:
    ${financialSummary}
    
    ${newHomeDetailsSummary}

    Here are the calculated results of the move:
    - Estimated Proceeds from Sale (for down payment): $${results.proceedsFromSale.toLocaleString()}
    - New Estimated Monthly Home Payment (PITI): $${results.newMonthlyPayment.toLocaleString()}
    - Change in Monthly Home Payment: $${results.monthlyPaymentDifference.toLocaleString()}
    - Current Debt-to-Income (DTI) Ratio: ${results.currentDTI.toFixed(1)}%
    - New Debt-to-Income (DTI) Ratio: ${results.newDTI.toFixed(1)}%

    Based on this data, provide a comprehensive, in-depth analysis in Markdown format. Structure your response as follows:

    First, a TL;DR section:
    **TL;DR: The Bottom Line**
    Provide a 2-3 sentence summary that captures the most critical tradeoff for the user. Be direct but neutral.

    Then, provide the in-depth analysis using the following structure. Use emojis as markers for each section heading. Use bold text and bullet points for clarity within each section.

    💰 **Cash Flow Impact**: Briefly explain what the change in monthly payment means for their budget.
    📊 **Debt-to-Income (DTI) Analysis**: Explain the change in their DTI ratio. Mention that lenders generally prefer a DTI below 43%, and what their new DTI means for their financial health and future borrowing capacity.
    ✨ **Potential Benefits of Moving**: What are the potential financial upsides? (e.g., leveraging equity for a larger down payment, new home features, etc.).
    ⚠️ **Risks & Considerations**: What are the financial risks? (e.g., giving up a historically low interest rate, increased financial burden, market volatility, hidden costs of moving). If new home details were provided, incorporate the specific tax/insurance estimates and market trends into your analysis here, reminding the user that these are estimates.
    🤔 **Key Questions for You**: Prompt the user with 3-4 important questions they should ask themselves before proceeding (e.g., "Is my income stable enough to support this higher payment?", "Have I budgeted for moving costs, repairs, and furnishing a new home?", "Do I have a sufficient emergency fund?"). If new home details were provided, add a question like: "Have you confirmed the property tax rates and obtained a formal insurance quote for the new address?"

    Conclude with a strong disclaimer: "This is an AI-generated analysis, not financial advice. It's essential to consult with a qualified financial advisor and mortgage lender before making any decisions."
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching analysis from Gemini API:", error);
    return "There was an error generating the analysis. Please check your API key and try again.";
  }
};
