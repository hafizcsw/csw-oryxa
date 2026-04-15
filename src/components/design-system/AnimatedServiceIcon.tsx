import { motion, Variants, useInView } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface AnimatedServiceIconProps {
  icon: LucideIcon;
  iconKey: string;
  iconColor: string;
  isHovered: boolean;
  isArabic: boolean;
  triggerOnScroll?: boolean;
}

// Get animation variants based on service type
const getAnimationVariants = (iconKey: string, isArabic: boolean): Variants => {
  const normalizedKey = iconKey.toLowerCase();
  
  // Airport - plane takes off with trail effect
  if (['plane', 'airport', 'flight'].includes(normalizedKey)) {
    return {
      idle: { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 },
      hover: {
        x: isArabic ? -35 : 35,
        y: -25,
        rotate: isArabic ? 30 : -30,
        scale: 1.1,
        opacity: [1, 0.95, 0.85],
        transition: { 
          duration: 0.7, 
          ease: [0.25, 0.46, 0.45, 0.94],
          opacity: { duration: 0.7 }
        }
      },
      scrollIn: {
        x: [isArabic ? 40 : -40, 0],
        y: [20, 0],
        rotate: [isArabic ? -20 : 20, 0],
        opacity: [0, 1],
        scale: [0.8, 1],
        transition: { 
          duration: 0.8, 
          ease: "easeOut"
        }
      }
    };
  }
  
  // Translation - 3D page flip effect
  if (['translation', 'translation_russia', 'document'].includes(normalizedKey)) {
    return {
      idle: { rotateY: 0, scale: 1, opacity: 1 },
      hover: {
        rotateY: [0, -15, 180],
        scale: [1, 1.05, 1.1],
        transition: { 
          duration: 0.6, 
          ease: "easeInOut",
          times: [0, 0.2, 1]
        }
      },
      scrollIn: {
        rotateY: [90, 0],
        scale: [0.7, 1],
        opacity: [0, 1],
        transition: { 
          duration: 0.7, 
          ease: "easeOut"
        }
      }
    };
  }
  
  // Accommodation - house appears with bounce
  if (['home', 'house', 'accommodation'].includes(normalizedKey)) {
    return {
      idle: { scale: 1, rotate: 0, y: 0 },
      hover: {
        scale: [1, 1.18, 1.08, 1.12],
        rotate: [0, -4, 4, 0],
        transition: {
          duration: 0.7,
          times: [0, 0.3, 0.6, 1],
          ease: "easeInOut"
        }
      },
      scrollIn: {
        y: [30, -8, 0],
        scale: [0.6, 1.05, 1],
        opacity: [0, 1, 1],
        transition: { 
          duration: 0.8,
          times: [0, 0.6, 1],
          ease: "easeOut"
        }
      }
    };
  }
  
  // Bank - coins bounce and stack
  if (['bank', 'banknote'].includes(normalizedKey)) {
    return {
      idle: { y: 0, rotate: 0, scale: 1 },
      hover: {
        y: [0, -15, 0, -10, 0, -5, 0],
        rotate: [0, -8, 8, -5, 5, -2, 0],
        scale: [1, 1.1, 1.05, 1.08, 1.02, 1.05, 1],
        transition: {
          duration: 0.9,
          times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1],
          ease: "easeInOut"
        }
      },
      scrollIn: {
        y: [-40, 5, 0],
        scale: [0.5, 1.1, 1],
        opacity: [0, 1, 1],
        transition: { 
          duration: 0.7,
          ease: "easeOut"
        }
      }
    };
  }
  
  // Health - heartbeat with pulse waves
  if (['health', 'heart', 'medical'].includes(normalizedKey)) {
    return {
      idle: { scale: 1 },
      hover: {
        scale: [1, 1.3, 1, 1.25, 1, 1.15, 1],
        transition: {
          duration: 1,
          times: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 1],
          repeat: Infinity,
          repeatType: "loop"
        }
      },
      scrollIn: {
        scale: [0, 1.2, 0.9, 1.1, 1],
        opacity: [0, 1, 1, 1, 1],
        transition: { 
          duration: 0.8,
          times: [0, 0.3, 0.5, 0.7, 1],
          ease: "easeOut"
        }
      }
    };
  }
  
  // Education - graduation cap thrown up
  if (['graduation', 'course', 'education'].includes(normalizedKey)) {
    return {
      idle: { y: 0, rotate: 0, scale: 1 },
      hover: {
        y: [0, -20, -18],
        rotate: [0, 15, 12],
        scale: [1, 1.15, 1.1],
        transition: { 
          type: "spring", 
          stiffness: 350, 
          damping: 12,
          mass: 0.8
        }
      },
      scrollIn: {
        y: [40, -10, 0],
        rotate: [-30, 10, 0],
        scale: [0.5, 1.1, 1],
        opacity: [0, 1, 1],
        transition: { 
          duration: 0.8,
          ease: "easeOut"
        }
      }
    };
  }
  
  // SIM/Phone - vibrate with notification
  if (['sim', 'phone', 'mobile'].includes(normalizedKey)) {
    return {
      idle: { x: 0, rotate: 0, scale: 1 },
      hover: {
        x: [0, -4, 4, -4, 4, -3, 3, -2, 2, 0],
        rotate: [0, -3, 3, -3, 3, -2, 2, -1, 1, 0],
        scale: [1, 1.05, 1.05, 1.05, 1.05, 1.03, 1.03, 1.01, 1.01, 1],
        transition: { 
          duration: 0.6,
          ease: "linear"
        }
      },
      scrollIn: {
        x: [0, -5, 5, -3, 3, 0],
        rotate: [0, -5, 5, -3, 3, 0],
        scale: [0.8, 1, 1, 1, 1, 1],
        opacity: [0, 1, 1, 1, 1, 1],
        transition: { 
          duration: 0.7,
          ease: "easeOut"
        }
      }
    };
  }
  
  // Money transfer - coins cascade
  if (['money', 'transfer', 'coins'].includes(normalizedKey)) {
    return {
      idle: { y: 0, rotate: 0, scale: 1 },
      hover: {
        y: [0, -12, 0, -8, 0],
        rotate: [0, 15, -15, 10, 0],
        scale: [1, 1.1, 1.05, 1.08, 1],
        transition: {
          duration: 0.6,
          repeat: 2,
          ease: "easeInOut"
        }
      },
      scrollIn: {
        y: [-30, 0],
        rotate: [20, 0],
        scale: [0.6, 1],
        opacity: [0, 1],
        transition: { 
          duration: 0.6,
          ease: "easeOut"
        }
      }
    };
  }
  
  // Visa - stamp effect
  if (['visa', 'passport'].includes(normalizedKey)) {
    return {
      idle: { scale: 1, y: 0, rotate: 0 },
      hover: {
        scale: [1, 0.85, 1.2, 1],
        y: [0, 8, -5, 0],
        rotate: [0, -5, 3, 0],
        transition: {
          duration: 0.5,
          times: [0, 0.25, 0.6, 1],
          ease: "easeOut"
        }
      },
      scrollIn: {
        scale: [1.5, 0.9, 1.05, 1],
        y: [-30, 5, -2, 0],
        opacity: [0, 1, 1, 1],
        transition: { 
          duration: 0.6,
          times: [0, 0.4, 0.7, 1],
          ease: "easeOut"
        }
      }
    };
  }
  
  // Bitcoin/Crypto - 3D spin
  if (['bitcoin', 'crypto', 'csw-coin'].includes(normalizedKey)) {
    return {
      idle: { rotateY: 0, scale: 1 },
      hover: {
        rotateY: 360,
        scale: [1, 1.1, 1],
        transition: {
          rotateY: {
            duration: 1.2,
            ease: "linear",
            repeat: Infinity
          },
          scale: {
            duration: 0.6,
            times: [0, 0.5, 1]
          }
        }
      },
      scrollIn: {
        rotateY: [180, 0],
        scale: [0.5, 1],
        opacity: [0, 1],
        transition: { 
          duration: 0.8,
          ease: "easeOut"
        }
      }
    };
  }
  
  // Default - elegant scale and float
  return {
    idle: { scale: 1, y: 0 },
    hover: {
      scale: 1.15,
      y: -5,
      transition: { type: "spring", stiffness: 400, damping: 10 }
    },
    scrollIn: {
      scale: [0.7, 1.05, 1],
      y: [20, -5, 0],
      opacity: [0, 1, 1],
      transition: { 
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };
};

export function AnimatedServiceIcon({
  icon: Icon,
  iconKey,
  iconColor,
  isHovered,
  isArabic,
  triggerOnScroll = true
}: AnimatedServiceIconProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const variants = getAnimationVariants(iconKey, isArabic);
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  if (prefersReducedMotion) {
    return (
      <Icon 
        className={cn("w-10 h-10", iconColor)} 
        strokeWidth={1.5} 
      />
    );
  }

  // Determine animation state
  const getAnimationState = () => {
    if (isHovered) return "hover";
    if (triggerOnScroll && isInView) return "scrollIn";
    return "idle";
  };

  return (
    <motion.div
      ref={ref}
      initial="idle"
      animate={getAnimationState()}
      variants={variants}
      style={{ 
        willChange: "transform",
        transformStyle: "preserve-3d",
        perspective: "1000px"
      }}
    >
      <Icon 
        className={cn("w-10 h-10", iconColor)} 
        strokeWidth={1.5} 
      />
    </motion.div>
  );
}
