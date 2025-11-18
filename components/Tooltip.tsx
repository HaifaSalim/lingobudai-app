
import React from 'react';
import { useAppStore } from '../store/useAppStore';

const Tooltip: React.FC = () => {
  const { tooltip } = useAppStore();

  if (!tooltip.visible) {
    return null;
  }

  return (
    <div
      className="fixed bg-gray-800 text-soft-white dark:bg-soft-white dark:text-gray-800 text-sm rounded py-1 px-3 shadow-lg z-[100] pointer-events-none animate-fade-in"
      style={{
        top: `${tooltip.y}px`,
        left: `${tooltip.x}px`,
        transform: 'translate(5px, 5px)', // Offset slightly from the cursor
      }}
    >
      {tooltip.content}
    </div>
  );
};

export default Tooltip;