import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageRevealProps {
  children: ReactNode;
  delay?: number;
}

const PageReveal = ({ children, delay = 0 }: PageRevealProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
};

export default PageReveal;