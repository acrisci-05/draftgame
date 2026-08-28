import { VoteClient } from "./VoteClient";

export default async function VotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VoteClient resultId={id} />;
}
