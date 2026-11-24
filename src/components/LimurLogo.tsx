import React from 'react';

interface LimurLogoProps {
  className?: string;
  /** Optional accessible label */
  ariaLabel?: string;
}

/**
 * Architectural rectangular brand mark: LI.MUR / PROJECT
 * Sharp-cornered #0A0A0A border, tall condensed LI.MUR with baseline circular dot,
 * and evenly tracked PROJECT aligned flush with the exact width of LI.MUR.
 */
export const LimurLogo: React.FC<LimurLogoProps> = ({
  className = 'h-9 w-auto',
  ariaLabel = 'LIMUR PROJECT',
}) => {
  const condensedFont =
    "'Oswald', 'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 216 84"
      role="img"
      aria-label={ariaLabel}
      className={`block shrink-0 select-none ${className}`}
    >
      <rect
        x="1"
        y="1"
        width="214"
        height="82"
        fill="#FFFFFF"
        stroke="#0A0A0A"
        strokeWidth="2"
      />
      <text
        x="22"
        y="50"
        fill="#0A0A0A"
        fontFamily={condensedFont}
        fontSize="44"
        fontWeight="500"
        textLength="44"
        lengthAdjust="spacing"
      >
        LI
      </text>
      <circle cx="75.5" cy="46.8" r="3.2" fill="#0A0A0A" />
      <text
        x="85"
        y="50"
        fill="#0A0A0A"
        fontFamily={condensedFont}
        fontSize="44"
        fontWeight="500"
        textLength="109"
        lengthAdjust="spacing"
      >
        MUR
      </text>
      <text
        x="22"
        y="69"
        fill="#0A0A0A"
        fontFamily={condensedFont}
        fontSize="14.5"
        fontWeight="500"
        textLength="172"
        lengthAdjust="spacing"
      >
        PROJECT
      </text>
    </svg>
  );
};
