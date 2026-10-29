import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { firstName, ft, uniquePhotos } from '../../lib/utils';
import PageHero from '../../components/PageHero';
import { Empty, ErrorBox, Kv, Loading, Modal } from '../../components/ui';

const AGES = [['', 'Any age'], ['21-25', '21 - 25 years'], ['24-30', '24 - 30 years'], ['27-32', '27 - 32 years'], ['30-36', '30 - 36 years']];
const HEIGHTS = [['', 'Any height'], ['145-160', '145 - 160 cm'], ['155-170', '155 - 170 cm'], ['160-175', '160 - 175 cm'], ['170-190', '170 - 190 cm']];
const range = (v, lo, hi) => (v ? v.split('-').map(Number) : [lo, hi]);

export default function Match() {
  const { user, refreshSummary, summary } = useAuth();
  const toast = useToast();
  const { data: look } = useAsync(() => api.getLookups(), []);
  const [f, setF] = useState({ age: '', eduGroup: '', jobGroup: '', height: '', diocese: '' });
  const [applied, setApplied] = useState(f);
  const { data: deckData, loading, error } = useAsync(() => {
    const [ageMin, ageMax] = range(applied.age, 18, 80), [heightMin, heightMax] = range(applied.height, 0, 300);
    return api.discover({ ageMin, ageMax, heightMin, heightMax, eduGroup: applied.eduGroup, jobGroup: applied.jobGroup, diocese: applied.diocese, undecidedOnly: true, sort: 'likedMe' });
  }, [applied]);
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [ph, setPh] = useState(0);
  const [anim, setAnim] = useState(null);
  const [drag, setDrag] = useState(0);
  const [matched, setMatched] = useState(null);
  const start = useRef(null);
  useEffect(() => { if (deckData) { setDeck(deckData); setIdx(0); } }, [deckData]);
  useEffect(() => setPh(0), [idx]);
  const m = deck[idx];
  const photos = useMemo(() => uniquePhotos(m), [m]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const decide = async (type) => {
    if (!m || anim) return;
    setAnim(type); setDrag(0);
    try {
      const r = await api.decide(m.id, type);
      setTimeout(() => {
        if (r.mutual) setMatched(m);
        else toast(type === 'like' ? `You liked ${firstName(m)} ♥` : type === 'fav' ? `${firstName(m)} added to favourites ★` : `Passed on ${firstName(m)}`);
        setIdx((i) => i + 1); setAnim(null); refreshSummary();
      }, 300);
    } catch (e) { toast(e.message); setAnim(null); }
  };
  useEffect(() => {
    const k = (e) => { if (matched) return; if (e.key === 'ArrowLeft') decide('pass'); if (e.key === 'ArrowRight') decide('like'); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const onDown = (e) => { if (e.target.closest('button,a')) return; start.current = e.clientX; };
  const onMove = (e) => { if (start.current !== null) setDrag(e.clientX - start.current); };
  const onUp = () => { if (start.current === null) return; start.current = null; if (drag > 120) decide('like'); else if (drag < -120) decide('pass'); else setDrag(0); };
  const transform = anim ? `translateX(${anim === 'pass' ? -700 : 700}px) rotate(${anim === 'pass' ? -18 : 18}deg)` : drag ? `translateX(${drag}px) rotate(${drag / 25}deg)` : '';
  const Sel = ({ k, label, icon, options, any }) => (
    <div className="ref-row"><i className={icon} /><div><label>{label}</label><select className="select" value={f[k]} onChange={set(k)}>{any && <option value="">{any}</option>}{options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}</select></div></div>
  );
  const rest = deck.slice(idx);

  return (
    <main className="page">
      <PageHero crumbs={[['Home', '/'], ['Match Interaction']]} title="Match Interaction" sub="Discover meaningful connections, guided by faith." verse="Therefore what God has joined together, let no one separate." verseRef="MARK 10:9" />
      <div className="container match-layout">
        <aside className="card refine">
          <h3 className="card-title"><i className="fa-solid fa-magnifying-glass" />Refine Your Matches</h3>
          <p className="sub">Adjust your preferences to find better matches</p>
          {Sel({ k: 'age', label: 'Age Range', icon: 'fa-solid fa-user-group', options: AGES })}
          {Sel({ k: 'eduGroup', label: 'Qualification', icon: 'fa-solid fa-graduation-cap', options: look?.eduGroups || [], any: 'Any Qualification' })}
          {Sel({ k: 'jobGroup', label: 'Profession', icon: 'fa-solid fa-briefcase', options: look?.jobGroups || [], any: 'Any Profession' })}
          {Sel({ k: 'height', label: 'Height', icon: 'fa-solid fa-ruler', options: HEIGHTS })}
          {Sel({ k: 'diocese', label: 'Diocese', icon: 'fa-solid fa-church', options: look?.dioceses || [], any: 'Any Diocese' })}
          <button className="btn btn-primary btn-block" style={{ marginTop: 14, height: 46 }} onClick={() => setApplied(f)}><i className="fa-solid fa-filter" /> Update Preferences</button>
          <div className="note-card"><i className="fa-solid fa-people-arrows" /><span>You are viewing {user.gender === 'Male' ? 'bride' : 'groom'} profiles. As per Church guidelines, men see women’s profiles and women see men’s profiles.</span></div>
        </aside>

        <section className="swipe-zone">
          {error ? <ErrorBox error={error} /> : loading && !deck?.length ? <Loading /> : !m ? (
            <Empty icon="fa-regular fa-heart" title="You're all caught up">No more profiles match these preferences right now.<br />Try “Any” in the filters, or visit your <Link className="wine" to="/chat">matches</Link>.</Empty>
          ) : (<>
            <div className="card swipe-card" style={{ transform, opacity: anim ? 0 : 1, transition: drag && !anim ? 'none' : undefined }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
              <div className="photo-main"><img src={photos[ph] || '/img/logo.png'} alt="" draggable="false" />
                <span className="counter">{idx + 1} / {deck?.length || 1}</span>
                <div className="dots">{photos.map((_, k) => <b key={k} className={k === ph ? 'on' : ''} />)}</div>
                {photos.length > 1 && <>
                  <button className="photo-nav prev" aria-label="Previous" onClick={() => setPh((ph - 1 + photos.length) % photos.length)}><i className="fa-solid fa-chevron-left" /></button>
                  <button className="photo-nav next" aria-label="Next" onClick={() => setPh((ph + 1) % photos.length)}><i className="fa-solid fa-chevron-right" /></button></>}
              </div>
              <div>
                <span className="stamp like" style={{ opacity: Math.max(0, drag / 120) }}>LIKE</span><span className="stamp nope" style={{ opacity: Math.max(0, -drag / 120) }}>PASS</span>
                <h2 className="p-name"><Link to={`/profile/${m.id}`}>{m.name}</Link> <i className="fa-solid fa-shield-heart verified-ico" /></h2>
                <div className="p-meta"><span>{m.age} Years</span><span>Roman Catholic</span><span>{m.maritalStatus}</span></div>
                {m.relation?.likesMe && <span className="badge" style={{ background: '#fde6ea', color: 'var(--wine)', margin: '2px 0 4px' }}><i className="fa-solid fa-heart" /> {firstName(m)} likes you – like back to start chatting</span>}
                <div className="quote-band">“{m.quote}”</div>
                <Kv icon="fa-solid fa-church" k="Diocese">{m.diocese}</Kv><Kv icon="fa-solid fa-house-chimney" k="Parish">{m.parish}</Kv>
                <Kv icon="fa-solid fa-graduation-cap" k="Education">{m.education}</Kv><Kv icon="fa-solid fa-briefcase" k="Profession">{m.job}</Kv>
                <Kv icon="fa-solid fa-ruler-vertical" k="Height">{m.height} cm ({ft(m.height)})</Kv><Kv icon="fa-solid fa-people-group" k="Community">{m.community}</Kv>
                <Kv icon="fa-solid fa-globe" k="Languages">{m.languages}</Kv><Kv icon="fa-solid fa-location-dot" k="Location">{m.location}</Kv>
                <div className="about-me" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, fontSize: 13.5 }}><i className="fa-solid fa-user" /><div><h4>About Me</h4>{m.about}</div></div>
              </div>
            </div>
            <div className="swipe-actions">
              <button className="act" onClick={() => decide('pass')}><span className="circle"><i className="fa-solid fa-xmark" /></span>Dislike / Pass</button>
              <button className="act" onClick={() => decide('like')}><span className="circle big"><i className="fa-solid fa-heart" /></span>Like</button>
              <button className="act" onClick={() => decide('fav')}><span className="circle star"><i className="fa-solid fa-star" /></span>Add to Favorites</button>
            </div>
            <div className="swipe-hint"><b>You can also swipe</b><span className="hand"><i className="fa-regular fa-hand-pointer" /></span><span><i className="fa-solid fa-arrow-left" /> Swipe Left to Pass<br />Swipe Right to Like <i className="fa-solid fa-arrow-right" /></span></div>
          </>)}
        </section>

        <aside className="card queue">
          <h3 className="card-title"><i className="fa-solid fa-user-clock" />Upcoming Matches</h3>
          <p className="sub">{rest.length} profile{rest.length === 1 ? '' : 's'} in queue</p>
          {rest.slice(0, 5).map((p, k) => (
            <div key={p.id} className={'q-item' + (k ? '' : ' on')} onClick={() => { const d = [...deck]; const [x] = d.splice(idx + k, 1); d.splice(idx, 0, x); setDeck(d); }}>
              <img src={p.photos?.[0] || '/img/logo.png'} alt="" /><div><b>{p.name}</b><small>{p.age} years<br />{p.diocese}</small></div><i className="fa-solid fa-chevron-right" /></div>
          ))}
          {rest.length > 5 && <Link className="q-more" to="/search"><span>+{rest.length - 5}</span>And {rest.length - 5} more profiles in your queue...<i className="fa-solid fa-chevron-right wine" /></Link>}
          <Link className="q-more" to="/chat" style={{ background: '#fff', border: '1px solid var(--line)' }}><span><i className="fa-regular fa-comments" /></span>Your matches: {summary?.matches ?? 0} • Liked you: {summary?.likedMe ?? 0}<i className="fa-solid fa-chevron-right wine" /></Link>
        </aside>
      </div>

      <Modal open={!!matched} onClose={() => setMatched(null)} width={460}>
        {matched && <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-heart" style={{ color: 'var(--rose)', fontSize: 26 }} />
          <h3 style={{ fontFamily: 'var(--script)', fontStyle: 'italic', fontSize: 42 }}>It's a Match!</h3>
          <div className="pair"><img src={matched.photos[0]} alt="" /><img src={user.photos[0]} alt="" /></div>
          <p>You and <b>{firstName(matched)}</b> both liked each other.<br />May God guide this conversation to something beautiful.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
            <button className="btn btn-outline" onClick={() => setMatched(null)}>Keep Browsing</button>
            <Link className="btn btn-primary" to={`/chat/${matched.id}`}><i className="fa-regular fa-comments" /> Send Message</Link>
          </div></div>}
      </Modal>
    </main>
  );
}
