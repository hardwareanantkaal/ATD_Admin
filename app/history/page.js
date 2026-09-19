import { Suspense } from "react";
import HistoryContent from "./HistoryContent";

export default function HistoryPage() {
  return (
    <Suspense fallback={<main className="center">Loading</main>}>
      <HistoryContent />
    </Suspense>
  );
}
