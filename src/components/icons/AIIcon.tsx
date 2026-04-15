export function AIIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ai-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
        <linearGradient id="ai-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f093fb" />
          <stop offset="100%" stopColor="#f5576c" />
        </linearGradient>
      </defs>
      <path 
        d="M12 3 L13.5 9 L19 10.5 L13.5 12 L12 18 L10.5 12 L5 10.5 L10.5 9 Z" 
        fill="url(#ai-gradient-1)"
        opacity="0.9"
      />
      <path 
        d="M17 5 L17.8 7.2 L20 8 L17.8 8.8 L17 11 L16.2 8.8 L14 8 L16.2 7.2 Z" 
        fill="url(#ai-gradient-2)"
        opacity="0.8"
      />
      <path 
        d="M7 15 L7.5 16.5 L9 17 L7.5 17.5 L7 19 L6.5 17.5 L5 17 L6.5 16.5 Z" 
        fill="url(#ai-gradient-2)"
        opacity="0.7"
      />
      <circle cx="12" cy="11" r="2" fill="white" opacity="0.95" />
    </svg>
  );
}
