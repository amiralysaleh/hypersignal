
'use client';

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold text-lg", className)}>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 140 28"
            className="h-7 w-auto dark:invert group-data-[collapsible=icon]:hidden"
            aria-label="HyperSignal Logo"
        >
        <text 
            x="50%" 
            y="50%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            fontFamily="'Brush Script MT', 'Brush Script Std', 'cursive'"
            fontSize="24"
            fontWeight="bold"
            fill="black"
        >
            HyperSignal
        </text>
        </svg>
    </div>
  );
}
