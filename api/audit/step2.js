const { getSupabase, fetchWebsiteContext, generateSummary, json } = require('./_lib/shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const supabase = getSupabase();
    if (!body.id) return json(res, 400, { error: 'Missing audit id' });

    const updates = {
      ai_setup: body.ai_setup || null,
      biggest_opportunity: body.biggest_opportunity || null,
      tools: body.tools || null,
      context: body.context || null,
      status: 'step_2_complete'
    };

    const { data: audit, error: updateError } = await supabase
      .from('marketus_audits')
      .update(updates)
      .eq('id', body.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const websiteContext = await fetchWebsiteContext(audit.website);
    const generatedSummary = generateSummary(audit, websiteContext);

    const { error: summaryError } = await supabase
      .from('marketus_audits')
      .update({
        generated_summary: generatedSummary,
        meta: { websiteContext },
        status: 'summary_ready'
      })
      .eq('id', body.id);

    if (summaryError) throw summaryError;

    return json(res, 200, { id: body.id, generatedSummary });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Failed to process step 2' });
  }
};
