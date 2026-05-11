import { useState } from "react";

import MainLayout from "../components/layout/MainLayout";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";
import { supabase } from "../lib/supabase";

const AdminLoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      alert("Login failed. No session was created.");
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  };

  return (
    <PageTransition>
      <SEO
        title="Admin Login | Urban Cowboy Rentals"
        description="Secure admin access."
      />

      <MainLayout>
        <section className="px-6 py-24">
          <div className="mx-auto max-w-md">
            <div className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                Admin Access
              </p>

              <h1 className="mt-5 text-4xl font-black text-[#fff7ed]">
                Sign in.
              </h1>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#f4b000] px-8 py-5 text-lg font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
};

export default AdminLoginPage;