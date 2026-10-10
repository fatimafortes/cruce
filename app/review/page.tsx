import { ProtectedPlaceholder } from "@/components/protected-placeholder";

// Sign-in only for now; the reviewers-only check comes in F6.
export default function ReviewPage() {
  return <ProtectedPlaceholder path="/review" title="Revisión" />;
}
