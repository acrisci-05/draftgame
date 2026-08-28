import { RoomClient } from "@/components/game/RoomClient";
import { ROOM_CODE_LENGTH } from "@/lib/utils";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase().slice(0, ROOM_CODE_LENGTH)} />;
}
