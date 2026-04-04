const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are missing.');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function cleanUrl(input) {
  if (!input) return '';
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

async function fetchWebsiteContext(rawUrl) {
  const url = cleanUrl(rawUrl);
  if (!url) return { url: '', title: '', description: '' };

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'MarketusAuditBot/1.0 (+https://marketus-ai.co.uk)' }
    });
    const html = await response.text();
    const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1] || '';
    const description =
      (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) || [])[1] ||
      '';

    return {
      url,
      title: title.replace(/\s+/g, ' ').trim(),
      description: description.replace(/\s+/g, ' ').trim()
    };
  } catch (error) {
    return { url, title: '', description: '' };
  }
}

function generateSummary(audit, websiteContext) {
  const firstName = audit.first_name || 'Your team';
  const size = audit.agency_size || 'your current size';
  const setup = (audit.ai_setup || 'individual experimentation').toLowerCase();
  const challenge = (audit.challenge || 'a lack of joined-up AI usage').toLowerCase();
  const opportunity = (audit.biggest_opportunity || 'creating more joined-up systems').toLowerCase();
  const tools = audit.tools ? ` You're already using ${audit.tools}, which suggests the issue isn't awareness — it's turning those tools into something shared and repeatable.` : '';
  const websiteLine = websiteContext?.description
    ? ` Your website positioning (${websiteContext.description}) suggests there’s probably value in making AI support both delivery and the way the business presents itself.`
    : websiteContext?.title
      ? ` The website for ${websiteContext.title} gives us enough context to see this as a business-wide opportunity, not just a few isolated workflow tweaks.`
      : '';

  return `${firstName}, it looks like your agency (${size}) is already engaging with AI, but the current setup is best described as ${setup}. The biggest friction point seems to be ${challenge}, while the clearest upside is ${opportunity}. The likely next step is creating a more joined-up operating model so AI becomes shared capability rather than individual habit.${tools}${websiteLine}`;
}

module.exports = {
  getSupabase,
  json,
  cleanUrl,
  fetchWebsiteContext,
  generateSummary
};
