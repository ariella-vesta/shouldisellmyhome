import React from 'react';

interface InputCardProps {
  label: string;
  id: string;
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  type?: 'number' | 'text';
  step?: number;
  placeholder?: string;
  required?: boolean;
}

const InputCard: React.FC<InputCardProps> = ({ label, id, value, onChange, icon, type = 'number', step = 0.01, placeholder, required = false }) => {
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {icon}
        </div>
        <input
          type={type}
          id={id}
          name={id}
          value={value === 0 ? '' : value}
          onChange={onChange}
          className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 bg-white"
          placeholder={placeholder}
          step={step}
          min={type === 'number' ? '0' : undefined}
          required={required}
        />
      </div>
    </div>
  );
};

export default InputCard;