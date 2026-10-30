/* ============================================================
   HTTP API CLIENT – talks to the real backend (see API.md).
   Same function names / return shapes as the mock API.
   Base URL comes from VITE_API_BASE_URL. Auth = Bearer token.
   ============================================================ */
import { compressImageFile, fileToDataUrl } from '../lib/utils';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
let token = null;
const profileCache = new Map();
const inFlightProfiles = new Map();

export class ApiError extends Error { constructor(message, status = 400, data) { super(message); this.status = status; this.data = data; } }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(method, path, body, { query, form } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;                                   // multipart – browser sets the boundary
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, { method, headers, body: payload });
      if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      break;
    } catch (e) {
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw new ApiError('Cannot reach the server. Please check your internet connection.', 0);
    }
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data);
  return data;
}
const get = (p, query) => request('GET', p, undefined, { query });
const post = (p, b) => request('POST', p, b ?? {});
const patch = (p, b) => request('PATCH', p, b);
const del = (p) => request('DELETE', p);

/* fields → JSON part "data"; files → photos[] / idProof parts (auto-compressed) */
async function multipart(fields, files = {}) {
  const fd = new FormData();
  fd.append('data', JSON.stringify(fields));
  const rawPhotos = (files.photos || []).filter(Boolean);
  for (const f of rawPhotos) {
    const comp = await compressImageFile(f, 800, 0.75);
    fd.append('photos', comp);
  }
  if (files.idProof) {
    const compId = files.idProof.type?.startsWith('image/')
      ? await compressImageFile(files.idProof, 1000, 0.75)
      : files.idProof;
    fd.append('idProof', compId);
  }
  if (files.parishLetter) {
    const compPl = files.parishLetter.type?.startsWith('image/')
      ? await compressImageFile(files.parishLetter, 1000, 0.75)
      : files.parishLetter;
    fd.append('parishLetter', compPl);
  }
  return fd;
}

const readFileAsDataUrl = (file) => new Promise((resolve) => {
  if (!file) return resolve(null);
  if (file.type?.startsWith('image/')) return fileToDataUrl(file, 900, 0.78).then(resolve);
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(file);
});

async function syncMemberPhotos(memberId, files = {}) {
  try {
    if (!memberId) return;
    const rawPhotos = (files.photos || []).filter(Boolean);
    const dataUrls = (await Promise.all(rawPhotos.map((f) => fileToDataUrl(f, 500, 0.72)))).filter(Boolean);
    const idProofDataUrl = files.idProof ? await readFileAsDataUrl(files.idProof) : null;
    const parishLetterDataUrl = files.parishLetter ? await readFileAsDataUrl(files.parishLetter) : null;
    if (dataUrls.length || idProofDataUrl || parishLetterDataUrl) {
      if (token) {
        try {
          const patchPayload = {};
          if (dataUrls.length) patchPayload.photos = dataUrls;
          if (idProofDataUrl) {
            patchPayload.idProof = {
              type: 'Aadhaar / ID',
              file: files.idProof?.name || 'id-proof.pdf',
              verified: false,
              url: idProofDataUrl
            };
          }
          if (parishLetterDataUrl) {
            patchPayload.parishLetter = {
              file: files.parishLetter?.name || 'parish-letter.pdf',
              url: parishLetterDataUrl
            };
          }
          await patch(`/admin/members/${memberId}`, patchPayload);
        } catch {
          // ignore if current token is not admin
        }
      }
      await post('/__sync-member-photos', {
        id: memberId,
        photos: dataUrls,
        idProofDataUrl,
        parishLetterDataUrl
      });
    }
  } catch {
    // ignore if sync endpoint is unavailable
  }
}

export const httpApi = {
  setToken(t) {
    if (token !== t) {
      profileCache.clear();
      inFlightProfiles.clear();
    }
    token = t;
  },

  // auth & password reset
  login: (b) => post('/auth/login', b),
  me: () => get('/auth/me'),
  logout: () => post('/auth/logout'),
  sendPasswordResetOtp: (email) => post('/auth/forgot-password/send-otp', { email }),
  verifyPasswordResetOtp: (email, otp) => post('/auth/forgot-password/verify-otp', { email, otp }),
  resetPasswordWithOtp: (email, otp, newPassword) => post('/auth/forgot-password/reset', { email, otp, newPassword }),

  // public & master lookups strictly from MongoDB
  getLookups: async () => {
    const remote = await get('/lookups');
    const jobGroups = Array.isArray(remote?.jobGroups) ? remote.jobGroups : [];
    const parishes = Array.isArray(remote?.parishes) ? remote.parishes : [];
    const eduGroups = Array.isArray(remote?.eduGroups) ? remote.eduGroups : [];
    const dioceses = Array.isArray(remote?.dioceses) ? remote.dioceses : [];

    return {
      ...(remote || {}),
      jobGroups,
      jobs: jobGroups,
      jobList: Array.isArray(remote?.jobList) ? remote.jobList : [],
      parishes,
      parishList: Array.isArray(remote?.parishList) ? remote.parishList : [],
      eduGroups,
      educationList: Array.isArray(remote?.educationList) ? remote.educationList : [],
      dioceses,
      dioceseList: Array.isArray(remote?.dioceseList) ? remote.dioceseList : [],
      settings: remote?.settings || { planFee: 500, planMonths: 6, reminderDays: 30, maxHoldMonths: 6 }
    };
  },

  // Real-time MongoDB CRUD for Jobs, Parishes, Educations & Dioceses
  getJobs: () => get('/jobs'),
  createJob: async (b) => { const r = await post('/jobs', b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  updateJob: async (id, b) => { const r = await patch(`/jobs/${id}`, b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  deleteJob: async (id) => { const r = await del(`/jobs/${id}`); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },

  getParishes: () => get('/parishes'),
  createParish: async (b) => { const r = await post('/parishes', b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  updateParish: async (id, b) => { const r = await patch(`/parishes/${id}`, b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  deleteParish: async (id) => { const r = await del(`/parishes/${id}`); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },

  getEducations: () => get('/educations'),
  createEducation: async (b) => { const r = await post('/educations', b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  updateEducation: async (id, b) => { const r = await patch(`/educations/${id}`, b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  deleteEducation: async (id) => { const r = await del(`/educations/${id}`); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },

  getDioceses: () => get('/dioceses'),
  createDiocese: async (b) => { const r = await post('/dioceses', b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  updateDiocese: async (id, b) => { const r = await patch(`/dioceses/${id}`, b); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  deleteDiocese: async (id) => { const r = await del(`/dioceses/${id}`); window.dispatchEvent(new Event('fa:lookups-changed')); return r; },
  getPublicStats: () => get('/stats/public'),
  getArticles: () => get('/articles'),
  getArticle: (id) => get(`/articles/${id}`),
  getStories: () => get('/stories'),
  submitEnquiry: async (b, photoFile) => {
    if (photoFile) {
      const dataUrl = await fileToDataUrl(photoFile, 800, 0.78);
      if (dataUrl) {
        return post('/enquiries', { ...b, photo: dataUrl });
      }
      const comp = await compressImageFile(photoFile, 1000, 0.78);
      const fd = new FormData();
      Object.entries(b).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      fd.append('photo', comp);
      return request('POST', '/enquiries', undefined, { form: fd });
    }
    return post('/enquiries', b);
  },
  uploadPhoto: async (file) => {
    const dataUrl = await fileToDataUrl(file, 800, 0.78);
    if (dataUrl) {
      return { ok: true, url: dataUrl };
    }
    const comp = await compressImageFile(file, 1000, 0.78);
    const fd = new FormData();
    fd.append('photo', comp);
    return request('POST', '/upload/photo', undefined, { form: fd });
  },
  register: async (fields, files) => {
    const res = await request('POST', '/members/register', undefined, { form: await multipart(fields, files) });
    if (res?.id) await syncMemberPhotos(res.id, files);
    return res;
  },

  // member – own account
  getMyProfile: async () => {
    const m = await get('/me/profile');
    if (m && m.stats) {
      const totalLikedMe = m.stats.totalLikedMe ?? ((m.stats.likedMe || 0) + (m.stats.matches || 0));
      m.stats = {
        ...m.stats,
        pendingLikedMe: m.stats.likedMe || 0,
        likedMe: totalLikedMe
      };
    }
    return m;
  },
  getSummary: async () => {
    const s = await get('/me/summary');
    if (s) {
      const totalLikedMe = s.totalLikedMe ?? ((s.likedMe || 0) + (s.matches || 0));
      return {
        ...s,
        pendingLikedMe: s.likedMe || 0,
        likedMe: totalLikedMe
      };
    }
    return s;
  },
  markNotificationsRead: () => post('/me/notifications/read'),
  renew: (data) => post('/me/renew', data),
  requestHold: (b) => post('/me/hold', b),
  cancelHoldRequest: () => del('/me/hold'),
  resumeFromHold: () => post('/me/hold/resume'),
  reportMarried: (b) => post('/me/married', b),

  // member – discovery
  discover: (filters) => get('/me/discover', filters),
  getProfile: async (id) => {
    const cacheKey = `${token || 'anon'}:${id}`;
    if (profileCache.has(cacheKey)) {
      return { ...profileCache.get(cacheKey) };
    }
    if (inFlightProfiles.has(cacheKey)) {
      const data = await inFlightProfiles.get(cacheKey);
      return { ...data };
    }
    const promise = get(`/profiles/${id}`, { trackView: '1' })
      .then((data) => {
        if (data) profileCache.set(cacheKey, data);
        inFlightProfiles.delete(cacheKey);
        return data;
      })
      .catch((err) => {
        inFlightProfiles.delete(cacheKey);
        throw err;
      });
    inFlightProfiles.set(cacheKey, promise);
    const data = await promise;
    return { ...data };
  },
  decide: async (id, type) => {
    const res = await post(`/profiles/${id}/decision`, { type });
    const cacheKey = `${token || 'anon'}:${id}`;
    if (profileCache.has(cacheKey)) {
      const cached = profileCache.get(cacheKey);
      profileCache.set(cacheKey, {
        ...cached,
        relation: {
          ...(cached.relation || {}),
          myDecision: type,
          mutual: !!res?.mutual
        }
      });
    }
    return res;
  },
  reportProfile: (id, reason) => post(`/profiles/${id}/report`, { reason }),
  blockMember: (id, reason) => post(`/me/block/${id}`, { reason }),
  unblockMember: (id) => post(`/me/unblock/${id}`),
  getBlockedMembers: () => get('/me/blocked'),
  reportMessage: (id, messageId, reason) => post(`/me/messages/${id}/report`, { messageId, reason }),
  getMatches: () => get('/me/matches'),
  getLikedMe: () => get('/me/liked-me'),
  getThread: (id) => get(`/me/messages/${id}`),
  sendMessage: (id, text) => post(`/me/messages/${id}`, { text }),

  // admin
  adminSummary: () => get('/admin/summary'),
  listMembers: (q) => get('/admin/members', q),
  getMember: (id) => get(`/admin/members/${id}`),
  createMember: async (fields, files) => {
    const res = await request('POST', '/members/register', undefined, { form: await multipart(fields, files) });
    if (res?.id) await syncMemberPhotos(res.id, files);
    return res;
  },
  updateMember: (id, b) => patch(`/admin/members/${id}`, b),
  setPayment: (id, paid) => post(`/admin/members/${id}/payment`, { paid }),
  setIdVerified: (id, verified) => post(`/admin/members/${id}/id-verified`, { verified }),
  approveMember: (id) => post(`/admin/members/${id}/approve`),
  rejectMember: (id, remarks) => post(`/admin/members/${id}/reject`, { remarks }),
  renewMember: (id) => post(`/admin/members/${id}/renew`),
  markMarried: (id, info) => post(`/admin/members/${id}/married`, info || {}),
  deleteMember: (id) => del(`/admin/members/${id}`),
  notifyRenewal: (ids) => post('/admin/notifications/renewal', { ids }),
  replacePhoto: async (id, index, file) => {
    const dataUrl = await fileToDataUrl(file, 700, 0.76);
    if (dataUrl) {
      const m = await get(`/admin/members/${id}`);
      const photos = Array.isArray(m?.photos) ? [...m.photos] : [];
      photos[index] = dataUrl;
      return patch(`/admin/members/${id}`, { photos });
    }
    const fd = new FormData();
    fd.append('index', index);
    fd.append('photo', file);
    return request('POST', `/admin/members/${id}/photos`, undefined, { form: fd });
  },
  replaceDocument: async (id, file, field = 'idProof') => {
    const dataUrl = await readFileAsDataUrl(file);
    if (!dataUrl) throw new ApiError('Could not read document file');
    const m = await get(`/admin/members/${id}`);
    const existing = m?.[field] || {};
    return patch(`/admin/members/${id}`, {
      [field]: {
        ...existing,
        type: existing.type || 'Aadhaar / ID',
        file: file.name || existing.file || 'id-proof.pdf',
        url: dataUrl
      }
    });
  },
  listHolds: (status) => get('/admin/holds', { status }),
  decideHold: (id, b) => post(`/admin/members/${id}/hold/decision`, b),
  placeHold: (id, b) => post(`/admin/members/${id}/hold`, b),
  releaseHold: (id) => del(`/admin/members/${id}/hold`),
  listMarried: () => get('/admin/married'),
  monthlyReport: (month, year) => get('/admin/reports/monthly', typeof month === 'object' ? month : { month, year }),
  trend: (months, year) => get('/admin/reports/trend', typeof months === 'object' ? months : { months, year }),
  listEnquiries: (status) => get('/admin/enquiries', { status }),
  updateEnquiry: (id, b) => patch(`/admin/enquiries/${id}`, b),
  listAdminStories: () => get('/admin/stories'),
  createAdminStory: (b) => post('/admin/stories', b),
  updateAdminStory: (id, b) => patch(`/admin/stories/${id}`, b),
  deleteAdminStory: (id) => del(`/admin/stories/${id}`),
  listUserReports: (status) => get('/admin/user-reports', status ? { status } : undefined),
  updateReportStatus: (id, status) => patch(`/admin/user-reports/${id}`, { status }),
  deleteReport: (id) => del(`/admin/user-reports/${id}`),
  listBlocks: () => get('/admin/blocks'),
  adminUnblock: (id) => del(`/admin/blocks/${id}`),
  resetDemo: () => Promise.reject(new ApiError('Reset is only available in mock mode.'))
};
