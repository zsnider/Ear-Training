// chat.js — SonicSandbox Battle Chat
// Provides BattleChat for the public Battle Board feed and direct messages.
//
// Depends on:
//   • supabase UMD (cdn.jsdelivr.net/npm/@supabase/supabase-js@2)
//   • supabase-client.js — exposes window.SonicSandbox with getUser() and getProfile()
//
// Usage (all methods return Promises unless noted):
//   BattleChat.subscribeToForum()           — start realtime forum feed
//   BattleChat.on('newPost', fn)            — new public post arrived
//   BattleChat.on('deletePost', fn)         — a post was deleted (fn gets { id })
//   BattleChat.on('newDM', fn)              — new DM arrived for the logged-in user
//   BattleChat.loadForum(limit?)            — load recent posts (oldest first)
//   BattleChat.postToForum(message)         — post to public feed
//   BattleChat.deletePost(postId)           — delete own post
//   BattleChat.sendDM(toUsername, message)  — send a DM by username
//   BattleChat.getConversationList()        — all conversations, most-recent first
//   BattleChat.getConversation(otherUserId) — full thread with one user
//   BattleChat.markRead(senderId)           — mark sender's messages as read
//   BattleChat.getUnreadCount()             — number of unread DMs
//   BattleChat.subscribeToDMs(userId)       — realtime DM notifications
//   BattleChat.cleanup()                    — unsubscribe all channels

(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://aolaxmmrmvovbzumlybe.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_C36QQ0xF6HUcnGVliS4dnw_eRc0VKfb';

  // Separate client so chat state is independent of auth + multiplayer clients.
  // All three clients share the same underlying session (same URL+key → same
  // localStorage slot), so auth tokens are automatically available here too.
  const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { params: { eventsPerSecond: 5 } },
  });

  let _forumSub = null;
  let _dmSub    = null;

  const _cbs = {
    newPost   : [],
    deletePost: [],
    newDM     : [],
    error     : [],
  };

  function _emit(ev, payload) {
    (_cbs[ev] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[BattleChat]', e); }
    });
  }

  const BattleChat = {

    // ── Event emitter ──────────────────────────────────────────────────────

    on(ev, fn)  { if (_cbs[ev]) { _cbs[ev].push(fn); } return this; },
    off(ev, fn) { if (_cbs[ev]) { _cbs[ev] = _cbs[ev].filter(f => f !== fn); } return this; },

    // ── Forum (Battle Board) ───────────────────────────────────────────────

    /**
     * Load the most recent forum posts, returned oldest-first for display.
     * @param {number} [limit=60]
     */
    async loadForum(limit = 60) {
      const { data, error } = await _sb
        .from('battle_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) { _emit('error', error.message); return []; }
      return (data || []).reverse();
    },

    /** Subscribe to realtime inserts/deletes on battle_posts. */
    subscribeToForum() {
      if (_forumSub) { _sb.removeChannel(_forumSub); }
      _forumSub = _sb.channel('battle_posts_live')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'battle_posts' },
          ({ new: row }) => { _emit('newPost', row); }
        )
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'battle_posts' },
          ({ old: row }) => { _emit('deletePost', row); }
        )
        .subscribe();
    },

    /**
     * Post a message to the public Battle Board.
     * Requires the user to be signed in (enforced by RLS).
     * @param {string} message
     */
    async postToForum(message) {
      const user = SonicSandbox.getUser();
      if (!user) return { error: { message: 'Sign in to post.' } };
      const profile = await SonicSandbox.getProfile();
      const username = profile?.username || user.email.split('@')[0];
      const { error } = await _sb.from('battle_posts').insert({
        user_id : user.id,
        username,
        message : message.trim(),
      });
      if (error) _emit('error', error.message);
      return { error };
    },

    /**
     * Delete one of your own Battle Board posts.
     * @param {number} postId
     */
    async deletePost(postId) {
      const { error } = await _sb.from('battle_posts').delete().eq('id', postId);
      if (error) _emit('error', error.message);
      return { error };
    },

    // ── Direct Messages ────────────────────────────────────────────────────

    /**
     * Send a direct message to any registered user by their username.
     * @param {string} recipientUsername  — case-insensitive; may include leading @
     * @param {string} message
     */
    async sendDM(recipientUsername, message) {
      const user = SonicSandbox.getUser();
      if (!user) return { error: { message: 'Sign in to send messages.' } };

      const profile = await SonicSandbox.getProfile();
      const senderUsername = profile?.username || user.email.split('@')[0];

      const handle = recipientUsername.replace(/^@/, '').trim();

      const { data: recipient } = await _sb
        .from('profiles')
        .select('id, username')
        .ilike('username', handle)
        .maybeSingle();

      if (!recipient) {
        return { error: { message: `User "@${handle}" not found.` } };
      }
      if (recipient.id === user.id) {
        return { error: { message: "You can't message yourself." } };
      }

      const { error } = await _sb.from('direct_messages').insert({
        sender_id          : user.id,
        sender_username    : senderUsername,
        recipient_id       : recipient.id,
        recipient_username : recipient.username,
        message            : message.trim(),
      });
      if (error) _emit('error', error.message);
      return { error };
    },

    /**
     * Load all messages sent to or from the current user (full inbox).
     * Returns messages sorted oldest-first.
     */
    async loadInbox() {
      const user = SonicSandbox.getUser();
      if (!user) return [];
      const { data, error } = await _sb
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
      if (error) { _emit('error', error.message); return []; }
      return data || [];
    },

    /**
     * Return a list of unique conversations, each with the latest message
     * and unread count. Sorted most-recent-message first.
     * @returns {Array<{otherId, otherName, messages, unread}>}
     */
    async getConversationList() {
      const user = SonicSandbox.getUser();
      if (!user) return [];
      const msgs = await this.loadInbox();
      const convos = new Map();
      for (const m of msgs) {
        const mine      = m.sender_id === user.id;
        const otherId   = mine ? m.recipient_id       : m.sender_id;
        const otherName = mine ? m.recipient_username : m.sender_username;
        if (!convos.has(otherId)) {
          convos.set(otherId, { otherId, otherName, messages: [], unread: 0 });
        }
        const c = convos.get(otherId);
        c.messages.push(m);
        if (!mine && !m.read) c.unread++;
      }
      return [...convos.values()].sort((a, b) => {
        const at = a.messages.at(-1)?.created_at || '';
        const bt = b.messages.at(-1)?.created_at || '';
        return bt.localeCompare(at);
      });
    },

    /**
     * Load the full message thread between the current user and another user.
     * @param {string} otherUserId
     */
    async getConversation(otherUserId) {
      const user = SonicSandbox.getUser();
      if (!user) return [];
      const { data } = await _sb
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });
      return data || [];
    },

    /**
     * Mark all unread messages from a given sender as read.
     * @param {string} senderId
     */
    async markRead(senderId) {
      const user = SonicSandbox.getUser();
      if (!user) return;
      await _sb.from('direct_messages')
        .update({ read: true })
        .eq('sender_id', senderId)
        .eq('recipient_id', user.id)
        .eq('read', false);
    },

    /** Return the total number of unread DMs for the current user. */
    async getUnreadCount() {
      const user = SonicSandbox.getUser();
      if (!user) return 0;
      const { count } = await _sb
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      return count || 0;
    },

    /**
     * Subscribe to incoming DMs for a specific user.
     * Fires the 'newDM' event when a message arrives.
     * Must be called after the user is authenticated.
     * @param {string} userId — auth user UUID
     */
    subscribeToDMs(userId) {
      if (!userId) return;
      if (_dmSub) { _sb.removeChannel(_dmSub); }
      _dmSub = _sb.channel('dm_inbox_' + userId)
        .on('postgres_changes',
          {
            event : 'INSERT',
            schema: 'public',
            table : 'direct_messages',
            filter: `recipient_id=eq.${userId}`,
          },
          ({ new: row }) => { _emit('newDM', row); }
        )
        .subscribe();
    },

    /** Unsubscribe from all realtime channels. */
    cleanup() {
      if (_forumSub) { _sb.removeChannel(_forumSub); _forumSub = null; }
      if (_dmSub)    { _sb.removeChannel(_dmSub);    _dmSub    = null; }
    },
  };

  global.BattleChat = BattleChat;

}(window));
