const { getSupabase, json } = require('./_lib/shared');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    const supabase = getSupabase();
    const id = req.query.id;
    if (!id) return json(res, 400, { error: 'Missing audit id' });

    const { data, error } = await supabase
      .from('marketus_audits')
      .select('id, first_name, generated_summary, ai_setup, biggest_opportunity, challenge, website, agency_size, tools')
      .eq('id', id)
      .single();

    if (error) throw error;
    return json(res, 200, { audit: data });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Failed to fetch audit' });
  }
};
