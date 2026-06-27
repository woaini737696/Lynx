"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedListProps {
  items: Array<{ id: string | number }>;
  children: (item: any, index: number) => ReactNode;
  keyExtractor: (item: any) => string;
  // 容器样式，默认垂直列表布局；可传 grid 类名适配网格
  className?: string;
}

export function AnimatedList({ items, children, keyExtractor, className = "space-y-2" }: AnimatedListProps) {
  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, delay: index * 0.02 }}
          >
            {children(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
