import React, { useState, FormEvent } from 'react';
import { XIcon, LoadingSpinnerIcon, DocumentTextIcon } from './icons';
import { FinancialData, CalculationResults } from '../types';

interface ConsultantFormProps {
  isOpen: boolean;
  onClose: () => void;
  financialData: FinancialData;
  calculationResults: CalculationResults;
  generatePdf: () => Promise<string>;
}

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/8893314/uifm1o5/';

const ConsultantForm: React.FC<ConsultantFormProps> = ({ isOpen, onClose, financialData, calculationResults, generatePdf }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({ name: '', email: '', phone: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleClose = () => {
    onClose();
    setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ name: '', email: '', phone: '' });
        setErrors({ name: '', email: '', phone: '' });
        setSubmitError('');
    }, 300);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (value) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = { name: '', email: '', phone: '' };
    let isValid = true;
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required.';
      isValid = false;
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid.';
      isValid = false;
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
      isValid = false;
    } else if (!/^\d{10,}$/.test(formData.phone.replace(/\D/g, ''))) {
        newErrors.phone = 'Phone number must be at least 10 digits.';
        isValid = false;
    }
    setErrors(newErrors);
    return isValid;
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setSubmitError('');
    try {
        const pdfDataUri = await generatePdf();
        const link = document.createElement('a');
        link.href = pdfDataUri;
        link.download = 'Vesta-Financial-Analysis.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("PDF Download failed:", error);
        setSubmitError("Sorry, we couldn't generate your PDF report. This issue has been logged.");
    } finally {
        setIsDownloading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
        const createSummaryText = (data: FinancialData, results: CalculationResults): string => {
            const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

            const summaryLines = [
                '--- User Input ---',
                `Current Home Value: ${formatCurrency(data.currentHomeValue)}`,
                `Current Mortgage Balance: ${formatCurrency(data.currentMortgageBalance)}`,
                `Current Interest Rate: ${data.currentInterestRate}%`,
                `Current Monthly Payment: ${formatCurrency(data.currentMonthlyPayment)}`,
                `New Home Price: ${formatCurrency(data.newHomePrice)}`,
                `New Interest Rate: ${data.newInterestRate}%`,
                `Gross Monthly Income: ${formatCurrency(data.monthlyIncome)}`,
                `Auto Debt: ${formatCurrency(data.autoDebt)}`,
                `Student Debt: ${formatCurrency(data.studentDebt)}`,
                `Credit Card Debt: ${formatCurrency(data.creditCardDebt)}`,
                `Other Debt: ${formatCurrency(data.otherDebt)}`,
                `Current Address: ${data.currentHomeAddress || 'N/A'}`,
                `New Address: ${data.newHomeAddress || 'N/A'}`,
                '',
                '--- Calculated Results ---',
                `Proceeds from Sale: ${formatCurrency(results.proceedsFromSale)}`,
                `New Loan Amount: ${formatCurrency(results.newLoanAmount)}`,
                `New Monthly Payment: ${formatCurrency(results.newMonthlyPayment)}`,
                `Current DTI: ${results.currentDTI.toFixed(1)}%`,
                `New DTI: ${results.newDTI.toFixed(1)}%`,
                `Monthly Payment Difference: ${formatCurrency(results.monthlyPaymentDifference)}`
            ];

            return summaryLines.join('\n');
        };

        const summary = createSummaryText(financialData, calculationResults);
        
        const payload = {
            ...formData,
            summary: summary,
        };

        const body = new URLSearchParams(payload);

        const response = await fetch(ZAPIER_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        if (!response.ok) {
            throw new Error(`Submission failed. Server responded with status: ${response.status}`);
        }

        setIsSubmitted(true);
    } catch (error) {
        console.error("Submission failed:", error);
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
            setSubmitError("A network error occurred. Please check your connection and try again.");
        } else {
            setSubmitError("Failed to submit your request. Please try again later.");
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-md relative">
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <XIcon className="h-6 w-6" />
        </button>

        {isSubmitted ? (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
            <p className="text-slate-600 mb-6">Your information has been sent. A consultant will be in touch with you shortly.</p>
            <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition"
            >
                {isDownloading ? <LoadingSpinnerIcon className="h-5 w-5 mr-2" /> : <DocumentTextIcon className="h-5 w-5 mr-2" />}
                {isDownloading ? 'Generating...' : 'Download PDF Report'}
            </button>
            {submitError && <p className="text-red-500 text-xs mt-2 text-center">{submitError}</p>}
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-4 text-center">Speak to a Consultant</h2>
            <p className="text-sm text-slate-500 mb-6 text-center">Fill out your information below, and a consultant will contact you to discuss your options.</p>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 sm:text-sm ${errors.name ? 'border-red-500' : ''}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address <span className="text-red-500">*</span></label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={isSubmitting}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 sm:text-sm ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required disabled={isSubmitting}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 sm:text-sm ${errors.phone ? 'border-red-500' : ''}`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div className="pt-2">
                 <p className="text-xs text-slate-500 mb-4">By submitting this form, you consent to receive communications from a member of Vesta Consulting Group. Reply STOP at any time.</p>
                <button type="submit" disabled={isSubmitting}
                    className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <><LoadingSpinnerIcon className="h-5 w-5 mr-2" /> Submitting...</> : 'Submit Request'}
                </button>
                 {submitError && <p className="text-red-500 text-xs mt-2 text-center">{submitError}</p>}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ConsultantForm;