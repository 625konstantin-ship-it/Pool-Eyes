let sb = null;

const PHOTO_BUCKET = 'pool-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function isSupabaseConfigured() {
  return typeof SUPABASE_URL === 'string'
    && typeof SUPABASE_ANON_KEY === 'string'
    && SUPABASE_URL.includes('supabase.co')
    && !SUPABASE_URL.includes('YOUR_PROJECT')
    && SUPABASE_ANON_KEY.length > 20;
}

function initSupabaseClient() {
  if (!window.supabase?.createClient) return null;
  if (!isSupabaseConfigured()) return null;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}

function getSupabase() {
  return sb;
}

function mapUser(session) {
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    displayLogin: u.user_metadata?.display_name || u.email
  };
}

function mapPoolRow(row) {
  return {
    id: row.id,
    name: row.name,
    volume: Number(row.volume) || 25000,
    treatmentType: row.treatment_type === 'peroxide' ? 'peroxide' : 'chlorine',
    location: row.location || { address: '', lat: null, lng: null }
  };
}

function mapMeasurementRow(row) {
  return {
    id: row.id,
    poolId: row.pool_id,
    ph: Number(row.ph),
    chlorine: Number(row.chlorine),
    temperature: Number(row.temperature),
    date: row.measured_at
  };
}

function mapChemistryRow(row) {
  return {
    id: row.id,
    poolId: row.pool_id,
    chemical: row.chemical,
    amount: Number(row.amount),
    unit: row.unit || 'г',
    comment: row.comment || '',
    date: row.logged_at
  };
}

function mapPhotoRow(row) {
  return {
    id: row.id,
    poolId: row.pool_id,
    storagePath: row.storage_path,
    caption: row.caption || '',
    date: row.created_at
  };
}

async function authSignUp(email, password, displayName) {
  if (!sb) return { ok: false, error: 'Supabase не подключён. Обновите страницу.' };
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName?.trim() || email.trim() }
    }
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  if (!data.session) {
    return {
      ok: true,
      needsConfirmation: true,
      message: 'Проверьте почту и подтвердите регистрацию по ссылке из письма.'
    };
  }
  return { ok: true, user: mapUser(data.session), session: data.session };
}

async function authSignIn(email, password) {
  if (!sb) return { ok: false, error: 'Supabase не подключён. Обновите страницу.' };
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true, user: mapUser(data.session), session: data.session };
}

async function authSignOut() {
  await sb.auth.signOut();
}

async function authResetPassword(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return {
    ok: true,
    message: 'Ссылка для сброса пароля отправлена на ' + email.trim() + '. Проверьте почту и спам.'
  };
}

async function authGetSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

function translateAuthError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль.';
  if (msg.includes('User already registered')) return 'Этот email уже зарегистрирован.';
  if (msg.includes('Email not confirmed')) return 'Подтвердите email — проверьте почту.';
  if (msg.includes('Password should be at least')) return 'Пароль — минимум 6 символов.';
  if (msg.includes('invalid') && msg.toLowerCase().includes('email')) return 'Некорректный email. Используйте формат name@gmail.com';
  if (msg.includes('rate limit')) return 'Слишком много попыток. Подождите 1–2 минуты и попробуйте снова.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Нет связи с сервером. Проверьте интернет.';
  return msg;
}

async function dbLoadUserData(userId) {
  const [poolsRes, measRes, chemRes, photosRes] = await Promise.all([
    sb.from('pools').select('*').eq('user_id', userId).order('created_at'),
    sb.from('measurements').select('*').eq('user_id', userId).order('measured_at', { ascending: false }),
    sb.from('chemistry_log').select('*').eq('user_id', userId).order('logged_at', { ascending: false }),
    sb.from('pool_photos').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);

  if (poolsRes.error) throw poolsRes.error;
  if (measRes.error) throw measRes.error;
  if (chemRes.error) throw chemRes.error;
  if (photosRes.error) throw photosRes.error;

  const selectedProblems = {};
  const poolList = (poolsRes.data || []).map(row => {
    selectedProblems[row.id] = Array.isArray(row.problem_ids) ? row.problem_ids : [];
    return mapPoolRow(row);
  });

  return {
    poolList,
    measurements: (measRes.data || []).map(mapMeasurementRow),
    chemistryLog: (chemRes.data || []).map(mapChemistryRow),
    poolPhotos: (photosRes.data || []).map(mapPhotoRow),
    selectedProblems
  };
}

async function dbUpsertPool(userId, pool, problemIds) {
  const { error } = await sb.from('pools').upsert({
    id: pool.id,
    user_id: userId,
    name: pool.name,
    volume: pool.volume,
    treatment_type: pool.treatmentType || 'chlorine',
    location: pool.location || { address: '', lat: null, lng: null },
    problem_ids: problemIds || []
  });
  if (error) throw error;
}

async function dbDeletePool(poolId) {
  const { data: photos } = await sb.from('pool_photos').select('storage_path').eq('pool_id', poolId);
  if (photos?.length) {
    await sb.storage.from(PHOTO_BUCKET).remove(photos.map(p => p.storage_path));
  }
  const { error } = await sb.from('pools').delete().eq('id', poolId);
  if (error) throw error;
}

async function dbInsertMeasurement(userId, m) {
  const { data, error } = await sb.from('measurements').insert({
    id: m.id,
    user_id: userId,
    pool_id: m.poolId,
    ph: m.ph,
    chlorine: m.chlorine,
    temperature: m.temperature,
    measured_at: m.date
  }).select().single();
  if (error) throw error;
  return mapMeasurementRow(data);
}

async function dbClearMeasurements(poolId) {
  const { error } = await sb.from('measurements').delete().eq('pool_id', poolId);
  if (error) throw error;
}

async function dbInsertChemistry(userId, c) {
  const { data, error } = await sb.from('chemistry_log').insert({
    id: c.id,
    user_id: userId,
    pool_id: c.poolId,
    chemical: c.chemical,
    amount: c.amount,
    unit: c.unit,
    comment: c.comment,
    logged_at: c.date
  }).select().single();
  if (error) throw error;
  return mapChemistryRow(data);
}

async function dbClearChemistry(poolId) {
  const { error } = await sb.from('chemistry_log').delete().eq('pool_id', poolId);
  if (error) throw error;
}

async function dbCreateDefaultPool(userId) {
  const pool = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: 'Мой бассейн',
    volume: 25000,
    treatment_type: 'chlorine',
    location: { address: '', lat: null, lng: null },
    problem_ids: []
  };
  const { data, error } = await sb.from('pools').insert(pool).select().single();
  if (error) throw error;
  return mapPoolRow(data);
}

async function dbGetPhotoUrl(storagePath) {
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function dbUploadPhoto(userId, poolId, file, caption) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Формат не поддерживается. Используйте JPG, PNG или WebP.');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Файл слишком большой. Максимум 5 МБ.');
  }

  const photoId = crypto.randomUUID();
  const extMap = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const ext = extMap[file.type] || 'jpg';
  const storagePath = `${userId}/${poolId}/${photoId}.${ext}`;

  const { error: uploadError } = await sb.storage.from(PHOTO_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data, error } = await sb.from('pool_photos').insert({
    id: photoId,
    user_id: userId,
    pool_id: poolId,
    storage_path: storagePath,
    caption: (caption || '').trim()
  }).select().single();

  if (error) {
    await sb.storage.from(PHOTO_BUCKET).remove([storagePath]);
    throw error;
  }

  return mapPhotoRow(data);
}

async function dbDeletePhoto(photo) {
  const { error: storageError } = await sb.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
  if (storageError) throw storageError;
  const { error } = await sb.from('pool_photos').delete().eq('id', photo.id);
  if (error) throw error;
}
