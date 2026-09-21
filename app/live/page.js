import { Suspense } from "react";
import LiveContent from "./LiveContent";

export default function LivePage() {
  return (
    <Suspense fallback={<main className="center">Loading</main>}>
      <LiveContent />
    </Suspense>
  );
}
