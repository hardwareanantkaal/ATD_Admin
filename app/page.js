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
        // New accounts are always plain users. An admin promotes them later.
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

  return (
    <main className="login">
      <h1>Sensor readings, as they arrive.</h1>
      <p className="lede">
        Sign in to see the latest temperature and humidity sent by the ESP32, plus everything stored before it.
      </p>

      <form onSubmit={submit} className="login-form">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
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
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Please wait" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
        >
          {mode === "signup" ? "I already have an account" : "Create a new account"}
        </button>
      </form>
    </main>
  );
}
