import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mediaUrl } from '../api.js';
import { useAuth } from '../auth.jsx';

const COLOURS = ['#c2185b', '#ef8c1e', '#1aa3b8', '#6a4fd1', '#2e8b57', '#0f8a78'];

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export default function ProfilePage() {
  const { user, guest, updateUser, signOut } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState(() => toForm(user));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(user));
  }, [user]);

  function toForm(u) {
    return {
      displayName: (u && u.displayName) || '',
      username: (u && u.username) || '',
      title: (u && u.title) || '',
      bio: (u && u.bio) || '',
      avatarColor: (u && u.avatarColor) || COLOURS[0],
      email: (u && u.email) || '',
      appearOnline: u ? u.appearOnline !== false : true,
    };
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setErrors({});
    try {
      const data = await api.updateMe(form);
      updateUser(data.user);
      setMessage('Profile saved.');
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMessage('');
    try {
      const data = await api.uploadAvatar(file);
      updateUser(data.user);
      setMessage('Photo updated.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemovePhoto() {
    setMessage('');
    try {
      const data = await api.removeAvatar();
      updateUser(data.user);
      setMessage('Photo removed.');
    } catch (err) {
      setMessage(err.message);
    }
  }

  function handleCancel() {
    setForm(toForm(user));
    setErrors({});
    setMessage('');
    navigate('/chat');
  }

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const avatarStyle = { background: form.avatarColor };
  const shownName = form.displayName || form.username || 'Your name';

  return (
    <div className="profile">
      <aside className="card profile__left">
        <div className="profile__avatar-wrap">
          {user && user.avatarUrl ? (
            <img className="profile__avatar avatar--photo" src={mediaUrl(user.avatarUrl)} alt="Your profile photo" />
          ) : (
            <span className="profile__avatar" style={avatarStyle} aria-label="Your avatar colour">
              {initials(shownName)}
            </span>
          )}
        </div>
        <strong className="contact-name">{shownName}</strong>
        <span className="muted small">@{form.username || 'username'} · {form.appearOnline ? 'Online' : 'Offline'}</span>

        <div className="profile__photo-actions">
          <button type="button" className="btn btn--ghost" onClick={() => fileRef.current && fileRef.current.click()} disabled={guest}>
            Upload photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handlePhoto}
            hidden
          />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleRemovePhoto}
            disabled={guest || !(user && user.avatarUrl)}
          >
            Remove photo
          </button>
        </div>

        <div className="preview">
          <p className="preview__hand">how others see you</p>
          <div className="card preview__card">
            <span className="avatar" style={{ ...avatarStyle, width: 48, height: 48 }}>{initials(shownName)}</span>
            <strong>{shownName}</strong>
            <span className="muted small">{form.title || 'Your job title'}</span>
            <p className="bio">{form.bio || 'Your bio shows here.'}</p>
          </div>
        </div>
        <Link to="/chat" className="link-btn">← Back to chats</Link>
      </aside>

      <form className="card profile__form" onSubmit={handleSave} noValidate>
        <p className="profile__kicker">Make it yours ✎</p>
        <h1 className="profile__title">Edit profile</h1>
        <p className="profile__sub">Changes appear instantly in your conversations.</p>
        {message && (
          <p className={errors && Object.keys(errors).length ? 'auth__error' : 'hand'} role="status">{message}</p>
        )}

        {guest && (
          <p className="auth__error" role="status">
            You are a visitor, so you cannot edit this profile. <Link to="/signup">Create an account</Link> to edit it.
          </p>
        )}

        <fieldset disabled={guest} className="profile__fields">
        <div className="field-row">
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" value={form.displayName} aria-invalid={!!errors.displayName}
              onChange={(e) => setField('displayName', e.target.value)} />
            {errors.displayName && <span className="field__error">{errors.displayName}</span>}
          </div>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" value={form.username} aria-invalid={!!errors.username}
              onChange={(e) => setField('username', e.target.value)} />
            {errors.username && <span className="field__error">{errors.username}</span>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Job title</label>
          <input id="title" value={form.title} aria-invalid={!!errors.title}
            onChange={(e) => setField('title', e.target.value)} />
          {errors.title && <span className="field__error">{errors.title}</span>}
        </div>

        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" rows={3} value={form.bio} aria-invalid={!!errors.bio}
            onChange={(e) => setField('bio', e.target.value)} />
          {errors.bio && <span className="field__error">{errors.bio}</span>}
        </div>

        <fieldset className="swatches">
          <legend>Avatar colour</legend>
          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${form.avatarColor === c ? ' swatch--on' : ''}`}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              aria-pressed={form.avatarColor === c}
              onClick={() => setField('avatarColor', c)}
            />
          ))}
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} aria-invalid={!!errors.email}
              onChange={(e) => setField('email', e.target.value)} />
            {errors.email && <span className="field__error">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={form.appearOnline ? 'online' : 'offline'}
              onChange={(e) => setField('appearOnline', e.target.value === 'online')}>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        </fieldset>

        <div className="profile__actions">
          <button type="submit" className="btn btn--save" disabled={saving || guest}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleCancel}>Cancel</button>
          <button type="button" className="btn btn--ghost btn--danger" onClick={handleLogout}>Log out</button>
        </div>
      </form>
    </div>
  );
}
