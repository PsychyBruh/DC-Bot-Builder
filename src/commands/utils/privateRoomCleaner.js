import { getAllRooms, removeRoom, touchRoom } from "../../storage/privateRooms.js";

let interval = null;
const TEXT_IDLE_MS = 10 * 60 * 1000;
const VOICE_EMPTY_MS = 30 * 1000;

export function startPrivateRoomCleaner(client) {
  if (interval) return;
  interval = setInterval(async () => {
    const rooms = getAllRooms();
    const now = Date.now();
    for (const room of rooms) {
      try {
        const ch = await client.channels.fetch(room.id).catch(() => null);
        if (!ch) {
          removeRoom(room.id);
          continue;
        }
        const isVoice = ch.isVoiceBased();
        if (isVoice) {
          if (ch.members.size === 0 && now - (room.lastActivity || now) > VOICE_EMPTY_MS) {
            await ch.delete("private room empty").catch(() => {});
            removeRoom(room.id);
          } else if (ch.members.size > 0) {
            touchRoom(room.id);
          }
        } else {
          if (now - (room.lastActivity || now) > TEXT_IDLE_MS) {
            await ch.delete("private room idle").catch(() => {});
            removeRoom(room.id);
          }
        }
      } catch (err) {
        removeRoom(room.id);
      }
    }
  }, 60_000);
}
