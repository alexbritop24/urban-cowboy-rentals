import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import type { EquipmentItem } from "../../types/equipment";

interface EquipmentCardProps {
  equipment: EquipmentItem;
}

const EquipmentCard = ({ equipment }: EquipmentCardProps) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -10 }}
      className="group relative overflow-hidden rounded-[2rem] border border-yellow-500/10 bg-[#0d0b08] shadow-2xl shadow-black/30 transition duration-300 hover:border-yellow-500/40"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#f4b000]/10 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[#7f1d1d]/10 blur-3xl" />
      </div>

      <div className="relative flex h-64 items-center justify-center border-b border-yellow-500/10 bg-gradient-to-br from-[#17130e] via-[#0d0b08] to-[#050402]">
        <span className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]/70 transition duration-300 group-hover:tracking-[0.45em]">
          Image Coming Soon
        </span>

        <div className="absolute left-5 top-5 rounded-full bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f4b000] backdrop-blur-xl">
          {equipment.category}
        </div>
      </div>

      <div className="relative p-7">
        <h3 className="text-2xl font-black leading-tight text-[#fff7ed] transition duration-300 group-hover:text-[#f4b000]">
          {equipment.name}
        </h3>

        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[#b8a99a]">
          {equipment.description}
        </p>

        <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/35 p-5 transition duration-300 group-hover:border-yellow-500/30">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8f8577]">
            Starting at
          </p>

          <p className="mt-2 text-4xl font-black text-[#f4b000]">
            ${equipment.startingPrice}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {equipment.specs.slice(0, 3).map((spec) => (
            <div
              key={spec}
              className="flex items-center gap-3 text-sm text-[#b8a99a]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#f4b000]" />
              {spec}
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            to={`/equipment/${equipment.id}`}
            className="rounded-full border border-yellow-500/20 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed] transition hover:border-yellow-500/50 hover:bg-[#1a1612]"
          >
            Details
          </Link>

          <Link
            to={`/book?equipment=${equipment.id}`}
            className="rounded-full bg-[#f4b000] px-4 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#f59e0b]"
          >
            Request
          </Link>
        </div>
      </div>
    </motion.article>
  );
};

export default EquipmentCard;