"use client";

import { motion } from "framer-motion";

// Next.js App Router: este template se monta en cada navegacion,
// permitiendo animar la transicion entre modulos sin tocar cada page.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
