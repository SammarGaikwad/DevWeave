import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { AuthInput } from './AuthInput';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = '••••••••',
  required = true,
  autoComplete = 'current-password'
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPassword((prev) => !prev);
  };

  return (
    <AuthInput
      id={id}
      label={label}
      type={showPassword ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      error={error}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      icon={Lock}
      rightElement={
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="text-white/40 hover:text-cyan-300 focus:outline-none transition-colors p-1 rounded-md"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      }
    />
  );
};
