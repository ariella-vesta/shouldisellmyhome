import React from 'react';
import { CalculationResults } from '../types';
import { SparklesIcon } from './icons';

interface ResultsDisplayProps {
  results: CalculationResults | null;
  analysis: string;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const MetricCard: React.FC<{ title: string; value: string; subtext?: string; colorClass?: string }> = ({ title, value, subtext, colorClass = 'text-slate-800' }) => (
    <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg shadow-md text-center">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
);

const simpleMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    
    const boldedMarkdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    const lines = boldedMarkdown.trim().split('\n');
    const htmlParts: string[] = [];
    let inList = false;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('- ')) {
            if (!inList) {
                htmlParts.push('<ul>');
                inList = true;
            }
            htmlParts.push(`<li>${trimmedLine.substring(2)}</li>`);
        } else {
            if (inList) {
                htmlParts.push('</ul>');
                inList = false;
            }

            if (trimmedLine === '') {
                continue;
            }

            if (line.includes('<strong>TL;DR: The Bottom Line</strong>')) {
                htmlParts.push(`<h2 class="text-xl font-bold text-slate-900 mb-2">${line}</h2>`);
            } else if (line.match(/^(💰|📊|✨|⚠️|🤔)/)) {
                htmlParts.push(`<h3 class="text-lg font-semibold text-slate-800 mt-6 pt-4 border-t border-slate-200">${line}</h3>`);
            } else if (trimmedLine.startsWith('### ')) {
                 htmlParts.push(`<h3 class="text-lg font-semibold text-slate-800 mt-6 pt-4 border-t border-slate-200">${trimmedLine.substring(4)}</h3>`);
            } else if (line.includes('This is an AI-generated analysis')) {
                htmlParts.push(`<p class="text-sm text-slate-500 italic mt-6 pt-4 border-t border-slate-200">${line}</p>`);
            }
            else {
                htmlParts.push(`<p>${line}</p>`);
            }
        }
    }

    if (inList) {
        htmlParts.push('</ul>');
    }

    return htmlParts.join('\n');
};


const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, analysis, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mt-8 text-center">
        <div className="flex justify-center items-center space-x-2">
            <SparklesIcon className="h-6 w-6 text-indigo-500 animate-pulse" />
            <p className="text-slate-600">Analyzing your financial future...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const paymentDiffColor = results.monthlyPaymentDifference > 0 ? 'text-red-500' : 'text-green-600';
  const dtiDiffColor = results.newDTI > 43 ? 'text-red-500' : (results.newDTI > results.currentDTI ? 'text-amber-600' : 'text-green-600');

  return (
    <div className="mt-8 space-y-8 animate-fade-in">
        <div className="bg-slate-100 p-6 rounded-xl shadow-inner">
            <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Financial Snapshot: Before vs. After</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Current DTI" value={`${results.currentDTI.toFixed(1)}%`} subtext="Debt-to-Income" />
                <MetricCard title="New DTI" value={`${results.newDTI.toFixed(1)}%`} subtext="Debt-to-Income" colorClass={dtiDiffColor} />
                <MetricCard title="New Mthly. Payment" value={formatCurrency(results.newMonthlyPayment)} subtext="Est. PITI" />
                <MetricCard title="Payment Change" value={`${results.monthlyPaymentDifference > 0 ? '+' : ''}${formatCurrency(results.monthlyPaymentDifference)}`} subtext="Per Month" colorClass={paymentDiffColor} />
            </div>
        </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center">
          <SparklesIcon className="h-6 w-6 text-indigo-500 mr-2" />
          AI-Powered Analysis
        </h2>
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(analysis) }}
        />
      </div>
    </div>
  );
};

export default ResultsDisplay;