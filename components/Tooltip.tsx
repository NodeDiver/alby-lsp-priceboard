import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      top: rect.top - 80, // More space above the element to avoid mouse interference
      left: rect.left + rect.width / 2 - 128 // 128px = half of w-64 (256px)
    });
    setIsVisible(true);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div 
          className="fixed px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-[9999] w-64 pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${Math.max(10, Math.min(position.left, window.innerWidth - 266))}px` // Keep within viewport
          }}
        >
          <div className="text-center leading-relaxed">{text}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

