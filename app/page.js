"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";

function explain(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is wrong. Check both and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    default:
      return "Something went wrong. Check your connection and try again.";
  }
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const emailKey = cred.user.email.toLowerCase();
        await setDoc(doc(db, "users", emailKey), { email: cred.user.email, role: "user" });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(explain(err.code));
    } finally {
      setBusy(false);
    }
  }

  // Firebase restores the session asynchronously - without this the login form
  // flashes for a second before an already-signed-in user gets redirected.
  if (loading || user) {
    return (
      <main className="center">
        <div className="brand-icon">ATD</div>
        <div className="spinner" />
        <span>Loading ATD Monitor...</span>
      </main>
    );
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">ATD</div>
          <span style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Telemetry Portal</span>
        </div>

        <h1>{mode === "signup" ? "Create an account" : "Sign in to portal"}</h1>
        <p className="lede">
          Access real-time sensor displacement, temperature, and battery telemetry transmitted by ESP32 devices.
        </p>

        <form onSubmit={submit} className="login-form">
          <label>
            Email Address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@company.com" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
          <button
            type="button"
            className="link"
            style={{ textAlign: "center", marginTop: "0.5rem" }}
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </form>
      </div>
    </main>
  );
}
