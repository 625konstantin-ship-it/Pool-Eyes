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
    location: row.location || { address: '', lat: null, lng: null },
    remindersEnabled: !!row.reminders_enabled,
    reminderIntervalDays: Number(row.reminder_interval_days) || 7
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
  if (!sb) return { ok: false, error: t('auth.error.supabaseDisconnected') };
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
      message: t('auth.checkEmailConfirm')
    };
  }
  return { ok: true, user: mapUser(data.session), session: data.session };
}

async function authSignIn(email, password) {
  if (!sb) return { ok: false, error: t('auth.error.supabaseDisconnected') };
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
    redirectTo: getPasswordResetRedirectUrl()
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return {
    ok: true,
    message: t('auth.resetEmailSent', { email: email.trim() })
  };
}

async function authUpdatePassword(password) {
  if (!sb) return { ok: false, error: t('auth.error.supabaseDisconnected') };
  const { data, error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true, user: data.user };
}

function getPasswordResetRedirectUrl() {
  let path = window.location.pathname;
  if (path.endsWith('/index.html')) {
    path = path.slice(0, -'index.html'.length);
  }
  if (!path.endsWith('/')) path += '/';
  return window.location.origin + path;
}

async function authGetSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
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

async function dbUpdatePoolReminders(poolId, enabled, intervalDays) {
  const { error } = await sb.from('pools').update({
    reminders_enabled: !!enabled,
    reminder_interval_days: Number(intervalDays) || 7
  }).eq('id', poolId);
  if (error) throw error;
}

async function dbUpsertPool(userId, pool, problemIds) {
  const { error } = await sb.from('pools').upsert({
    id: pool.id,
    user_id: userId,
    name: pool.name,
    volume: pool.volume,
    treatment_type: pool.treatmentType || 'chlorine',
    location: pool.location || { address: '', lat: null, lng: null },
    problem_ids: problemIds || [],
    reminders_enabled: !!pool.remindersEnabled,
    reminder_interval_days: Number(pool.reminderIntervalDays) || 7
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
    name: t('pool.defaultName'),
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
    throw new Error(t('error.photoFormat'));
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(t('error.photoSize'));
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

function mapTelegramSettings(row) {
  if (!row) return null;
  return {
    telegramChatId: row.telegram_chat_id,
    remindersEnabled: !!row.reminders_enabled,
    reminderIntervalDays: Number(row.reminder_interval_days) || 7,
    reminderHour: Number(row.reminder_hour) ?? 9,
    timezone: row.timezone || 'Europe/Kyiv',
    lastReminderSentAt: row.last_reminder_sent_at
  };
}

async function dbGetTelegramSettings(userId) {
  const { data, error } = await sb
    .from('user_telegram_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return mapTelegramSettings(data);
}

async function dbEnsureTelegramSettings(userId) {
  let settings = await dbGetTelegramSettings(userId);
  if (settings) return settings;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
  const { data, error } = await sb.from('user_telegram_settings').insert({
    user_id: userId,
    reminders_enabled: false,
    reminder_interval_days: 7,
    reminder_hour: 9,
    timezone
  }).select().single();

  if (error) throw error;
  return mapTelegramSettings(data);
}

async function dbSaveTelegramSettings(userId, patch) {
  await dbEnsureTelegramSettings(userId);
  const payload = {};
  if (patch.remindersEnabled !== undefined) payload.reminders_enabled = patch.remindersEnabled;
  if (patch.reminderIntervalDays !== undefined) payload.reminder_interval_days = patch.reminderIntervalDays;
  if (patch.reminderHour !== undefined) payload.reminder_hour = patch.reminderHour;
  if (patch.timezone !== undefined) payload.timezone = patch.timezone;
  if (patch.telegramChatId !== undefined) payload.telegram_chat_id = patch.telegramChatId;
  if (patch.clearLinkToken) {
    payload.link_token = null;
    payload.link_token_expires_at = null;
  }

  const { data, error } = await sb
    .from('user_telegram_settings')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return mapTelegramSettings(data);
}

async function dbCreateTelegramLinkToken(userId) {
  await dbEnsureTelegramSettings(userId);
  const token = crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('user_telegram_settings')
    .update({
      link_token: token,
      link_token_expires_at: expires
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return { token, settings: mapTelegramSettings(data) };
}

async function dbSendTestTelegramReminder() {
  const { data, error } = await sb.functions.invoke('send-test-reminder', { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
