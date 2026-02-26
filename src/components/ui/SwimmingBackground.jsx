import React from "react";

// High-resolution swimming pool background - WebP optimized for performance
// Minimum 2560x1440 resolution for sharp display on retina screens
const POOL_BACKGROUND_IMAGE = "https://content-studio.biela.dev/cover/5120x2880/i/images-library/69946a81686a3a3a37211da6/1771334389856-69946a81686a3a3a37211da6/originals/1772018087506.png/stunning-high-resolution-aerial-view-of-an-olympic-swimming-pool-with-crystal-clear-turquoise-blue-water-featuring-crisp-white-lane-dividers-and-starting-blocks-professional-sports-facility-with-perfect-geometric-patterns-ultra-sharp-details-vibrant-cyan-and-blue-tones-pristine-clean-water-surface-with-subtle-light-reflections-professional-photography-quality-4k-resolution-allow-only-white-person-european-5120x2880.webp?search_term=swimming,pool,olympic,lanes,aquatic&img_prompt=Stunning+high+resolution+aerial+view+of+an+Olympic+swimming+pool+with+crystal+clear+turquoise+blue+water+featuring+crisp+white+lane+dividers+and+starting+blocks,+professional+sports+facility+with+perfect+geometric+patterns,+ultra+sharp+details,+vibrant+cyan+and+blue+tones,+pristine+clean+water+surface+with+subtle+light+reflections,+professional+photography+quality,+4K+resolution&w=2560&h=1440&type=image";

export default function SwimmingBackground({ children, variant = "default" }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full-screen swimming pool background image - high resolution 2560x1440 */}
      <div 
        className="fixed inset-0"
        style={{ 
          backgroundImage: `url(${POOL_BACKGROUND_IMAGE})`,
          backgroundAttachment: "fixed",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat"
        }}
      />
      {/* Subtle gradient overlay for text readability - NO blur */}
      <div 
        className={`fixed inset-0 pointer-events-none ${
          variant === "hero"
            ? "bg-gradient-to-b from-slate-900/20 via-transparent to-slate-900/30"
            : "bg-gradient-to-b from-cyan-900/15 via-transparent to-cyan-900/20"
        }`}
      />
      {/* Water shimmer effect at top - subtle glow */}
      <div className="fixed top-0 left-0 right-0 h-32 bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none" />
      {/* Animated wave layers at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-24 pointer-events-none overflow-hidden">
        <svg 
          className="absolute bottom-0 w-[200%] h-full animate-wave opacity-25" 
          viewBox="0 0 1200 100" 
          preserveAspectRatio="none"
        >
          <path 
            d="M0,50 C150,20 350,80 600,50 C850,20 1050,80 1200,50 L1200,100 L0,100 Z" 
            fill="url(#waveGradient1)" 
          />
          <defs>
            <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <svg 
          className="absolute bottom-0 w-[200%] h-full animate-wave opacity-20" 
          viewBox="0 0 1200 100" 
          preserveAspectRatio="none"
          style={{ animationDelay: "-2s", animationDuration: "12s" }}
        >
          <path 
            d="M0,60 C200,30 400,90 600,60 C800,30 1000,90 1200,60 L1200,100 L0,100 Z" 
            fill="url(#waveGradient2)" 
          />
          <defs>
            <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
