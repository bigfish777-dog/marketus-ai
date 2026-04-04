const { getSupabase, json } = require('./_lib/shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const supabase = getSupabase();
    if (!body.id) return json(res, 400, { error: 'Missing audit id' });

    const { error } = await supabase
      .from('marketus_audits')
      .update({
        summary_fit: body.summary_fit || null,
        summary_notes: body.summary_notes || null,
        status: 'submitted'
      })
      .eq('id', body.id);

    if (error) throw error;
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Failed to submit audit' });
  }
};
