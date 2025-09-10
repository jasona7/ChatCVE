'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
  delay?: number
  duration?: number
  scale?: number
  y?: number
  clickable?: boolean
}

export function MotionCard({ 
  children, 
  className,
  hover = true,
  delay = 0,
  duration = 0.2,
  scale = 1.02,
  y = -4,
  clickable = false,
  ...props 
}: MotionCardProps) {
  const motionProps: HTMLMotionProps<"div"> = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { 
      duration: 0.3, 
      delay,
      ease: "easeOut"
    },
    ...(hover && {
      whileHover: { 
        scale,
        y,
        transition: { duration }
      }
    }),
    ...(clickable && {
      whileTap: { scale: 0.98 }
    })
  }

  return (
    <motion.div {...motionProps}>
      <Card 
        className={cn(
          "transition-shadow duration-200",
          hover && "hover:shadow-lg hover:shadow-primary/5",
          clickable && "cursor-pointer",
          className
        )} 
        {...props}
      >
        {children}
      </Card>
    </motion.div>
  )
}
