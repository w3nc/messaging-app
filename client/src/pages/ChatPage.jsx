import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import { useAuth } from '../auth.jsx';

const POLL_MS = 5000;

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

// For a 1-to-1 chat, show the other person. For a group, show the group name.
function chatTitle(convo, meId) {
  if (convo.isGroup) return convo.name || 'Group chat';
  const other = convo.members.find((m) => m.id !== meId);
  return other ? other.displayName : 'Chat';
}

function chatOther(convo, meId) {
  return convo.isGroup ? null : convo.members.find((m) => m.id !== meId) || null;
}

function Avatar({ person, name, size = 40 }) {
  const label = name || (person && person.displayName) || '?';
  const style = {
    width: size,
    height: size,
    background: (person && person.avatarColor) || '#00a884',
  };
  if (person && person.avatarUrl) {
    return <img className="avatar avatar--photo" style={{ width: size, height: size }} src={mediaUrl(person.avatarUrl)} alt="" />;
  }
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(label)}
    </span>
  );
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { user, guest, signOut } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [memberPopup, setMemberPopup] = useState(null);
  const [memberText, setMemberText] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSending, setMemberSending] = useState(false);
  const fileRef = useRef(null);
  const threadEnd = useRef(null);

  // Escape closes the full-size photo viewer.
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const activeConvo = useMemo(
    () => conversations.find((c) => c.id === conversationId) || null,
    [conversations, conversationId]
  );

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.conversations();
      setConversations(data.conversations);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const [friendData, requestData] = await Promise.all([api.friends(), api.friendRequests()]);
      setFriends(friendData.friends);
      setFriendRequests(requestData);
    } catch {
      // Friends list is optional; the chat still works without it.
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api.messages(conversationId);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    }
  }, [conversationId]);

  // First load, then poll every 5 seconds to simulate live updates.
  useEffect(() => {
    loadConversations();
    loadFriends();
    const id = setInterval(loadConversations, POLL_MS);
    const friendId = setInterval(loadFriends, POLL_MS);
    return () => {
      clearInterval(id);
      clearInterval(friendId);
    };
  }, [loadConversations, loadFriends]);

  useEffect(() => {
    if (!conversationId) return undefined;
    setMessages([]);
    loadMessages();
    const id = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(id);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Landing on /chat opens the global channel first, and falls back to the newest
  // chat when the global channel is not there. This runs only once, so tapping
  // Back to the chat list on a phone leaves you on the list.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (conversationId || conversations.length === 0 || autoOpened.current) return;
    autoOpened.current = true;
    const first = conversations.find((c) => c.isGlobal) || conversations[0];
    navigate(`/chat/${first.id}`, { replace: true });
  }, [conversationId, conversations, navigate]);

  // Person search: find people to start a chat with.
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api.users(search.trim()).then((d) => setSearchResults(d.users)).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function openChatWith(userId) {
    try {
      const data = await api.openDirect(userId);
      setSearch('');
      await loadConversations();
      navigate(`/chat/${data.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!activeConvo || sending) return;
    const body = text.trim();
    if (!body && !pendingFile) return;
    setSending(true);
    setError('');
    try {
      if (pendingFile) {
        // Photos go through the image route so they show as a picture in the chat.
        // Every other file type goes through the file route and shows as a download link.
        const isImage = pendingFile.type && pendingFile.type.startsWith('image/');
        if (isImage) {
          await api.sendImage(activeConvo.id, pendingFile, body);
        } else {
          await api.sendFile(activeConvo.id, pendingFile, body);
        }
      } else {
        await api.sendText(activeConvo.id, body);
      }
      setText('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadMessages();
      await loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Copies the sign-up link so a friend can join and chat.
  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/signup`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the link. Copy the address bar instead.');
    }
  }

  function handlePickFile(e) {
    const file = e.target.files && e.target.files[0];
    setPendingFile(file || null);
  }

  // Opens the popup for one member, with an empty message box.
  function openMemberPopup(member) {
    setMemberPopup(member);
    setMemberText('');
    setMemberError('');
  }

  function closeMemberPopup() {
    setMemberPopup(null);
    setMemberText('');
    setMemberError('');
  }

  // The message box in the member popup sends a private message: it opens (or
  // reuses) the 1-to-1 chat with that person, sends the text, then jumps there
  // so you can see the message arrive.
  async function sendToMember(e) {
    e.preventDefault();
    const body = memberText.trim();
    if (!memberPopup || !body || memberSending) return;
    setMemberSending(true);
    setMemberError('');
    try {
      const chat = await api.openDirect(memberPopup.id);
      await api.sendText(chat.id, body);
      closeMemberPopup();
      await loadConversations();
      navigate(`/chat/${chat.id}`);
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setMemberSending(false);
    }
  }

  // Add, accept or remove a friend. Used by the popup and the contact card.
  async function handleFriendAction(personId, action) {
    if (!personId) return;
    try {
      if (action === 'add') await api.addFriend(personId);
      else if (action === 'accept') await api.acceptFriend(personId);
      else await api.removeFriend(personId);
      await loadFriends();
    } catch (err) {
      // Show the problem where the button was pressed.
      if (memberPopup) setMemberError(err.message);
      else setError(err.message);
    }
  }

  // Where do we stand with this person: friend, request sent, request waiting, or nothing yet.
  function friendshipOf(personId) {
    if (!personId) return 'none';
    if (friends.some((f) => f.id === personId)) return 'friend';
    if (friendRequests.outgoing.some((f) => f.id === personId)) return 'outgoing';
    if (friendRequests.incoming.some((f) => f.id === personId)) return 'incoming';
    return 'none';
  }

  // One friend button, used in the popup and on the contact card.
  function friendButton(personId, { wide = false } = {}) {
    if (!personId || personId === (user && user.id)) return null;
    // Visitors get a temporary account, so they cannot keep friends.
    if (guest) return null;
    const state = friendshipOf(personId);
    const size = wide ? ' popup__friend-btn' : ' btn--tiny';
    if (state === 'friend') {
      return (
        <button
          type="button"
          className={`btn btn--ghost${size}`}
          onClick={() => handleFriendAction(personId, 'remove')}
          title="Remove friend"
        >
          {wide ? 'Friends ✓ Remove' : 'Friends ✓'}
        </button>
      );
    }
    if (state === 'outgoing') {
      return (
        <button
          type="button"
          className={`btn btn--ghost${size}`}
          onClick={() => handleFriendAction(personId, 'remove')}
          title="Cancel friend request"
        >
          {wide ? 'Request sent · Cancel' : 'Requested'}
        </button>
      );
    }
    if (state === 'incoming') {
      return (
        <button
          type="button"
          className={`btn btn--cta${size}`}
          onClick={() => handleFriendAction(personId, 'accept')}
        >
          {wide ? 'Accept friend request' : 'Accept request'}
        </button>
      );
    }
    return (
      <button
        type="button"
        className={`btn btn--cta${size}`}
        onClick={() => handleFriendAction(personId, 'add')}
      >
        {wide ? 'Add friend' : 'Add friend'}
      </button>
    );
  }

  const sharedImages = useMemo(() => messages.filter((m) => m.imageUrl), [messages]);
  const other = activeConvo ? chatOther(activeConvo, user && user.id) : null;
  const otherOnline = other ? other.online : false;

  // Friends who are online, shown in the left column.
  const onlineFriends = friends.filter((f) => f.online);
  // Online friends float to the top of the list.
  const sortedFriends = [...friends].sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <div className={`chat${conversationId ? ' chat--thread' : ' chat--list'}`}>
      {/* Left column: logo, profile, chats, friends */}
      <aside className="chat__left" aria-label="Chats">
        <div className="chat__brand">
          <span className="auth__name">Quickchat</span>
        </div>

        {guest ? (
          <div className="card card--guest">
            <p className="hand">You are chatting as a visitor.</p>
            <p className="muted small">Create an account to edit your profile and keep your chats.</p>
            <Link className="link-btn" to="/signup">Create account</Link>
            <Link className="link-btn" to="/login">Sign in</Link>
          </div>
        ) : (
          <Link to="/profile" className="card profile-card">
            <Avatar person={user} name={user && user.displayName} size={44} />
            <span>
              <strong>{user && user.displayName}</strong>
              <span className="muted">@{user && user.username}</span>
            </span>
          </Link>
        )}

        <div className="field search-field">
            <label htmlFor="people-search">Find people</label>
            <input
              id="people-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or username"
            />
            {searchResults.length > 0 && (
              <ul className="results" aria-label="People found">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="row-btn" onClick={() => openChatWith(p.id)}>
                      <Avatar person={p} size={32} />
                      <span>{p.displayName}</span>
                      {p.online && <span className="dot dot--on" aria-label="Online" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        <h2 className="section-title">Chats</h2>
        <ul className="chat-list">
          {conversations.map((c) => {
            const title = chatTitle(c, user && user.id);
            const o = chatOther(c, user && user.id);
            return (
              <li key={c.id}>
                <Link
                  to={`/chat/${c.id}`}
                  className={`row-btn${c.id === conversationId ? ' row-btn--active' : ''}`}
                >
                  <Avatar person={o} name={title} size={40} />
                  <span className="row-btn__body">
                    <span className="row-btn__title">
                      {title}
                      {c.isGlobal ? <span className="tag">Global</span> : c.isGroup && <span className="tag">Group</span>}
                    </span>
                    <span className="row-btn__preview">
                      {c.lastMessage ? c.lastMessage.text : 'No messages yet'}
                    </span>
                  </span>
                  {o && o.online && <span className="dot dot--on" aria-label="Online" />}
                  {c.unreadCount > 0 && (
                    <span className="badge" aria-label={`${c.unreadCount} unread`}>
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {conversations.length === 0 && (
            <li className="muted hand">No chats yet. Search for someone above.</li>
          )}
        </ul>

        <>
            {friendRequests.incoming.length > 0 && (
              <>
                <h2 className="section-title">
                  Friend requests <span className="badge">{friendRequests.incoming.length}</span>
                </h2>
                <ul className="chat-list">
                  {friendRequests.incoming.map((p) => (
                    <li key={p.id} className="friend-request">
                      <button type="button" className="row-btn" onClick={() => openMemberPopup(p)}>
                        <Avatar person={p} size={32} />
                        <span>{p.displayName}</span>
                      </button>
                      <span className="friend-request__actions">
                        <button
                          type="button"
                          className="btn btn--cta btn--tiny"
                          onClick={() => handleFriendAction(p.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--tiny"
                          onClick={() => handleFriendAction(p.id, 'remove')}
                        >
                          Decline
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2 className="section-title">
              Friends online <span className="badge" aria-label={`${onlineFriends.length} online`}>{onlineFriends.length}</span>
            </h2>
            <ul className="chat-list">
              {sortedFriends.map((f) => (
                <li key={f.id}>
                  <button type="button" className="row-btn" onClick={() => openChatWith(f.id)}>
                    <Avatar person={f} size={32} />
                    <span>{f.displayName}</span>
                    <span className={f.online ? 'dot dot--on' : 'dot'} aria-label={f.online ? 'Online' : 'Offline'} />
                  </button>
                </li>
              ))}
              {friends.length === 0 && (
                <li className="muted hand">
                  No friends yet. Open a member and tap Add friend.
                </li>
              )}
            </ul>
          </>
      </aside>

      {/* Centre column: thread */}
      <section className="chat__center" aria-label="Conversation">
        {activeConvo ? (
          <>
            <header className="chat__header">
              <button
                type="button"
                className="chat__back"
                aria-label="Back to chats"
                onClick={() => navigate('/chat')}
              >
                ←
              </button>
              <Avatar person={other} name={chatTitle(activeConvo, user && user.id)} size={40} />
              <div>
                <strong>{chatTitle(activeConvo, user && user.id)}</strong>
                <div className="muted small">
                  {activeConvo.isGroup
                    ? `${activeConvo.members.length} members`
                    : otherOnline
                    ? 'Online now'
                    : 'Offline'}
                </div>
              </div>
            </header>

            <div className="thread">
              <div className="today hand">today</div>
              {messages.map((m) => {
                const mine = m.senderId === (user && user.id);
                return (
                  <div key={m.id} className={`bubble-row${mine ? ' bubble-row--out' : ''}`}>
                    {!mine && <Avatar person={m.sender} size={30} />}
                    <div className={`bubble ${mine ? 'bubble--out' : 'bubble--in'}`}>
                      {activeConvo.isGroup && !mine && <div className="bubble__who">{m.sender.displayName}</div>}
                      {m.imageUrl && (
                        <button
                          type="button"
                          className="img-btn bubble__img-btn"
                          onClick={() => setLightbox(mediaUrl(m.imageUrl))}
                          aria-label="View photo larger"
                        >
                          <img className="bubble__img" src={mediaUrl(m.imageUrl)} alt="Sent photo" />
                        </button>
                      )}
                      {m.fileUrl && (
                        <a className="bubble__file" href={mediaUrl(m.fileUrl)} target="_blank" rel="noopener noreferrer" download={m.fileName}>
                          📄 {m.fileName || 'Download file'}
                        </a>
                      )}
                      {m.text && <div>{m.text}</div>}
                      <div className="bubble__meta">
                        <span>{formatTime(m.createdAt)}</span>
                        {m.ticks && (
                          <span
                            className={`ticks ${m.ticks === 'seen' ? 'ticks--seen' : ''}`}
                            aria-label={m.ticks === 'seen' ? 'Seen' : 'Sent'}
                          >
                            {m.ticks === 'seen' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEnd} />
            </div>

            <form className="composer" onSubmit={handleSend}>
                {error && <p className="auth__error composer__error" role="alert">{error}</p>}
                {pendingFile && (
                  <p className="muted small">Attached: {pendingFile.name}</p>
                )}
                <div className="composer__row">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Attach a file"
                    onClick={() => fileRef.current && fileRef.current.click()}
                  >
                    📎
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={handlePickFile}
                    hidden
                  />
                  <button type="button" className="icon-btn" aria-label="Insert emoji" onClick={() => setText((t) => t + '👋')}>
                    👋
                  </button>
                  <input
                    className="composer__input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message"
                    aria-label="Message"
                  />
                  <button
                    type="submit"
                    className="btn btn--send"
                    disabled={sending || (!text.trim() && !pendingFile)}
                    aria-label="Send message"
                    title="Send"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                      <path
                        d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15.5 12 3.4 13.9z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </form>
          </>
        ) : (
          <div className="chat__empty">
            <p className="hand">Pick a chat, or search for someone to start one.</p>
            {error && <p className="auth__error" role="alert">{error}</p>}
          </div>
        )}
      </section>

      {/* Right column: contact card, shared images, sign out */}
      <aside className="chat__right" aria-label="Details">
        {activeConvo && other && (
          <div className="card contact-card">
            <Avatar person={other} size={72} />
            <strong>{other.displayName}</strong>
            <span className="muted">{other.title}</span>
            <p className="bio">{other.bio || 'No bio yet.'}</p>
            {!guest && other && !other.isGuest && friendButton(other.id, { wide: true })}
          </div>
        )}
        {activeConvo && activeConvo.isGroup && (
          <div className="card">
            <h2 className="section-title">Members</h2>
            <ul className="chat-list">
              {activeConvo.members.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="row-btn"
                    onClick={() => openMemberPopup(m)}
                    aria-label={`View ${m.displayName}`}
                  >
                    <Avatar person={m} size={28} />
                    <span>{m.displayName}</span>
                    {m.online && <span className="dot dot--on dot--tiny" aria-label="Online" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeConvo && (
          <div className="card">
            <h2 className="section-title">Shared images</h2>
            <div className="image-grid">
              {sharedImages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="img-btn"
                  onClick={() => setLightbox(mediaUrl(m.imageUrl))}
                  aria-label="View shared photo larger"
                >
                  <img src={mediaUrl(m.imageUrl)} alt="Shared" />
                </button>
              ))}
              {sharedImages.length === 0 && <p className="muted small">No images yet.</p>}
            </div>
          </div>
        )}
        <div className="card contact-card">
            <strong>Invite a friend</strong>
            <span className="muted small">Share your link to start chatting</span>
            <button type="button" className="btn btn--cta" onClick={copyInviteLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
      </aside>

      {memberPopup && (
        <div
          className="popup__scrim"
          role="presentation"
          onClick={closeMemberPopup}
        >
          <div
            className="card popup"
            role="dialog"
            aria-modal="true"
            aria-label={`${memberPopup.displayName} details`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="popup__close"
              onClick={closeMemberPopup}
              aria-label="Close"
            >
              ×
            </button>
            <Avatar person={memberPopup} size={64} />
            <strong>{memberPopup.displayName}</strong>
            {memberPopup.username && <span className="muted small">@{memberPopup.username}</span>}
            {memberPopup.title && <span className="muted small">{memberPopup.title}</span>}
            <p className="bio">{memberPopup.bio || 'No bio yet.'}</p>
            <span className="popup__status">
              <i
                className={memberPopup.online ? 'dot dot--on dot--tiny' : 'dot dot--tiny'}
                aria-hidden="true"
              />
              {memberPopup.online ? 'Online' : 'Offline'}
            </span>

            {/* Friend button: changes with where the two of you stand. Hidden for visitors,
                who have no account to keep friends in. */}
            {!guest && !memberPopup.isGuest && memberPopup.id !== (user && user.id) && (
              <div className="popup__friend">{friendButton(memberPopup.id, { wide: true })}</div>
            )}

            {/* A one-line message box, kept compact inside the popup. */}
            {memberPopup.id !== (user && user.id) && (
              <form className="popup__composer" onSubmit={sendToMember}>
                {memberError && (
                  <p className="auth__error popup__composer-error" role="alert">
                    {memberError}
                  </p>
                )}
                <div className="popup__composer-row">
                  <input
                    className="popup__composer-input"
                    value={memberText}
                    onChange={(e) => setMemberText(e.target.value)}
                    placeholder="Send a message…"
                    aria-label={`Message ${memberPopup.displayName}`}
                  />
                  <button
                    type="submit"
                    className="btn--send btn--send--sm"
                    disabled={memberSending || !memberText.trim()}
                    aria-label="Send message"
                    title="Send"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                      <path
                        d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15.5 12 3.4 13.9z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="lightbox__close"
            onClick={() => setLightbox(null)}
            aria-label="Close photo viewer"
          >
            ×
          </button>
          <img
            className="lightbox__img"
            src={lightbox}
            alt="Photo full size"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
