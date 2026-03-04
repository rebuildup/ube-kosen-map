interface LanguageIconProps {
  size?: number;
  className?: string;
}

// JP (Japanese) text icon
export const JPIcon = ({ className, size = 16 }: LanguageIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <title>Icon</title>
    <text
      x="12"
      y="15"
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill="currentColor"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      JP
    </text>
  </svg>
);

// EN (English) text icon
export const ENIcon = ({ className, size = 16 }: LanguageIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <title>Icon</title>
    <text
      x="12"
      y="15"
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill="currentColor"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      EN
    </text>
  </svg>
);
