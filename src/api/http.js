/* ============================================================
   HTTP API CLIENT – talks to the real backend (see API.md).
   Same function names / return shapes as the mock API.
   Base URL comes from VITE_API_BASE_URL. Auth = Bearer token.
   ============================================================ */
import { compressImageFile, fileToDataUrl } from '../lib/utils';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
let token = null;

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
  setToken(t) { token = t; },

  // auth & password reset
  login: (b) => post('/auth/login', b),
  me: () => get('/auth/me'),
  logout: () => post('/auth/logout'),
  sendPasswordResetOtp: (email) => post('/auth/forgot-password/send-otp', { email }),
  verifyPasswordResetOtp: (email, otp) => post('/auth/forgot-password/verify-otp', { email, otp }),
  resetPasswordWithOtp: (email, otp, newPassword) => post('/auth/forgot-password/reset', { email, otp, newPassword }),

  // public
  getLookups: () => get('/lookups'),
  getDioceses: () => get('/dioceses'),
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
  getMyProfile: () => get('/me/profile'),
  getSummary: () => get('/me/summary'),
  markNotificationsRead: () => post('/me/notifications/read'),
  renew: (data) => post('/me/renew', data),
  requestHold: (b) => post('/me/hold', b),
  cancelHoldRequest: () => del('/me/hold'),
  resumeFromHold: () => post('/me/hold/resume'),
  reportMarried: (b) => post('/me/married', b),

  // member – discovery
  discover: (filters) => get('/me/discover', filters),
  getProfile: (id) => get(`/profiles/${id}`),
  decide: (id, type) => post(`/profiles/${id}/decision`, { type }),
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
