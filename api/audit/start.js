const { getSupabase, json, cleanUrl } = require('./_lib/shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const supabase = getSupabase();
    const payload = {
      first_name: body.first_name || null,
      email: body.email || null,
      website: cleanUrl(body.website) || null,
      agency_size: body.agency_size || null,
      challenge: body.challenge || null,
      status: 'step_1_complete'
    };

    const { data, error } = await supabase.from('marketus_audits').insert(payload).select('id').single();
    if (error) throw error;
    return json(res, 200, { id: data.id });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Failed to start audit' });
  }
};
