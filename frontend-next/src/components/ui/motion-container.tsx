'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MotionContainerProps {
  children: React.ReactNode
  className?: string
  stagger?: number
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  distance?: number
}

export function MotionContainer({ 
  children, 
  className,
  stagger = 0.1,
  delay = 0,
  direction = 'up',
  distance = 20
}: MotionContainerProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: distance }
      case 'down': return { y: -distance }
      case 'left': return { x: distance }
      case 'right': return { x: -distance }
      default: return { y: distance }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delay,
        staggerChildren: stagger,
        delayChildren: delay
      }
    }
  }

  const itemVariants = {
    hidden: { 
      opacity: 0,
      ...getInitialPosition()
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 0.4
      }
    }
  }

  return (
    <motion.div
      className={cn("", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

// Individual motion item for manual control
export function MotionItem({ 
  children, 
  className,
  delay = 0,
  direction = 'up',
  distance = 20,
  duration = 0.4
}: Omit<MotionContainerProps, 'stagger'> & { duration?: number }) {
  const getInitialPosition = () => {
    switch (direction) {
      case 'up': return { y: distance }
      case 'down': return { y: -distance }
      case 'left': return { x: distance }
      case 'right': return { x: -distance }
      default: return { y: distance }
    }
  }

  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0,
        ...getInitialPosition()
      }}
      animate={{
        opacity: 1,
        x: 0,
        y: 0
      }}
      transition={{
        duration,
        delay
      }}
    >
      {children}
    </motion.div>
  )
}
