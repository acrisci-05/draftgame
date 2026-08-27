import { SharedCategoryClient } from "./SharedCategoryClient";

export default async function SharedCategoryPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedCategoryClient shareId={shareId} />;
}
