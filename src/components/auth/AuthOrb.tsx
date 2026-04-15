import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

interface LandingOrbProps {
  size?: number;
  className?: string;
}

export function LandingOrb({ size = 280, className = '' }: LandingOrbProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Parallax transforms
  const rotateX = useTransform(smoothY, [-300, 300], [15, -15]);
  const rotateY = useTransform(smoothX, [-300, 300], [-15, 15]);
  const highlightX = useTransform(smoothX, [-300, 300], [-30, 30]);
  const highlightY = useTransform(smoothY, [-300, 300], [-30, 30]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer Intense Glow - Layer 1 */}
      <motion.div
        className="absolute inset-[-60%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,242,0.15) 0%, rgba(0,255,242,0.05) 40%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Outer Intense Glow - Layer 2 */}
      <motion.div
        className="absolute inset-[-40%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(34,211,238,0.25) 0%, rgba(0,255,242,0.1) 50%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />

      {/* Outer Intense Glow - Layer 3 (Core Glow) */}
      <motion.div
        className="absolute inset-[-20%] rounded-full blur-2xl"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,242,0.4) 0%, rgba(34,211,238,0.2) 50%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Glowing Ring 1 - Outer */}
      <motion.div
        className="absolute inset-[-15%] rounded-full border-2"
        style={{
          borderColor: 'rgba(0,255,242,0.3)',
          boxShadow: '0 0 20px rgba(0,255,242,0.4), inset 0 0 20px rgba(0,255,242,0.1)',
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {/* Orbiting Particles */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{
            background: '#00fff2',
            boxShadow: '0 0 15px 5px rgba(0,255,242,0.8)',
          }}
        />
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full"
          style={{
            background: '#22d3ee',
            boxShadow: '0 0 10px 3px rgba(34,211,238,0.8)',
          }}
        />
      </motion.div>

      {/* Glowing Ring 2 - Middle */}
      <motion.div
        className="absolute inset-[-5%] rounded-full border"
        style={{
          borderColor: 'rgba(0,255,242,0.4)',
          boxShadow: '0 0 15px rgba(0,255,242,0.5), inset 0 0 15px rgba(0,255,242,0.15)',
        }}
        animate={{ rotate: -360 }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <div 
          className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
          style={{
            background: '#00fff2',
            boxShadow: '0 0 12px 4px rgba(0,255,242,0.7)',
          }}
        />
      </motion.div>

      {/* Glowing Ring 3 - Inner */}
      <motion.div
        className="absolute inset-[5%] rounded-full border"
        style={{
          borderColor: 'rgba(0,255,242,0.5)',
          boxShadow: '0 0 10px rgba(0,255,242,0.6), inset 0 0 10px rgba(0,255,242,0.2)',
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <div 
          className="absolute bottom-1/2 left-0 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full"
          style={{
            background: '#22d3ee',
            boxShadow: '0 0 10px 3px rgba(34,211,238,0.8)',
          }}
        />
      </motion.div>

      {/* Main Orb with Parallax */}
      <motion.div
        className="absolute inset-[10%] rounded-full"
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Orb Core with Intense Glow */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #00fff2 0%, #22d3ee 30%, #06b6d4 60%, #0891b2 100%)',
            boxShadow: `
              0 0 60px rgba(0,255,242,0.6),
              0 0 120px rgba(0,255,242,0.4),
              0 0 180px rgba(0,255,242,0.2),
              inset 0 0 60px rgba(255,255,255,0.3)
            `,
          }}
          animate={{
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Surface Texture */}
          <div 
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background: `
                radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 40%),
                radial-gradient(circle at 70% 60%, rgba(0,0,0,0.2) 0%, transparent 30%)
              `,
            }}
          />

          {/* Inner Gradient Overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/40" />
          
          {/* Moving Highlight Spot */}
          <motion.div
            className="absolute w-1/3 h-1/3 rounded-full blur-xl"
            style={{
              x: highlightX,
              y: highlightY,
              top: '10%',
              left: '10%',
              background: 'rgba(255,255,255,0.7)',
            }}
          />

          {/* Secondary Highlight */}
          <motion.div
            className="absolute bottom-[15%] right-[15%] w-1/4 h-1/4 rounded-full bg-white/30 blur-lg"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          />

          {/* Core Center Glow */}
          <div 
            className="absolute inset-[25%] rounded-full blur-md"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(0,255,242,0.3) 50%, transparent 70%)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Pulse Waves - More Intense */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-[10%] rounded-full"
          style={{
            border: '2px solid rgba(0,255,242,0.5)',
            boxShadow: '0 0 10px rgba(0,255,242,0.3)',
          }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{
            scale: [1, 2, 2.5],
            opacity: [0.6, 0.2, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 0.75,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Floating Particles Around Orb */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * 360;
        const radius = 45 + Math.random() * 15;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;
        
        return (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: `calc(50% + ${y}%)`,
              left: `calc(50% + ${x}%)`,
              background: '#00fff2',
              boxShadow: '0 0 8px 2px rgba(0,255,242,0.8)',
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: [0, -10, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
}
