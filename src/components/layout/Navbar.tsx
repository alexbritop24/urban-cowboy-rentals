import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import logo from "../../assets/urban-cowboy-logo.jpeg";

const links = [
  { label: "Home", href: "/" },
  { label: "Equipment", href: "/equipment" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-yellow-500/10 bg-black/60 px-5 py-3 backdrop-blur-2xl shadow-2xl shadow-black/40 md:px-8 md:py-4">
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3 md:gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-yellow-500/10 bg-[#11100d] p-1.5 md:h-16 md:w-16">
              <img
                src={logo}
                alt="Urban Cowboy Rentals"
                className="h-full w-full rounded-xl object-cover"
              />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#f4b000] md:text-xs md:tracking-[0.35em]">
                Urban Cowboy
              </p>

              <p className="text-xl font-black tracking-tight text-[#fff7ed] md:text-2xl">
                Rentals
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `relative text-sm font-black uppercase tracking-[0.16em] transition duration-300 ${
                    isActive
                      ? "text-[#fff7ed]"
                      : "text-[#a89a8a] hover:text-[#fff7ed]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    <span
                      className={`absolute -bottom-3 left-0 h-[2px] rounded-full bg-[#f4b000] transition-all duration-300 ${
                        isActive ? "w-full" : "w-0"
                      }`}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <Link
            to="/book"
            className="hidden rounded-full bg-[#f4b000] px-7 py-4 text-sm font-black uppercase tracking-[0.14em] text-black transition duration-300 hover:scale-[1.03] hover:bg-[#f59e0b] hover:shadow-2xl hover:shadow-yellow-500/20 md:block"
          >
            Request Rental
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/10 bg-[#11100d] text-[#fff7ed] md:hidden"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 bg-[#050402]/95 px-6 pt-32 backdrop-blur-2xl md:hidden"
          >
            <div className="gold-line mb-10" />

            <nav className="flex flex-col gap-5">
              {links.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <NavLink
                    to={link.href}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `block rounded-3xl border px-6 py-5 text-3xl font-black tracking-tight transition ${
                        isActive
                          ? "border-yellow-500/40 bg-[#f4b000] text-black"
                          : "border-yellow-500/10 bg-[#11100d] text-[#fff7ed]"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </motion.div>
              ))}
            </nav>

            <Link
              to="/book"
              onClick={closeMenu}
              className="mt-8 block rounded-full bg-[#f4b000] px-8 py-5 text-center text-sm font-black uppercase tracking-[0.14em] text-black"
            >
              Request Rental
            </Link>

            <div className="mt-10 rounded-[2rem] border border-yellow-500/10 bg-[#11100d] p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f4b000]">
                Contact
              </p>

              <p className="mt-4 text-lg font-black text-[#fff7ed]">
                801-903-9380
              </p>

              <p className="mt-2 text-sm text-[#b8a99a]">
                urbancowboyrentals@gmail.com
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;