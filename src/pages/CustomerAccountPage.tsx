import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, useSearchParams } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import CustomerRentals from "../components/account/CustomerRentals";
import SEO from "../components/seo/SEO";
import { supabase } from "../lib/supabase";

const control = "mt-1 w-full rounded-lg border border-[#786655] bg-[#14120f] px-3 py-3 text-[#fff7ed]";
export default function CustomerAccountPage() {
  const [params] = useSearchParams();
  const reset = params.get("mode") === "reset";
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setSession(session); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setChecking(false); if (error) setError(error.message); }
    }).catch(() => { if (active) { setChecking(false); setError("Could not check your sign-in. Reload to try again."); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setError(""); setMessage(""); setBusy(true);
    try {
      if (reset) {
        if (!session) throw new Error("Open the password recovery link from your email.");
        if (password !== confirm) throw new Error("The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword(""); setConfirm(""); setMessage("Password updated. Open My rentals to continue.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/account?mode=reset` });
        if (error) throw error;
        setMessage("If this email has an account, a recovery link will arrive shortly.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/account` } });
        if (error) throw error;
        setPassword(""); setMessage(data.session ? "Account created." : "Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not complete this request. Please try again."); }
    finally { setBusy(false); }
  };
  return <MainLayout><SEO title="My account | Urban Cowboy Rentals" description="Sign in to view your rentals and documents." noIndex />
    <div className="mx-auto max-w-3xl px-4 py-16 text-[#fff7ed]">
      <h1 className="text-3xl font-bold">{reset ? "Set a new password" : "My account"}</h1>
      {checking ? <p className="mt-5" role="status">Checking sign-in…</p> : session && !reset ? <>
        <div className="mt-4 flex flex-wrap items-center gap-4"><p className="break-all text-sm">{session.user.email}</p><button disabled={busy} className="underline" onClick={async () => {
          setBusy(true); setError("");
          try { const { error } = await supabase.auth.signOut(); if (error) throw error; }
          catch { setError("Could not sign out. Try again."); }
          finally { setBusy(false); }
        }}>Sign out</button></div>
        <CustomerRentals key={session.user.id} userId={session.user.id} />
      </> : <>
        {!reset && <div className="mt-5 flex flex-wrap gap-3">
          {([['signin', 'Sign in'], ['signup', 'Create account'], ['forgot', 'Forgot password']] as const).map(([value, label]) => <button key={value} aria-pressed={mode === value} className="rounded-lg border border-[#786655] px-3 py-2 aria-pressed:bg-[#f4b000]/15" onClick={() => { setMode(value); setError(""); setMessage(""); setPassword(""); }}>{label}</button>)}
        </div>}
        {reset && !session ? <p className="mt-5">Open the recovery link from your email to set your password.</p> : <form onSubmit={event => void submit(event)} className="mt-6 max-w-md space-y-4">
          {mode === "signup" && !reset && <label className="block">Full name<input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={control} /></label>}
          {!reset && <label className="block">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={control} /></label>}
          {(reset || mode !== "forgot") && <label className="block">{reset ? "New password" : "Password"}<input required type="password" minLength={mode === "signup" || reset ? 8 : undefined} autoComplete={reset || mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} className={control} /></label>}
          {reset && <label className="block">Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className={control} /></label>}
          <button disabled={busy} className="rounded-lg bg-[#f4b000] px-5 py-3 font-semibold text-black">{busy ? "Please wait…" : reset ? "Update password" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send recovery email" : "Sign in"}</button>
        </form>}
      </>}
      {error && <p className="mt-4 text-red-200" role="alert">{error}</p>}
      {message && <p className="mt-4" role="status">{message}</p>}
      {reset && <Link to="/account" className="mt-5 block underline">My rentals</Link>}
    </div>
  </MainLayout>;
}
