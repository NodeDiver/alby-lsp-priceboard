import React, { useState, useEffect } from 'react';
import { convertSatsToCurrency, CurrencyConversion } from '../lib/currency';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  selectedCurrency: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  selectedCurrency
}) => {
  const [conversion, setConversion] = useState<CurrencyConversion | null>(null);
  const [loading, setLoading] = useState(false);

  // Convert 1 sats to selected currency
  useEffect(() => {
    if (isOpen && selectedCurrency) {
      setLoading(true);
      convertSatsToCurrency(1, selectedCurrency)
        .then(setConversion)
        .catch(error => {
          console.error('Currency conversion error:', error);
          setConversion({
            amount: 0,
            formatted: 'N/A',
            currency: selectedCurrency,
            symbol: '$',
            error: 'Conversion failed'
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedCurrency]);
  if (!isOpen) return null;

  const handlePayment = () => {
    // TODO: Integrate with Alby tools for actual payment
    // For now, simulate successful payment
    console.log('Payment initiated - 21 sats');
    
    // Simulate payment success after 2 seconds
    setTimeout(() => {
      onPaymentSuccess();
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <span className="text-2xl">💪</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              Unlock Pro Mode
            </h3>
            <p className="text-gray-600">
              Get access to advanced features for 30 days
            </p>
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">1 sats</div>
                <div className="text-sm text-gray-500">
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : conversion ? (
                    conversion.error ? (
                      <span className="text-red-500">Conversion failed</span>
                    ) : (
                      `~${conversion.formatted}`
                    )
                  ) : (
                    '~$0.15 USD'
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Valid for</div>
                <div className="font-semibold text-gray-900 dark:text-slate-100">30 days</div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-3">Pro Mode includes:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Large channel sizes (7M-10M sats)
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Force fetch latest prices for any channel size
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Historical data beyond 7 days (coming soon)
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Advanced filtering and export (coming soon)
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Direct admin support notifications (coming soon)
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Unlimited API access (coming soon)
              </li>
            </ul>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <span className="mr-2">⚡</span>
            Pay 1 sats with lightning
          </button>
          
          {/* Testing Notice */}
          <p className="text-center text-sm font-medium text-gray-700 mt-2">
            (Currently free - testing mode, no payment required)
          </p>

          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
