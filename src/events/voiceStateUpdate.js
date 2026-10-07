import { getRoom } from "../storage/privateRooms.js";

// Members the bot muted/deafened for a !study room, so it only undoes its own mutes.
const mutedByStudy = new Set();

export const name = "voiceStateUpdate";

export async function execute(oldState, newState) {
  const member = newState.member;
  if (!member || member.user.bot) return;
  if (oldState.channelId === newState.channelId) return;

  const joinedStudy = newState.channelId && getRoom(newState.channelId)?.study;
  try {
    if (joinedStudy) {
      if (!newState.serverMute || !newState.serverDeaf) {
        await member.voice.setMute(true, "study focus room");
        await member.voice.setDeaf(true, "study focus room");
        mutedByStudy.add(member.id);
      }
    } else if (newState.channelId && mutedByStudy.has(member.id)) {
      // Server mutes persist across channels, so lift ours when they move somewhere else.
      await member.voice.setMute(false, "left study focus room");
      await member.voice.setDeaf(false, "left study focus room");
      mutedByStudy.delete(member.id);
    }
  } catch (err) {
    console.error("study mute toggle failed:", err.message);
  }
}
