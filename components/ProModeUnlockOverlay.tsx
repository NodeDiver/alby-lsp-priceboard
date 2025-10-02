import React from 'react';

interface ProModeUnlockOverlayProps {
  onProModeToggle: () => void;
  channelSize: number;
}

export const ProModeUnlockOverlay: React.FC<ProModeUnlockOverlayProps> = ({
  onProModeToggle,
  channelSize
}) => {
  const formatChannelSize = (size: number) => {
    return `${(size / 1000000).toFixed(0)}M`;
  };

  return (
    <div className="relative">
      {/* Blurred Background */}
      <div className="filter blur-sm pointer-events-none">
        <div className="bg-gray-100 rounded-lg p-8 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">🔒</div>
            <div className="text-xl font-semibold">Pro Mode Required</div>
            <div className="text-sm">Channel size {formatChannelSize(channelSize)} requires Pro Mode</div>
          </div>
        </div>
      </div>

      {/* Overlay Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center border-2 border-yellow-200">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
            <span className="text-3xl">💪</span>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Unlock with Pro Mode 💪
          </h3>

          {/* Description */}
          <p className="text-gray-600 mb-6">
            Access channel sizes {formatChannelSize(channelSize)} and larger with Pro Mode
          </p>


          {/* Pro Mode Toggle */}
          <div className="flex items-center justify-center space-x-3 mb-6">
            <span className="text-sm font-medium text-gray-700">Pro Mode 💪</span>
            <button
              onClick={onProModeToggle}
              className="relative inline-flex h-8 w-14 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 hover:bg-gray-300"
              role="switch"
              aria-label="Toggle Pro Mode"
              aria-checked="false"
            >
              <span className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform translate-x-1" />
            </button>
          </div>

          {/* Call to Action */}
          <div className="text-sm text-gray-500">
            Click the toggle above to unlock Pro Mode
          </div>
        </div>
      </div>
    </div>
  );
};
