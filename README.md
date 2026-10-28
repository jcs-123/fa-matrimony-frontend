# Family Apostolate Matrimony – Front End (React + Vite)

Catholic matrimonial website for the Family Apostolate, Archdiocese of Thrissur. User side and admin side, built with **React 18 + Vite 5 + React Router 6**.
The backend is built separately. Until it is ready the app runs on a **built-in mock API** with 40 sample members, so every screen works.

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production files in dist/
npm run preview    # serve the built dist/ at http://localhost:4173
```
Requires Node 18+.

## Demo logins (mock mode)
| Role | Username | Password | What you'll see |
|---|---|---|---|
| Admin | `admin` | `admin@123` | Login page → **Admin** tab |
| Admin (office) | `office` | `office@123` | |
| Groom | `joseph@demo.com` | `joseph123` | Active, 3 matches with chats, brides who liked him |
| Bride | `aleena@demo.com` | `aleena123` | Active, matched with Joseph and Ashwin |
| On-hold member | `sanju@demo.com` | `sanju123` | Account on hold – only My Profile, with **Resume** |
| Hold requested | `merin@demo.com` | `merin123` | Has a pending hold request |
| Pending member | `maria@demo.com` | `maria123` | Login blocked until admin approves |

All sample members: `firstname@demo.com` / `firstname123` (the two Snehas: `sneha.rose@…` / `sneha.rose123`, `sneha.maria@…` / `sneha.maria123`).
Admin → **Reset Demo Data** restores the sample data.

## Features
**Public:** Home, Magazine (+ article reader), Success Stories (+ share your story), About Us (how it works, FAQ), Location (Google Map), Contact (form → admin Enquiries), Login, 6-step Register (3 photos + ID proof + ₹500 payment choice).

**Member:** My Profile (tabs + office notifications), Search (age, qualification, job, height, diocese), Match (swipe / ✕ / ♥ / ★, mutual-match pop-up), Profile & Profile Details, Chat (mutual matches only). Men see only women and women see only men.

**New – Account hold:** My Profile → *Account & Hold* → choose 1/2/3/6 months + reason → the office approves in **Admin → Hold Requests** (it can change the months or reject with a note). While on hold the profile is hidden, the member can only open My Profile, and the membership is **extended by the hold period**. The member can **Resume** early; unused days are taken back. The admin can also place or release a hold from Verify Profile.

**New – Married:** My Profile → *Account & Hold* → **I got married** (date, spouse, met here or not, partner, share story). The profile is hidden at once and the login is closed. The admin sees it in **Admin → Married – Delete** and deletes the account (or restores it if reported by mistake). Admin can also mark a member married.

**Admin:** Dashboard (KPIs, needs-attention queues, 7-month trend, renewals due, latest registrations), Registrations (filters incl. On Hold, search, sort by date, approve / notify / renew / married / delete, add member at office), Verify (photos, ID, payment, edit details, approve/reject, hold, marriage, activity), Hold Requests, Married – Delete, Monthly Reports (PDF print + CSV, includes on-hold count), Enquiries.

## Connecting the real backend
1. Give the backend developer **`API.md`** – the full REST contract (endpoints, JSON shapes, status rules, hold & married rules).
2. In `.env` set:
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=https://your-api.example.org/api     # or /api with the dev proxy
   ```
   For local development with their server on another port: `API_PROXY_TARGET=https://newfab.trichurfamilyapostolate.org npm run dev`.
3. Nothing else changes – every page calls `src/api/index.js`, which switches between `mock/mockApi.js` and `http.js`.
4. Before going live, confirm the office address, phone, email and the map pin (`src/pages/public/Location.jsx`, `Contact.jsx`, `Home.jsx`).

## Project structure
```
src/
  api/            index.js (mock ⇄ http switch) · http.js (real API client) · mock/mockApi.js + mock/seed.json
  context/        AuthContext (login, token, header summary) · ToastContext
  components/     Header, Footer, PageHero, PublicLayout, AdminLayout, Guards, ui (Modal, Gallery, Pill…), ProfileParts
  pages/public/   Home, Magazine, Article, Stories, About, Location, Contact, Login, Register, NotFound
  pages/member/   MyProfile (Account & Hold, Married), Search, Match, ProfileView, ProfileDetails, Chat
  pages/admin/    Dashboard, Members, Verify, Holds, Married, Reports, Enquiries
  lib/            utils (dates, formatting), useAsync hook
  styles/         style.css, pages.css, admin.css (the approved design) + react.css (additions)
public/img/       images (logo, photos from the reference designs)
```

## Routes
`/` `/magazine` `/magazine/:id` `/stories` `/about` `/location` `/contact` `/login` `/register` ·
member: `/my-profile` `/search` `/match` `/profile/:id` `/profile/:id/details` `/chat` `/chat/:id` ·
admin: `/admin` `/admin/members` `/admin/verify/:id` `/admin/holds` `/admin/married` `/admin/reports` `/admin/enquiries`

## Deploying the built site
`dist/` is a single-page app: configure the web server to send unknown paths to `index.html`
(Apache: `FallbackResource /index.html`; Nginx: `try_files $uri /index.html;`). Opening `dist/index.html` directly from disk will not work – use `npm run preview` or a web server.

## Notes
- In mock mode, data is saved in the browser (localStorage). Each browser has its own copy.
- Sample photos are crops of the reference designs, so several sample members look alike.
