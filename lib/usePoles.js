"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function usePoles(enabled) {
  const [poles, setPoles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, "device"),
      (snap) => setPoles(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setError("You do not have permission to read the data. Ask an admin to check your account.")
    );
  }, [enabled]);

  return { poles, error };
}
