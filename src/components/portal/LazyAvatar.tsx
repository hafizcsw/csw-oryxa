import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from 'lucide-react';

interface LazyAvatarProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export default function LazyAvatar({ src, alt, className = "", fallbackIcon }: LazyAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-primary ${className}`}>
        {fallbackIcon || <User className="w-16 h-16 text-primary-foreground" />}
      </div>
    );
  }

  return (
    <>
      {!isLoaded && <Skeleton className={className} />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0 absolute'} transition-opacity duration-300`}
      />
    </>
  );
}
