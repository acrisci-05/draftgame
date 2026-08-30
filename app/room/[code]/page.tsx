import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { ROOM_CODE_LENGTH } from "@/lib/utils";
import { RoomClient } from "@/components/game/RoomClient";

/**
 * L'anteprima del link della stanza.
 *
 * È l'indirizzo che si manda su WhatsApp per invitare: l'anteprima deve dire
 * dove si sta entrando, non ripetere la descrizione del sito. Il codice compare
 * nel titolo, così chi lo riceve capisce di cosa si tratta prima di toccarlo.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const clean = code.toUpperCase().slice(0, ROOM_CODE_LENGTH);
  const title = `Entra nella stanza ${clean} · ${APP_NAME}`;
  const description =
    "Un'asta dal vivo a budget fisso: tocca il link, scegli il tuo nome e sei dentro.";

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase().slice(0, ROOM_CODE_LENGTH)} />;
}
