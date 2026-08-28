/**
 * Registro delle stanze tenuto dal server.
 *
 * Serve a far parlare dispositivi diversi quando non è configurato un database:
 * ogni partecipante apre uno stream verso il server e gli manda i propri messaggi,
 * il server li ridistribuisce agli altri. Funziona da qualsiasi rete purché il
 * dispositivo raggiunga il server (stessa Wi-Fi via indirizzo IP, oppure il sito
 * pubblicato su un host Node sempre attivo).
 *
 * Lo stato vive in memoria: è un canale di passaggio, non un archivio.
 */

export interface RoomClient {
  id: string;
  send: (payload: string) => void;
}

interface Room {
  clients: Map<string, RoomClient>;
  /** Ultimo stato inviato da chi ospita: serve a chi entra o ricarica. */
  lastState: string | null;
  updatedAt: number;
}

const rooms = new Map<string, Room>();

/** Le stanze inattive vengono dimenticate dopo un'ora. */
const ROOM_TTL_MS = 60 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.clients.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function getRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = { clients: new Map(), lastState: null, updatedAt: Date.now() };
    rooms.set(code, room);
  }
  return room;
}

export function joinRoom(code: string, client: RoomClient): string | null {
  sweep();
  const room = getRoom(code);
  room.clients.set(client.id, client);
  room.updatedAt = Date.now();
  return room.lastState;
}

export function leaveRoom(code: string, clientId: string) {
  const room = rooms.get(code);
  if (!room) return;
  room.clients.delete(clientId);
  room.updatedAt = Date.now();
}

/** Inoltra un messaggio a tutti gli altri partecipanti della stanza. */
export function publish(code: string, senderId: string, payload: string, isState: boolean) {
  const room = getRoom(code);
  room.updatedAt = Date.now();
  if (isState) room.lastState = payload;

  for (const [id, client] of room.clients) {
    if (id === senderId) continue;
    try {
      client.send(payload);
    } catch {
      room.clients.delete(id);
    }
  }
}

export function roomSize(code: string): number {
  return rooms.get(code)?.clients.size ?? 0;
}

export function roomIds(code: string): string[] {
  return [...(rooms.get(code)?.clients.keys() ?? [])];
}
