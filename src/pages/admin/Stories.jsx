import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { adminChanged } from '../../components/AdminLayout';
import { fmt } from '../../lib/utils';
import { Loading, Modal } from '../../components/ui';
import { Seg } from './parts';

const isDummyStoryImg = (url) =>
  !url ||
  url.startsWith('/img/story') ||
  url.startsWith('/img/hero') ||
  url.startsWith('/img/mag') ||
  url.startsWith('/img/banner');

const blankStory = () => ({
  couple: '',
  married: '',
  parish: '',
  img: '',
  text: '',
  story: '',
  published: true
});

export default function Stories() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);
  const [form, setForm] = useState(blankStory());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const dismissSubmission = async (sub) => {
    try {
      await api.updateEnquiry(sub.id, { status: 'closed' });
      toast('Submission dismissed.');
      reloadAll();
    } catch (err) {
      toast(err.message || 'Failed to dismiss');
    }
  };

  const handleAdminPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file (JPG, PNG, WebP).');
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await api.uploadPhoto(file);
      setForm((prev) => ({ ...prev, img: res.url }));
      toast('Photo uploaded successfully! 📸');
    } catch (err) {
      toast(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Load all stories from DB
  const { data: stories, loading, reload: reloadStories } = useAsync(() => api.listAdminStories(), []);
  // Load enquiries for pending story submissions
  const { data: enquiries, reload: reloadEnquiries } = useAsync(() => api.listEnquiries('all'), []);

  const storySubmissions = (enquiries || []).filter((e) => e.type === 'story' && e.status === 'open');

  const reloadAll = () => {
    reloadStories();
    reloadEnquiries();
    adminChanged();
  };

  const openNewModal = (prefill = null) => {
    setEditingId(null);
    setForm(prefill ? { ...blankStory(), ...prefill } : blankStory());
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      couple: item.couple || '',
      married: item.married || '',
      parish: item.parish || '',
      img: isDummyStoryImg(item.img) ? '' : item.img,
      text: item.text || '',
      story: item.story || '',
      published: item.published !== false
    });
    setModalOpen(true);
  };

  const saveStory = async (e) => {
    e.preventDefault();
    if (!form.couple.trim() || !form.text.trim()) {
      toast('Couple names and highlight quote are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateAdminStory(editingId, form);
        toast('Story updated successfully! ✨');
      } else {
        await api.createAdminStory(form);
        if (activeSubmissionId) {
          await api.updateEnquiry(activeSubmissionId, { status: 'closed' }).catch(() => {});
          setActiveSubmissionId(null);
        }
        toast('Success story added to database! 🎉');
      }
      setModalOpen(false);
      reloadAll();
    } catch (err) {
      toast(err.message || 'Failed to save story');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (item) => {
    try {
      const nextPub = !item.published;
      await api.updateAdminStory(item.id, { published: nextPub });
      toast(nextPub ? 'Story is now live on the public site! 🌟' : 'Story hidden from public view.');
      reloadAll();
    } catch (err) {
      toast(err.message || 'Failed to update status');
    }
  };

  const deleteStory = async (item) => {
    if (!window.confirm(`Are you sure you want to permanently delete the story of "${item.couple}"?`)) return;
    try {
      await api.deleteAdminStory(item.id);
      toast('Story deleted from database.');
      reloadAll();
    } catch (err) {
      toast(err.message || 'Failed to delete story');
    }
  };

  const publishFromSubmission = (sub) => {
    setActiveSubmissionId(sub.id);
    // Extract date from subject if available: e.g. "Success story – married 2026-05-17"
    let mDate = '';
    const mMatch = (sub.subject || '').match(/(\d{4}-\d{2}-\d{2})/);
    if (mMatch) mDate = mMatch[1];

    openNewModal({
      couple: sub.name,
      married: mDate,
      img: isDummyStoryImg(sub.photo) ? '' : sub.photo,
      email: sub.email,
      phone: sub.phone,
      text: sub.message.length > 150 ? sub.message.slice(0, 147) + '...' : sub.message,
      story: sub.message,
      published: true
    });
  };

  const filteredStories = (stories || []).filter((s) => {
    if (filter === 'published') return s.published !== false;
    if (filter === 'drafts') return s.published === false;
    return true;
  });

  return (
    <div className="panel" style={{ paddingBottom: 24 }}>
      <div className="panel-h">
        <div>
          <h2><i className="fa-solid fa-heart wine" /> Success Stories Management</h2>
          <small className="muted" style={{ display: 'block', marginTop: 3 }}>
            Stories are saved in MongoDB and displayed on the public Success Stories and Home pages.
          </small>
        </div>
        <div className="tools">
          <Seg
            value={filter}
            onChange={setFilter}
            options={[
              ['all', `All (${(stories || []).length})`],
              ['published', `Published (${(stories || []).filter((s) => s.published !== false).length})`],
              ['drafts', `Drafts (${(stories || []).filter((s) => s.published === false).length})`]
            ]}
          />
          <button className="btn btn-primary btn-sm" onClick={() => openNewModal()}>
            <i className="fa-solid fa-plus" /> Add New Story
          </button>
        </div>
      </div>

      {/* Pending user submissions banner */}
      {storySubmissions.length > 0 && (
        <div className="notice" style={{ margin: '14px 20px', background: '#fff5f7', borderColor: '#f8c2cb' }}>
          <i className="fa-solid fa-bell wine" />
          <div style={{ flex: 1 }}>
            <b>{storySubmissions.length} new couple story submission{storySubmissions.length > 1 ? 's' : ''}</b> from public "Share Your Story" form:
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {storySubmissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #ecc',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  {sub.photo && !isDummyStoryImg(sub.photo) && (
                    <img
                      src={sub.photo}
                      alt=""
                      style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid #d4b5bc' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <b>{sub.name}</b> <span className="muted">({sub.email})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: '3px 9px', fontSize: 12 }}
                      onClick={() => publishFromSubmission(sub)}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" /> Publish to Stories
                    </button>
                    <button
                      type="button"
                      className="ibtn"
                      title="Dismiss submission"
                      style={{ color: '#888', padding: '4px 8px' }}
                      onClick={() => dismissSubmission(sub)}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && !stories ? (
        <Loading text="Loading success stories from database..." />
      ) : !filteredStories.length ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <i className="fa-regular fa-heart" style={{ fontSize: 36, color: 'var(--wine)', opacity: 0.5 }} />
          <h3 style={{ marginTop: 10, fontWeight: 600 }}>No stories found</h3>
          <p className="muted">Click "Add New Story" above to share a testimony directly to the database.</p>
        </div>
      ) : (
        <div className="story-admin-list" style={{ padding: '0 20px' }}>
          {filteredStories.map((s) => (
            <div
              key={s.id}
              className="q-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr auto',
                gap: 16,
                alignItems: 'start',
                padding: '16px',
                border: '1px solid var(--border)',
                borderRadius: 12,
                marginTop: 14,
                background: s.published === false ? '#faf9f9' : '#fff'
              }}
            >
              <div style={{ position: 'relative' }}>
                {!isDummyStoryImg(s.img) ? (
                  <img
                    src={s.img}
                    alt={s.couple}
                    style={{
                      width: '100%',
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #e2dcd7'
                    }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 100,
                      borderRadius: 8,
                      border: '1px solid #e2dcd7',
                      background: '#fdf7f8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--wine)'
                    }}
                  >
                    <i className="fa-solid fa-heart" style={{ fontSize: 24, opacity: 0.35 }} />
                  </div>
                )}
                <span
                  className={'pill ' + (s.published !== false ? 's-active' : 's-pending')}
                  style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 11, padding: '2px 6px' }}
                >
                  {s.published !== false ? 'Published' : 'Draft / Hidden'}
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--ink)' }}>{s.couple}</h3>
                  <span className="muted" style={{ fontSize: 12 }}>ID: {s.id}</span>
                </div>

                <div className="meta" style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
                  {s.married && <span><i className="fa-solid fa-ring" style={{ color: 'var(--wine)' }} /> Married {fmt(s.married)}</span>}
                  {s.parish && <span style={{ marginLeft: 12 }}><i className="fa-solid fa-church" /> {s.parish}</span>}
                </div>

                <blockquote
                  style={{
                    margin: '8px 0 6px',
                    padding: '6px 12px',
                    borderLeft: '3px solid var(--wine)',
                    background: '#fdf7f8',
                    fontStyle: 'italic',
                    fontSize: 13.5,
                    color: '#3e2e32'
                  }}
                >
                  "{s.text}"
                </blockquote>

                {s.story && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', lineHeight: 1.4 }}>
                    {s.story.length > 220 ? s.story.slice(0, 217) + '...' : s.story}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                <button
                  className={'btn btn-sm ' + (s.published !== false ? 'btn-outline' : 'btn-primary')}
                  onClick={() => togglePublished(s)}
                  title={s.published !== false ? 'Hide from public website' : 'Make live on public website'}
                >
                  <i className={'fa-solid ' + (s.published !== false ? 'fa-eye-slash' : 'fa-check')} />
                  {s.published !== false ? ' Hide' : ' Publish'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => openEditModal(s)}
                >
                  <i className="fa-solid fa-pen-to-square" /> Edit
                </button>
                <Link
                  className="btn btn-ghost btn-sm"
                  to={`/stories#${s.id}`}
                  target="_blank"
                  style={{ textAlign: 'center' }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" /> View Live
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#b42318' }}
                  onClick={() => deleteStory(s)}
                >
                  <i className="fa-regular fa-trash-can" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Story Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} width={640}>
        <form onSubmit={saveStory}>
          <div className="modal-h">
            <h2 className="serif wine" style={{ margin: 0 }}>
              <i className="fa-solid fa-heart" /> {editingId ? 'Edit Success Story' : 'Add New Story Directly'}
            </h2>
            <button
              type="button"
              className="ibtn"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid g2">
              <div className="field">
                <label>Couple's Names <span className="rq">*</span></label>
                <input
                  className="input"
                  required
                  placeholder="e.g. Jinu & Aleena"
                  value={form.couple}
                  onChange={(e) => setForm({ ...form, couple: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Wedding Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.married}
                  onChange={(e) => setForm({ ...form, married: e.target.value })}
                />
              </div>
            </div>

            <div className="grid g2">
              <div className="field">
                <label>Parish / Cathedral</label>
                <input
                  className="input"
                  placeholder="e.g. St. Antony's Church, Punkunnam"
                  value={form.parish}
                  onChange={(e) => setForm({ ...form, parish: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Photo Image</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {form.img && !isDummyStoryImg(form.img) && (
                    <img
                      src={form.img}
                      alt="Preview"
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #d4b5bc', flexShrink: 0 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <input
                    className="input"
                    placeholder="Upload photo or paste image URL"
                    value={form.img}
                    onChange={(e) => setForm({ ...form, img: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <label
                    className="btn btn-outline btn-sm"
                    style={{ cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up" /> {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAdminPhotoUpload}
                      disabled={uploadingPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Highlight Quote / Summary <span className="rq">*</span></label>
              <input
                className="input"
                required
                placeholder="e.g. We found not just a partner but a companion in faith."
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
              <small className="muted">Appears prominently in quotes on the story card and homepage.</small>
            </div>

            <div className="field">
              <label>Full Story Testimony</label>
              <textarea
                className="input"
                rows={5}
                placeholder="How did they meet? How did faith guide their journey?"
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              <b>Publish immediately</b> (Visible on the public website)
            </label>
          </div>

          <div className="modal-f" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              <i className="fa-solid fa-check" /> {saving ? 'Saving...' : editingId ? 'Update Story' : 'Save Story to DB'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
