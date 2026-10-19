(() => {
  const client = window.NAVAI_SUPABASE_CLIENT;
  const bridge = window.NAVAI_CHAT_BRIDGE;
  if (!client || !bridge) {
    console.error("NavAI cloud sync: auth client or chat bridge missing.");
    return;
  }

  const OWNER_KEY = "navai_chat_owner";
  const DELETED_KEY = "navai_deleted_chat_ids";
  let userId = null;
  let timer = null;
  let syncing = false;

  function readDeleted() {
    try {
      const value = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch { return []; }
  }

  function writeDeleted(ids) {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(ids.map(String))]));
  }

  async function syncSnapshot(snapshot) {
    if (!userId || syncing) return;
    const uid = userId;
    const rows = snapshot.map(chat => ({
      user_id: uid,
      id: String(chat.id),
      title: String(chat.title || "New chat"),
      messages: Array.isArray(chat.messages) ? chat.messages : [],
      updated_at: Number(chat.updatedAt || Date.now())
    }));

    if (!rows.length) return;
    const { error } = await client.from("navai_chats").upsert(rows, {
      onConflict: "user_id,id"
    });
    if (error) console.error("NavAI chat sync failed:", error.message);
  }

  async function loadAccount(session) {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    if (userId === uid) return;

    userId = uid;
    syncing = true;

    try {
      const { data, error } = await client
        .from("navai_chats")
        .select("id,title,messages,updated_at")
        .eq("user_id", uid);

      if (error) throw error;

      // Only merge anonymous/local chats into the first account that claims them.
      const owner = localStorage.getItem(OWNER_KEY);
      const localChats = (!owner || owner === uid) ? bridge.getChats() : [];
      const deleted = readDeleted();

      // Explicitly deleted chats are removed from this account's cloud history.
      if (deleted.length) {
        const { error: deleteError } = await client
          .from("navai_chats")
          .delete()
          .eq("user_id", uid)
          .in("id", deleted);

        if (deleteError) throw deleteError;
        writeDeleted([]);
      }

      const merged = new Map();
      for (const row of (data || [])) {
        if (deleted.includes(String(row.id))) continue;
        merged.set(String(row.id), {
          id: String(row.id),
          title: row.title || "New chat",
          messages: Array.isArray(row.messages) ? row.messages : [],
          updatedAt: Number(row.updated_at || Date.now())
        });
      }

      for (const chat of localChats) {
        if (deleted.includes(String(chat.id))) continue;
        const existing = merged.get(String(chat.id));
        if (!existing || Number(chat.updatedAt) > Number(existing.updatedAt)) {
          merged.set(String(chat.id), chat);
        }
      }

      const chats = [...merged.values()]
        .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));

      localStorage.setItem(OWNER_KEY, uid);
      bridge.replaceChats(chats);

      // Persist merged local history without replacing another user's rows.
      const rows = chats.map(chat => ({
        user_id: uid,
        id: String(chat.id),
        title: String(chat.title || "New chat"),
        messages: Array.isArray(chat.messages) ? chat.messages : [],
        updated_at: Number(chat.updatedAt || Date.now())
      }));

      if (rows.length) {
        const { error: upsertError } = await client
          .from("navai_chats")
          .upsert(rows, { onConflict: "user_id,id" });
        if (upsertError) throw upsertError;
      }
      console.info("NavAI cloud history is ready.");
    } catch (error) {
      console.error("NavAI cloud history could not load:", error.message);
    } finally {
      syncing = false;
    }
  }

  window.NAVAI_CHAT_SYNC = {
    queueSave(chats) {
      if (!userId || syncing) return;
      const snapshot = chats.map(chat => ({
        ...chat,
        messages: chat.messages.map(message => ({ ...message }))
      }));
      clearTimeout(timer);
      timer = setTimeout(() => syncSnapshot(snapshot), 700);
    },

    markDeleted(id) {
      const deleted = readDeleted();
      if (!deleted.includes(String(id))) deleted.push(String(id));
      writeDeleted(deleted);

      if (userId) {
        const uid = userId;
        client.from("navai_chats").delete()
          .eq("user_id", uid).eq("id", String(id))
          .then(({ error }) => {
            if (error) console.error("Cloud chat deletion failed:", error.message);
          });
      }
    }
  };

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id) {
      setTimeout(() => loadAccount(session), 0);
    } else {
      userId = null;
      clearTimeout(timer);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("NavAI session lookup failed:", error.message);
      return;
    }
    if (data.session) loadAccount(data.session);
  });
})();
