import React from 'react';
import { cn } from '../../lib/utils';

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md', ...props }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-md overflow-hidden",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 z-10"
      >
        {/* Abstract Path & M Shape */}
        <path
          d="M 10 26 
             C 10 18, 12 14, 15 14 
             C 18 14, 19 18, 20 22 
             C 21 18, 22 14, 25 14 
             C 28 14, 30 18, 30 26"
          stroke="url(#pathGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Glow behind the path */}
        <path
          d="M 10 26 
             C 10 18, 12 14, 15 14 
             C 18 14, 19 18, 20 22 
             C 21 18, 22 14, 25 14 
             C 28 14, 30 18, 30 26"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="blur(1px)"
          opacity="0.3"
        />
        
        {/* AI Sparkle / Node 1 */}
        <path d="M29 11L30 8L33 7L30 6L29 3L28 6L25 7L28 8L29 11Z" fill="#FDE047" />
        {/* AI Sparkle / Node 2 */}
        <path d="M11 9L11.5 7.5L13 7L11.5 6.5L11 5L10.5 6.5L9 7L10.5 7.5L11 9Z" fill="#FDE047" />
        
        <defs>
          <linearGradient id="pathGradient" x1="10" y1="26" x2="30" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E9D5FF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
