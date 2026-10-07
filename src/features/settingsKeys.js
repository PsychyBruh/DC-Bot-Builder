// Every per-server setting the features read. Shared by !setup and the !chat AI tools, so a
// server owner can configure everything by just telling the AI what they want.
// type: channel | role | number | toggle | text | list (comma-separated channel names/IDs)
// Channels/roles not set fall back to the default names listed in `fallback`.
export const SETTING_KEYS = {
  // --- core / roles ---
  staff_role:            { type: "role",    group: "Core",        fallback: "staff, moderator, mod", desc: "Role that counts as staff (tickets, applications, warnings…)" },
  leadership_role:       { type: "role",    group: "Core",        fallback: "leadership, owner, owners, admin", desc: "Pinged for anti-nuke alerts" },
  staff_alert_channel:   { type: "channel", group: "Core",        fallback: "staff-alerts, mod-chat, staff-chat", desc: "Where raid/nuke/alt alerts go" },
  // --- welcome / verify ---
  welcome_channel:       { type: "channel", group: "Welcome",     fallback: "welcome", desc: "Welcome message + card channel" },
  welcome_message:       { type: "text",    group: "Welcome",     desc: "Welcome text ({user}, {server}, {count})" },
  welcome_card:          { type: "toggle",  group: "Welcome",     desc: "Attach the image welcome card (default on)" },
  welcome_card_title:    { type: "text",    group: "Welcome",     desc: "Big text on the card ({server})" },
  welcome_card_background:{ type: "text",   group: "Welcome",     desc: "Image URL for the card background" },
  welcome_card_color:    { type: "text",    group: "Welcome",     desc: "Accent hex colour, e.g. #7c5cff" },
  goodbye_channel:       { type: "channel", group: "Welcome",     desc: "Goodbye message channel" },
  goodbye_message:       { type: "text",    group: "Welcome",     desc: "Goodbye text ({user}, {server})" },
  auto_role:             { type: "role",    group: "Welcome",     desc: "Role given to everyone on join" },
  verify_role:           { type: "role",    group: "Verify",      fallback: "verified, member", desc: "Role the Verify button gives" },
  unverified_role:       { type: "role",    group: "Verify",      desc: "Role given on join and removed on verify" },
  min_account_age_days:  { type: "number",  group: "Verify",      desc: "Accounts younger than this need staff approval to verify (default 3, 0 = off)" },
  // --- logging ---
  mod_log_channel:       { type: "channel", group: "Logging",     fallback: "mod-log", desc: "Bans, kicks, timeouts, role changes, warnings, AutoMod" },
  message_log_channel:   { type: "channel", group: "Logging",     fallback: "message-log", desc: "Edited/deleted messages" },
  join_leave_log_channel:{ type: "channel", group: "Logging",     fallback: "join-leave-log", desc: "Joins, leaves, verifications" },
  // --- tickets / applications ---
  ticket_log_channel:    { type: "channel", group: "Tickets",     fallback: "ticket-log", desc: "Ticket open/close logs + transcripts" },
  ticket_category:       { type: "text",    group: "Tickets",     desc: "Category ID for ticket channels (auto-created if unset)" },
  ticket_inactive_hours: { type: "number",  group: "Tickets",     desc: "Warn after this many quiet hours (default 48); auto-close at 1.5× (72)" },
  application_channel:   { type: "channel", group: "Applications",fallback: "applications, app-review", desc: "Where submitted applications go for review" },
  // --- levels ---
  rank_up_channel:       { type: "channel", group: "Levels",      fallback: "rank-ups, level-ups", desc: "Level-up / rank-up announcements" },
  levels_enabled:        { type: "toggle",  group: "Levels",      desc: "Earn XP from chatting (default on)" },
  levelup_announce:      { type: "toggle",  group: "Levels",      desc: "Post level-ups (default on)" },
  levelup_message:       { type: "text",    group: "Levels",      desc: "Level-up text ({user}, {level})" },
  xp_rate:               { type: "number",  group: "Levels",      desc: "XP multiplier (default 1, max 5)" },
  no_xp_channels:        { type: "list",    group: "Levels",      desc: "Channels that don't give XP" },
  // --- community ---
  starboard_channel:     { type: "channel", group: "Community",   fallback: "starboard, hall-of-fame", desc: "Hall of fame channel" },
  starboard_threshold:   { type: "number",  group: "Community",   desc: "Stars needed (default 3)" },
  starboard_emoji:       { type: "text",    group: "Community",   desc: "Emoji that counts (default ⭐)" },
  starboard_media_only:  { type: "toggle",  group: "Community",   desc: "Only star media posts" },
  suggestion_channel:    { type: "channel", group: "Community",   fallback: "suggestions", desc: "Suggestion channel (plain messages become suggestions)" },
  suggestion_auto:       { type: "toggle",  group: "Community",   desc: "Turn plain messages in the suggestion channel into suggestions (default on)" },
  birthday_channel:      { type: "channel", group: "Community",   fallback: "birthdays, general", desc: "Birthday announcements" },
  birthday_role:         { type: "role",    group: "Community",   fallback: "birthday", desc: "Role worn on your birthday" },
  // --- safety ---
  antiraid_enabled:      { type: "toggle",  group: "Safety",      desc: "Anti-raid mode (default on)" },
  raid_join_threshold:   { type: "number",  group: "Safety",      desc: "Joins that trigger raid mode (default 10)" },
  raid_window_seconds:   { type: "number",  group: "Safety",      desc: "…within this many seconds (default 30)" },
  raid_lock_minutes:     { type: "number",  group: "Safety",      desc: "Auto-unlock after (default 10)" },
  antinuke_enabled:      { type: "toggle",  group: "Safety",      desc: "Anti-nuke (default on)" },
  antinuke_delete_threshold:{ type: "number", group: "Safety",    desc: "Channel/role deletions per minute that trigger it (default 3)" },
  antinuke_ban_threshold:{ type: "number",  group: "Safety",      desc: "Bans per minute that trigger it (default 5)" },
  antinuke_whitelist:    { type: "list",    group: "Safety",      desc: "User IDs exempt from anti-nuke (owner + bot are always exempt)" },
  scam_filter:           { type: "toggle",  group: "Safety",      desc: "Delete scam/phishing links & QR codes and time out sender (default on)" },
  mention_spam_limit:    { type: "number",  group: "Safety",      desc: "Unique user pings in one message that trigger a timeout (default 5, 0 = off)" },
  spam_filter_channels:  { type: "list",    group: "Safety",      fallback: "general, chat", desc: "Channels where caps/emoji spam is deleted" },
  warn_thresholds:       { type: "text",    group: "Safety",      desc: "Strikes→action, default \"3:1h,5:1d,7:ban\"" },
  warn_expiry_days:      { type: "number",  group: "Safety",      desc: "Strikes expire after (default 30)" },
  // --- keeping it clean ---
  bot_commands_channel:  { type: "channel", group: "Clean",       fallback: "bot-commands, commands", desc: "Commands used elsewhere get deleted with a DM reminder" },
  enforce_bot_channel:   { type: "toggle",  group: "Clean",       desc: "Enforce the bot commands channel (default on if it exists)" },
  autothread_channels:   { type: "list",    group: "Clean",       fallback: "looking-for-group, lfg, media", desc: "Each post gets its own thread" },
  media_only_channels:   { type: "list",    group: "Clean",       fallback: "fan-art, clips, screenshots", desc: "Text-only messages are deleted" },
  bug_forum:             { type: "channel", group: "Clean",       fallback: "bug-reports, bugs", desc: "Bug report forum (solved → locked after 7d, Confirmed → bridged)" },
  suggestion_forum:      { type: "channel", group: "Clean",       fallback: "suggestions", desc: "Suggestion forum (Denied → archived)" },
  // --- running itself ---
  roblox_universe_id:    { type: "text",    group: "Roblox",      desc: "Roblox universe ID for status / leaderboards" },
  status_channel:        { type: "channel", group: "Roblox",      fallback: "status, game-status", desc: "Live game status embed" },
  status_voice_channel:  { type: "text",    group: "Roblox",      desc: "Voice channel ID renamed to the player count (auto-created if unset)" },
  updates_channel:       { type: "channel", group: "Roblox",      fallback: "updates, patch-notes, announcements", desc: "Formatted patch notes are posted here" },
  update_ping_role:      { type: "role",    group: "Roblox",      fallback: "update ping, updates", desc: "Pinged for new updates" },
  patch_source_channel:  { type: "channel", group: "Roblox",      fallback: "patch-notes-draft, github-feed, dev-feed", desc: "Raw patch notes/webhook posts the bot reformats" },
  report_channel:        { type: "channel", group: "Roblox",      fallback: "admin-chat, staff-chat", desc: "Weekly server report" },
  leaderboard_channel:   { type: "channel", group: "Roblox",      fallback: "leaderboards", desc: "Daily in-game leaderboard posts" },
  linked_role:           { type: "role",    group: "Roblox",      fallback: "linked", desc: "Role for members who linked Roblox" },
  tester_role:           { type: "role",    group: "Roblox",      fallback: "tester, testers", desc: "Pinged for playtests" },
  playtest_channel:      { type: "channel", group: "Roblox",      fallback: "playtests, playtest", desc: "Playtest announcements" },
  tester_vc:             { type: "text",    group: "Roblox",      desc: "Voice channel ID opened during playtests" },
  bug_confirmed_channel: { type: "channel", group: "Roblox",      fallback: "confirmed-bugs, dev-bugs", desc: "Confirmed bug reports are copied here" },
  github_repo:           { type: "text",    group: "Roblox",      desc: "owner/repo to open issues for confirmed bugs (needs GITHUB_TOKEN in .env)" },
  sotw_channel:          { type: "channel", group: "Roblox",      fallback: "screenshots", desc: "Screenshot of the Week source channel" },
};

export function describeSettings() {
  return Object.entries(SETTING_KEYS).map(([k, v]) => `${k} (${v.type}): ${v.desc}`).join("\n");
}
