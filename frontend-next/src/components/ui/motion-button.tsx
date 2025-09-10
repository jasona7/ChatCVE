'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MotionButtonProps extends ButtonProps {
  children: React.ReactNode
  loading?: boolean
}

export function MotionButton({ 
  children, 
  className,
  loading = false,
  disabled,
  ...props 
}: MotionButtonProps) {
  const motionProps = {
    whileHover: !disabled && !loading ? { 
      scale: 1.02,
      transition: { duration: 0.2 }
    } : undefined,
    whileTap: !disabled && !loading ? { 
      scale: 0.98,
      transition: { duration: 0.1 }
    } : undefined
  }

  return (
    <motion.div {...motionProps}>
      <Button 
        className={cn(
          "relative overflow-hidden transition-all duration-200",
          loading && "cursor-not-allowed",
          className
        )} 
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: [-100, 100],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        )}
        <span className={cn(loading && "opacity-70")}>
          {children}
        </span>
      </Button>
    </motion.div>
  )
}
