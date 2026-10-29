import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../context/AuthContext';
import { fmt } from '../../lib/utils';

export default function Home() {
  const nav = useNavigate();
  const { user, isMember } = useAuth();
  const { data: stories = [] } = useAsync(() => api.getStories(), []);
  const { data: articles = [] } = useAsync(() => api.getArticles(), []);
  const { data: look } = useAsync(() => api.getLookups(), []);
  const { data: stats } = useAsync(() => api.getPublicStats(), []);
  const [off, setOff] = useState(0);
  const [q, setQ] = useState({ ageMin: '', ageMax: '', eduGroup: '', jobGroup: '', diocese: '' });
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const search = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    nav('/search' + (p.toString() ? '?' + p : ''));
  };
  const shown = stories.length ? [0, 1, 2].slice(0, Math.min(3, stories.length)).map((i) => stories[(off + i) % stories.length]) : [];

  return (
    <main className="page home">
      <section className="home-hero">
        <div className="hero-photo"><img src="/img/hero-home.jpg" alt="Catholic couple at the altar" /></div>
        <div className="container hero-inner">
          <div className="hero-copy">
            <div className="kicker">A CATHOLIC MATRIMONIAL INITIATIVE</div>
            <h1>Faith Brings<br />Hearts Together</h1>
            <p>A safe, trusted and meaningful matrimonial platform by the Family Apostolate, Thrissur Archdiocese.</p>
            <div className="hero-feats">
              <div><i className="fa-solid fa-cross" />Rooted in Faith</div>
              <div><i className="fa-solid fa-people-roof" />For Catholic Families</div>
              <div><i className="fa-solid fa-shield-heart" />Verified Profiles</div>
              <div><i className="fa-solid fa-heart" />Meaningful Matches</div>
            </div>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-pill" to={isMember ? '/match' : '/search'}><i className="fa-solid fa-magnifying-glass" />Find Your Match</Link>
              {!isMember && <Link className="btn btn-outline btn-pill" to="/register">Register Now <i className="fa-solid fa-arrow-right" /></Link>}
            </div>
          </div>
          <div className="wreath"><div><q>Let all that you do be done in love.</q><small>1 CORINTHIANS 16:14</small></div></div>
        </div>
      </section>

      <section className="container row-2 overlap">
        <div className="card feat-strip">
          {[['fa-user-shield', 'Safe & Trusted', 'Platform'], ['fa-church', 'A Catholic', 'Community'], ['fa-shield-halved', 'Verified & Secure', 'Profiles'], ['fa-heart', 'Meaningful', 'Connections'], ['fa-book-bible', 'Guidance from', 'the Church'], ['fa-people-group', 'Support for', 'Families']].map(([i, a, b]) => (
            <div key={i}><span className="ico"><i className={'fa-solid ' + i} /></span>{a}<br />{b}</div>
          ))}
        </div>
        <form className="card quick-search" onSubmit={search}>
          <div className="qs-head"><h3 className="card-title"><i className="fa-solid fa-magnifying-glass" />Quick Search</h3>
            <Link to="/search" className="adv"><i className="fa-solid fa-sliders" /> Advanced Search</Link></div>
          <div className="qs-row">
            <div className="field"><label>Looking for</label><select className="select" defaultValue={user?.gender === 'Female' ? 'Groom' : 'Bride'}><option>Bride</option><option>Groom</option></select></div>
            <div className="field"><label>Age</label><div className="age-pair">
              <select className="select" value={q.ageMin} onChange={set('ageMin')}><option value="">Min</option>{[21, 22, 23, 24, 25, 26, 27, 28, 30, 32].map((a) => <option key={a}>{a}</option>)}</select><span>–</span>
              <select className="select" value={q.ageMax} onChange={set('ageMax')}><option value="">Max</option>{[25, 27, 28, 30, 32, 35, 38, 40].map((a) => <option key={a}>{a}</option>)}</select></div></div>
            <div className="field"><label>Education</label><select className="select" value={q.eduGroup} onChange={set('eduGroup')}><option value="">Select</option>{look?.eduGroups?.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Job</label><select className="select" value={q.jobGroup} onChange={set('jobGroup')}><option value="">Select</option>{look?.jobGroups?.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label>Diocese</label><select className="select" value={q.diocese} onChange={set('diocese')}><option value="">Select</option>{look?.dioceses?.map((x) => <option key={x}>{x}</option>)}</select></div>
            <button className="btn btn-primary">Search</button>
          </div>
        </form>
      </section>

      <section className="container row-2 sm-gap">
        <div>
          <div className="sec-head">
            <span className="sec-ico"><i className="fa-regular fa-heart" /></span>
            <div><h2>Success Stories</h2><p>Real couples. Real stories. United in faith.</p></div>
            <Link className="btn btn-outline btn-pill btn-sm" to="/stories">View All Stories <i className="fa-solid fa-arrow-right" /></Link>
          </div>
          <div className="stories">
            {stories.length > 1 && <button className="car-btn l" aria-label="Previous" onClick={() => setOff((off - 1 + stories.length) % stories.length)}><i className="fa-solid fa-chevron-left" /></button>}
            {shown.length > 0 ? (
              shown.map((s) => (
                <Link key={s.id} className="story" to={`/stories#${s.id}`}>
                  {s.img && !s.img.startsWith('/img/story') && !s.img.startsWith('/img/hero') && !s.img.startsWith('/img/mag') && !s.img.startsWith('/img/banner') ? (
                    <img src={s.img} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : null}
                  <blockquote>{s.text}<cite>– {s.couple}</cite></blockquote>
                </Link>
              ))
            ) : (
              <div className="muted" style={{ padding: '24px', textAlign: 'center', width: '100%' }}>No published stories yet.</div>
            )}
            {stories.length > 1 && <button className="car-btn r" aria-label="Next" onClick={() => setOff((off + 1) % stories.length)}><i className="fa-solid fa-chevron-right" /></button>}
          </div>
        </div>
        <div>
          <div className="sec-head">
            <span className="sec-ico"><i className="fa-solid fa-book-open" /></span>
            <div><h2>Magazine</h2><p>Articles, reflections and resources for a happy Catholic family life.</p></div>
            <Link className="btn btn-outline btn-pill btn-sm" to="/magazine">View All Articles <i className="fa-solid fa-arrow-right" /></Link>
          </div>
          <div className="mags">
            {articles.length > 0 ? (
              articles.slice(0, 3).map((a) => <Link key={a.id} className="mag" to={`/magazine/${a.id}`}><img src={a.img} alt="" /><h4>{a.title}</h4><time>{fmt(a.date)}</time></Link>)
            ) : (
              <div className="muted" style={{ padding: '24px', textAlign: 'center' }}>No articles published yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="community">
        <img className="community-img" src="/img/church-banner.jpg" alt="Church" />
        <div className="container community-inner">
          <blockquote>“A Community Journeying Together<br />Towards Holy and Happy Families”<span className="flourish">✦ ❦ ✦</span></blockquote>
          <div className="stats">
            <div><span className="ico"><i className="fa-solid fa-user-group" /></span><b>{stats ? stats.members : '…'}</b>Registered Members</div>
            <div><span className="ico"><i className="fa-solid fa-heart" /></span><b>{stats ? stats.couples : '…'}</b>Successful Matches</div>
            <div><span className="ico"><i className="fa-solid fa-church" /></span><b>{stats ? stats.active : '…'}</b>Active Profiles</div>
            <div><span className="ico"><i className="fa-solid fa-star" /></span><b>{stats ? stats.dioceses : '…'}</b>Dioceses</div>
          </div>
        </div>
      </section>

      <section className="container info-row">
        <div>
          <h3 className="info-h"><Link to="/about"><i className="fa-solid fa-people-roof" />About Us</Link></h3>
          <p>The Family Apostolate of Thrissur Archdiocese is committed to nurturing strong Christian families by supporting young men and women in finding life partners within the Catholic community.</p>
          <Link className="btn btn-outline btn-sm" to="/about">Learn More <i className="fa-solid fa-arrow-right" /></Link>
        </div>
        <div>
          <h3 className="info-h"><Link to="/location"><i className="fa-solid fa-location-dot" />Our Location</Link></h3>
          <div className="loc">
            <img src="/img/map.jpg" alt="Map" /><img src="/img/church.jpg" alt="Office" />
            <div><b>Family Apostolate<br />Archdiocese of Thrissur</b><p>P.B. No. 36, Thrissur, Kerala – 680001</p>
              <Link className="btn btn-outline btn-sm" to="/location">Get Directions <i className="fa-solid fa-arrow-right" /></Link></div>
          </div>
        </div>
        <div>
          <h3 className="info-h"><Link to="/contact"><i className="fa-solid fa-phone" />Contact Us</Link></h3>
          <ul className="contact-list">
            <li><i className="fa-solid fa-phone" /><a href="tel:+914872421234">+91 487 242 1234</a></li>
            <li><i className="fa-regular fa-envelope" /><a href="mailto:familyapostolatetsr@gmail.com">familyapostolatetsr@gmail.com</a></li>
            <li><i className="fa-regular fa-clock" />Mon – Sat : 9:00 AM – 5:00 PM</li>
          </ul>
          <Link className="btn btn-outline btn-sm" to="/contact" style={{ marginTop: 10 }}>Send us a message <i className="fa-solid fa-arrow-right" /></Link>
        </div>
      </section>
    </main>
  );
}
