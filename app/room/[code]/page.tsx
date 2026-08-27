import { RoomClient } from "@/components/game/RoomClient";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase().slice(0, 6)} />;
}
