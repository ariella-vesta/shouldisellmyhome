import React, { useState, useCallback, useRef } from 'react';
import { FinancialData, CalculationResults, NewHomeDetails } from './types';
import { getFinancialAnalysis, getEstimatedHomeValue, getNewHomeDetails } from './services/geminiService';
import InputCard from './components/InputCard';
import ResultsDisplay from './components/ResultsDisplay';
import ConsultantForm from './components/ConsultantForm';
import { HomeIcon, DollarSignIcon, PercentIcon, SparklesIcon, LocationMarkerIcon, LoadingSpinnerIcon, DocumentTextIcon, VESTA_FLAME_LOGO_BASE64 } from './components/icons';

// Declare globals for CDN scripts
declare const html2canvas: any;
declare const jspdf: any;

const App: React.FC = () => {
  const [data, setData] = useState<FinancialData>({
    currentHomeValue: 500000,
    currentMortgageBalance: 250000,
    currentInterestRate: 3.0,
    currentMonthlyPayment: 1800,
    currentHomeAddress: '',
    newHomePrice: 750000,
    newInterestRate: 6.5,
    newHomeAddress: '',
    monthlyIncome: 10000,
    autoDebt: 500,
    studentDebt: 300,
    creditCardDebt: 200,
    otherDebt: 0,
    newHomeDetails: null,
  });
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValueLoading, setIsValueLoading] = useState<boolean>(false);
  const [isHomeDetailsLoading, setIsHomeDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const resultsRef = useRef<HTMLDivElement>(null);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'newHomeAddress' || name === 'currentHomeAddress') {
      setData(prev => ({ ...prev, [name]: value }));
    } else {
      setData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
  };

  const handleGetValue = async () => {
    if (!data.currentHomeAddress) return;
    setIsValueLoading(true);
    setError('');
    try {
        const estimatedValue = await getEstimatedHomeValue(data.currentHomeAddress);
        setData(prev => ({...prev, currentHomeValue: estimatedValue}));
    } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while estimating home value.");
        }
    } finally {
        setIsValueLoading(false);
    }
  };
  
  const handleGetNewHomeDetails = async () => {
    if (!data.newHomeAddress) return;
    setIsHomeDetailsLoading(true);
    setError('');
    try {
        const details = await getNewHomeDetails(data.newHomeAddress, data.newHomePrice);
        setData(prev => ({...prev, newHomeDetails: details}));
    } catch (err) {
         if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while fetching new home details.");
        }
    } finally {
        setIsHomeDetailsLoading(false);
    }
  }

  const calculateFinancials = useCallback(() => {
    setError('');
    if (data.currentHomeValue <= 0) {
      setError('Estimated Home Value must be greater than zero.');
      return null;
    }
    if (data.newHomePrice <= 0) {
      setError('New Home Purchase Price must be greater than zero.');
      return null;
    }
    if (data.newInterestRate <= 0) {
      setError('Estimated New Interest Rate must be greater than zero.');
      return null;
    }
    if (data.monthlyIncome <= 0) {
      setError('Gross Monthly Income must be greater than zero to calculate DTI.');
      return null;
    }

    // Simplified selling costs (e.g., 6% for commissions, 2% for closing)
    const sellingCosts = data.currentHomeValue * 0.08;
    const proceedsFromSale = data.currentHomeValue - data.currentMortgageBalance - sellingCosts;
    
    if (proceedsFromSale < 0) {
        setError("Warning: Your estimated selling costs are more than your home equity.");
    }
    const downPayment = Math.max(0, proceedsFromSale);
    const newLoanAmount = data.newHomePrice - downPayment;

    // Use detailed estimates if available, otherwise use simplified PITI calculation
    const monthlyPropertyTax = data.newHomeDetails 
        ? data.newHomeDetails.estimatedTaxes / 12
        : (data.newHomePrice * 0.0125) / 12; // 1.25% annual tax rate fallback

    const monthlyInsurance = data.newHomeDetails
        ? data.newHomeDetails.estimatedInsurance / 12
        : (data.newHomePrice * 0.005) / 12;  // 0.5% annual insurance rate fallback

    const monthlyRate = data.newInterestRate / 100 / 12;
    const numberOfPayments = 30 * 12;

    const principalAndInterest = monthlyRate > 0
      ? newLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
      : newLoanAmount / numberOfPayments;
      
    const newMonthlyPayment = principalAndInterest + monthlyPropertyTax + monthlyInsurance;

    const totalMonthlyDebt = data.autoDebt + data.studentDebt + data.creditCardDebt + data.otherDebt;
    
    const currentTotalMonthlyPayments = data.currentMonthlyPayment + totalMonthlyDebt;
    const newTotalMonthlyPayments = newMonthlyPayment + totalMonthlyDebt;

    const currentDTI = (currentTotalMonthlyPayments / data.monthlyIncome) * 100;
    const newDTI = (newTotalMonthlyPayments / data.monthlyIncome) * 100;
    const monthlyPaymentDifference = newMonthlyPayment - data.currentMonthlyPayment;
    
    return { proceedsFromSale, newLoanAmount, newMonthlyPayment, currentDTI, newDTI, monthlyPaymentDifference };
  }, [data]);

  const handleAnalyzeClick = async () => {
    const calculatedResults = calculateFinancials();
    if (calculatedResults) {
      setResults(calculatedResults);
      setIsLoading(true);
      setAnalysis('');
      const aiAnalysis = await getFinancialAnalysis(data, calculatedResults);
      setAnalysis(aiAnalysis);
      setIsLoading(false);
    }
  };
  
  const generatePdfAsBase64 = async (): Promise<string> => {
    if (!resultsRef.current) {
        throw new Error("Results element not found for PDF generation.");
    }

    const pdfContainer = document.createElement('div');
    const header = document.createElement('div');
    const logoImg = document.createElement('img');
    const title = document.createElement('h1');
    const resultsClone = resultsRef.current.cloneNode(true) as HTMLElement;

    // Style the container for high-quality capture
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '0';
    pdfContainer.style.width = '800px'; // A good width for a PDF page
    pdfContainer.style.padding = '40px';
    pdfContainer.style.backgroundColor = 'white';
    pdfContainer.style.fontFamily = 'sans-serif';

    // Style the header
    header.style.textAlign = 'center';
    header.style.marginBottom = '40px';

    logoImg.src = VESTA_FLAME_LOGO_BASE64;
    logoImg.style.width = '100px';
    logoImg.style.height = 'auto';
    logoImg.style.margin = '0 auto 20px auto';

    title.innerText = 'Vesta Consulting Group';
    title.style.fontSize = '28px';
    title.style.fontWeight = 'bold';
    title.style.color = '#1e293b'; // slate-800
    title.style.margin = '0';

    header.appendChild(logoImg);
    header.appendChild(title);
    
    // Assemble the container for PDF generation
    pdfContainer.appendChild(header);
    pdfContainer.appendChild(resultsClone);
    document.body.appendChild(pdfContainer);

    try {
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
        });
        
        // Use a higher scale for better quality, and PNG to avoid compression artifacts.
        const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.height / imgProps.width;
        let imgHeight = pdfWidth * ratio;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }
        
        return pdf.output('datauristring');
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw new Error("Could not generate the PDF report. Please try again.");
    } finally {
        document.body.removeChild(pdfContainer); // Clean up the DOM
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">The 3% Dilemma Calculator</h1>
          <p className="mt-2 text-lg text-slate-600">Analyze the financial impact of leaving your low-interest rate behind.</p>
        </header>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Current Situation */}
            <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
              <h2 className="text-xl font-bold text-slate-900 border-b pb-2">Your Current Situation</h2>
              <InputCard label="Estimated Home Value" id="currentHomeValue" value={data.currentHomeValue} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 500000" required />
              <div>
                <label htmlFor="currentHomeAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Current Address (Optional)
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <LocationMarkerIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        id="currentHomeAddress"
                        name="currentHomeAddress"
                        value={data.currentHomeAddress}
                        onChange={handleInputChange}
                        className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 bg-white"
                        placeholder="Enter full address, city, and zip"
                        disabled={isValueLoading}
                    />
                </div>
                <button
                    type="button"
                    onClick={handleGetValue}
                    disabled={isValueLoading || !data.currentHomeAddress}
                    className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition"
                >
                    {isValueLoading ? <LoadingSpinnerIcon className="h-5 w-5" /> : 'Get Value'}
                </button>
                <p className="text-xs text-slate-500 mt-1">Enter your address to get an AI-powered home value estimate.</p>
              </div>
              <InputCard label="Remaining Mortgage Balance" id="currentMortgageBalance" value={data.currentMortgageBalance} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 250000" required />
              <InputCard label="Current Mortgage Rate" id="currentInterestRate" value={data.currentInterestRate} onChange={handleInputChange} icon={<PercentIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 3.0" step={0.01} required />
              <InputCard label="Total Monthly Payment (PITI)" id="currentMonthlyPayment" value={data.currentMonthlyPayment} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 1800" required />
            </div>

            {/* New Home Scenario */}
            <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
                <h2 className="text-xl font-bold text-slate-900 border-b pb-2">Your New Home Scenario</h2>
                <InputCard label="New Home Purchase Price" id="newHomePrice" value={data.newHomePrice} onChange={handleInputChange} icon={<HomeIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 750000" required />
                <div>
                    <label htmlFor="newHomeAddress" className="block text-sm font-medium text-gray-700 mb-1">Property Address (Optional)</label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <LocationMarkerIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text" id="newHomeAddress" name="newHomeAddress" value={data.newHomeAddress} onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 bg-white"
                            placeholder="e.g., 123 Main St, Anytown, USA"
                            disabled={isHomeDetailsLoading}
                        />
                    </div>
                    <button type="button" onClick={handleGetNewHomeDetails} disabled={isHomeDetailsLoading || !data.newHomeAddress}
                        className="mt-2 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition"
                    >
                        {isHomeDetailsLoading ? <LoadingSpinnerIcon className="h-5 w-5" /> : 'Get Details'}
                    </button>
                    <p className="text-xs text-slate-500 mt-1">Get AI-powered estimates for taxes and insurance.</p>
                </div>
                 {data.newHomeDetails && (
                    <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200 animate-fade-in">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center"><DocumentTextIcon className="h-4 w-4 mr-1.5 text-slate-500"/>Property Details</h4>
                        <div className="text-xs text-slate-600 space-y-1">
                            <p><strong>Est. Annual Tax:</strong> ${data.newHomeDetails.estimatedTaxes.toLocaleString()}</p>
                            <p><strong>Est. Annual Insurance:</strong> ${data.newHomeDetails.estimatedInsurance.toLocaleString()}</p>
                            <p><strong>Market Snapshot:</strong> {data.newHomeDetails.marketTrends}</p>
                        </div>
                    </div>
                 )}
                <InputCard label="Estimated New Interest Rate" id="newInterestRate" value={data.newInterestRate} onChange={handleInputChange} icon={<PercentIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 6.5" step={0.01} required />
            </div>
          </div>
          
          {/* Income & Debts */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Your Financial Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputCard label="Gross Monthly Income" id="monthlyIncome" value={data.monthlyIncome} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 10000" required />
                <div></div>
                <div></div>
            </div>
            <p className="text-sm text-slate-500 mt-6 mb-2">Enter your total minimum monthly payments for other debts.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InputCard label="Auto Loans" id="autoDebt" value={data.autoDebt} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 500" required />
              <InputCard label="Student Loans" id="studentDebt" value={data.studentDebt} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 300" required />
              <InputCard label="Credit Cards" id="creditCardDebt" value={data.creditCardDebt} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 200" required />
              <InputCard label="Other Debts" id="otherDebt" value={data.otherDebt} onChange={handleInputChange} icon={<DollarSignIcon className="h-5 w-5 text-gray-400" />} placeholder="e.g., 100" required />
            </div>
          </div>
        </div>

        {error && <p className="text-red-600 text-center mt-4 bg-red-100 p-3 rounded-lg">{error}</p>}
        
        <div className="mt-8 text-center">
          <button
            onClick={handleAnalyzeClick}
            disabled={isLoading}
            className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-slate-900 bg-[#f3c65c] hover:bg-[#e0b44f] disabled:bg-[#f3c65c]/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e0b44f] transition-all duration-300 transform hover:scale-105"
          >
            <SparklesIcon className="h-5 w-5 mr-2" />
            {isLoading ? 'Thinking...' : 'Generate AI Analysis'}
          </button>
        </div>

        <div ref={resultsRef}>
            {(results || isLoading) && <ResultsDisplay results={results} analysis={analysis} isLoading={isLoading} />}
        </div>
        
        {analysis && !isLoading && (
            <div className="mt-8 text-center bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-slate-900">Ready for the Next Step?</h3>
                <p className="mt-2 text-slate-600">Get personalized advice from a professional to understand your options better.</p>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-slate-900 bg-[#f3c65c] hover:bg-[#e0b44f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e0b44f] transition-all duration-300 transform hover:scale-105"
                >
                    Speak to a Real Estate Consultant
                </button>
            </div>
        )}

      </main>
      {results && <ConsultantForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} financialData={data} calculationResults={results} generatePdf={generatePdfAsBase64} />}
      <footer className="text-center p-4 text-xs text-slate-400">
        <p>This tool is for informational purposes only. The analysis is AI-generated and not financial advice.</p>
      </footer>
    </div>
  );
};

export default App;