import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useToast } from '../../context/ToastContext';
import { fmt, compressImageFile } from '../../lib/utils';
import PageHero from '../../components/PageHero';
import { Loading } from '../../components/ui';

export default function Stories() {
  const toast = useToast();
  const { hash } = useLocation();
  const { data: stories, loading } = useAsync(() => api.getStories(), []);
  const { data: stats } = useAsync(() => api.getPublicStats(), []);
  const [open, setOpen] = useState({});
  const [f, setF] = useState({ name: '', date: '', email: '', phone: '', message: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const onPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast('Please select an image file (JPG, PNG, WebP).');
        return;
      }
      const comp = await compressImageFile(file, 1200, 0.82);
      setPhotoFile(comp);
      setPhotoPreview(URL.createObjectURL(comp));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  useEffect(() => {
    if (!stories || !hash) return;
    const id = hash.slice(1); setOpen((o) => ({ ...o, [id]: true }));
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [stories, hash]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitEnquiry(
        {
          type: 'story',
          name: f.name,
          date: f.date,
          married: f.date,
          email: f.email,
          phone: f.phone,
          subject: 'Success story' + (f.date ? ' – married ' + fmt(f.date) : ''),
          message: f.message
        },
        photoFile
      );
      setF({ name: '', date: '', email: '', phone: '', message: '' });
      removePhoto();
      toast('Thank you! Your story and photo were received. Our office will contact you before publishing. 🙏', 5000);
    } catch (err) {
      toast(err.message || 'Failed to submit story. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="page">
      <PageHero crumbs={[['Home', '/'], ['Success Stories']]} title="Success Stories" sub="Real couples. Real stories. United in faith." verse="What God has joined together, let no one separate." verseRef="MARK 10:9" />
      <div className="container">
        <div className="card stat-strip">
          {[['fa-solid fa-heart', stats?.couples, 'Couples united'], ['fa-solid fa-user-group', stats?.members, 'Registered members'], ['fa-solid fa-church', stats?.dioceses, 'Dioceses'], ['fa-solid fa-shield-heart', '100%', 'Verified profiles']].map(([i, n, t]) => (
            <div key={t}><span className="ico"><i className={i} /></span><b>{n ?? '…'}</b><span>{t}</span></div>
          ))}
        </div>
        {loading ? <Loading /> : (
          <div className="story-grid">
            {stories.map((s) => (
              <article key={s.id} id={s.id} className={'card s-card' + (open[s.id] ? ' open' : '') + (hash === '#' + s.id ? ' flash' : '')}>
                {s.img && !s.img.startsWith('/img/story') && !s.img.startsWith('/img/hero') && !s.img.startsWith('/img/mag') && !s.img.startsWith('/img/banner') ? (
                  <img src={s.img} alt={s.couple} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : null}
                <div className="s-body"><h3>{s.couple}</h3>
                  <small className="muted"><i className="fa-solid fa-ring" /> Married {fmt(s.married)}{s.parish ? ' • ' + s.parish : ''}</small>
                  <blockquote>{s.text}</blockquote>
                  {s.story && <><p className="s-more">{s.story}</p><button className="btn btn-outline btn-sm" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>{open[s.id] ? 'Show less' : 'Read their story'}</button></>}
                </div>
              </article>
            ))}
          </div>
        )}
        <section className="card share-card" id="share">
          <div className="share-art" style={{ background: 'linear-gradient(135deg, var(--wine) 0%, #4a0717 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 24px', minHeight: 220 }}><q style={{ position: 'relative', left: 'auto', right: 'auto', bottom: 'auto', color: '#fff', textAlign: 'center' }}>“Your story may be the sign of hope another family is praying for.”</q></div>
          <form className="share-form" onSubmit={submit}>
            <h2 className="serif wine">Share Your Story</h2>
            <p className="muted">Married through Family Apostolate Matrimony? Tell us your story – our office will contact you before publishing it.</p>
            <div className="grid g2" style={{ marginTop: 12 }}>
              <div className="field"><label>Couple's Names <span className="rq">*</span></label><input className="input" required value={f.name} onChange={set('name')} placeholder="e.g. Jinu & Aleena" /></div>
              <div className="field"><label>Wedding Date</label><input className="input" type="date" value={f.date} onChange={set('date')} /></div>
              <div className="field"><label>Email <span className="rq">*</span></label><input className="input" type="email" required value={f.email} onChange={set('email')} /></div>
              <div className="field"><label>Phone</label><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></div>
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Couple / Wedding Photo <small className="muted">(Optional, recommended)</small></label>
              {photoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#fdf7f8', border: '1px solid #ecc', borderRadius: 10 }}>
                  <img src={photoPreview} alt="Preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #d4b5bc' }} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 13, display: 'block', color: 'var(--wine)' }}>{photoFile?.name}</b>
                    <small className="muted">{photoFile ? Math.round(photoFile.size / 1024) + ' KB' : ''}</small>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={removePhoto} style={{ color: '#b42318' }}>
                    <i className="fa-solid fa-trash-can" /> Change
                  </button>
                </div>
              ) : (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '14px 18px',
                  border: '2px dashed #d8c2c7',
                  borderRadius: 10,
                  background: '#fffcfd',
                  cursor: 'pointer',
                  color: '#6e4f55'
                }}>
                  <i className="fa-solid fa-camera wine" style={{ fontSize: 20 }} />
                  <span style={{ fontSize: 13.5 }}><b>Click to Upload Wedding Photo</b> <small className="muted">(JPG, PNG, WebP)</small></span>
                  <input type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <div className="field" style={{ marginTop: 14 }}><label>Your Story <span className="rq">*</span></label><textarea className="input" rows="4" required value={f.message} onChange={set('message')} placeholder="How did you meet? How did faith guide your journey?" /></div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={submitting}>
              <i className="fa-solid fa-paper-plane" /> {submitting ? 'Submitting Story & Photo...' : 'Submit Story'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
