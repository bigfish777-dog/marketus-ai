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

function stripHtml(html) {
  return (html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pickVisibleChunks(html) {
  const headings = Array.from((html || '').matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gis))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
    .slice(0, 8);

  const paragraphs = Array.from((html || '').matchAll(/<p[^>]*>(.*?)<\/p>/gis))
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length > 40)
    .slice(0, 10);

  return { headings, paragraphs };
}

function sentenceCase(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function scoreAudit({ websiteContext, audit }) {
  let score = 0;
  const notes = [];
  const title = websiteContext.title || '';
  const description = websiteContext.description || '';
  const headings = websiteContext.headings || [];
  const bodyText = websiteContext.bodyText || '';
  const ctas = websiteContext.ctas || [];
  const hasH1 = !!websiteContext.h1;

  if (title.length >= 20 && title.length <= 65) {
    score += 12;
  } else {
    notes.push('Title tag could be tighter and more deliberate.');
  }

  if (description.length >= 70 && description.length <= 160) {
    score += 12;
  } else {
    notes.push('Meta description is weak or missing.');
  }

  if (hasH1) {
    score += 10;
  } else {
    notes.push('Homepage is missing a clear H1.');
  }

  if (headings.length >= 3) {
    score += 10;
  } else {
    notes.push('Page structure looks thin - not many useful headings to guide the reader.');
  }

  if (ctas.length >= 1) {
    score += 12;
  } else {
    notes.push('No obvious call to action detected.');
  }

  if (ctas.length >= 2) {
    score += 6;
  }

  if (bodyText.length >= 500) {
    score += 10;
  } else {
    notes.push('Homepage copy may be too thin to do much selling or qualification.');
  }

  const challenge = (audit.challenge || '').toLowerCase();
  const opportunity = (audit.biggest_opportunity || '').toLowerCase();
  const setup = (audit.ai_setup || '').toLowerCase();

  if (/ai|automation|growth|agency|marketing|strategy|consult/i.test(`${title} ${description} ${headings.join(' ')}`)) {
    score += 10;
  } else {
    notes.push('The positioning is not obviously clear from the homepage metadata.');
  }

  if (challenge || opportunity || setup) {
    score += 8;
  }

  return {
    score: Math.min(score, 100),
    notes
  };
}

function classifyWebsite(websiteContext) {
  const title = `${websiteContext.title || ''} ${websiteContext.description || ''} ${(websiteContext.headings || []).join(' ')}`.toLowerCase();
  const ctas = (websiteContext.ctas || []).join(' ').toLowerCase();

  const findings = [];
  if (/book|call|demo|get started|contact|audit/.test(ctas)) findings.push('clear-next-step');
  if (/agency|marketing|consult|growth|seo|ppc|brand|creative/.test(title)) findings.push('service-led-positioning');
  if (/ai|automation|system|workflow|assistant/.test(title)) findings.push('ai-angle-visible');
  if (/case stud|result|testimonial|client/.test(title)) findings.push('trust-signals-visible');
  return findings;
}

async function fetchWebsiteContext(rawUrl) {
  const url = cleanUrl(rawUrl);
  if (!url) {
    return {
      url: '',
      title: '',
      description: '',
      h1: '',
      headings: [],
      paragraphs: [],
      ctas: [],
      bodyText: '',
      status: 'missing-url'
    };
  }

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
    const h1 = stripHtml((html.match(/<h1[^>]*>(.*?)<\/h1>/is) || [])[1] || '');
    const { headings, paragraphs } = pickVisibleChunks(html);
    const ctas = Array.from(html.matchAll(/<(a|button)[^>]*>(.*?)<\/(a|button)>/gis))
      .map((match) => stripHtml(match[2]))
      .filter((text) => text && text.length <= 60)
      .filter((text) => /book|call|demo|contact|get started|start|audit|quote|talk|apply|learn more/i.test(text))
      .slice(0, 8);
    const bodyText = stripHtml(html).slice(0, 3000);

    return {
      url,
      title: title.replace(/\s+/g, ' ').trim(),
      description: description.replace(/\s+/g, ' ').trim(),
      h1,
      headings,
      paragraphs,
      ctas,
      bodyText,
      status: response.ok ? 'ok' : `http-${response.status}`
    };
  } catch (error) {
    return {
      url,
      title: '',
      description: '',
      h1: '',
      headings: [],
      paragraphs: [],
      ctas: [],
      bodyText: '',
      status: 'fetch-failed',
      error: error.message || 'Unknown fetch error'
    };
  }
}

function buildWebsiteAudit(audit, websiteContext) {
  const scored = scoreAudit({ websiteContext, audit });
  const findings = classifyWebsite(websiteContext);
  const strengths = [];
  const gaps = [];
  const nextSteps = [];

  if (websiteContext.h1) strengths.push(`The homepage does have a primary headline: "${websiteContext.h1}".`);
  if (websiteContext.description) strengths.push('There is at least some defined search/social description to work from.');
  if ((websiteContext.ctas || []).length) strengths.push(`Clear calls to action were detected (${websiteContext.ctas.slice(0, 3).join(', ')}).`);
  if (findings.includes('service-led-positioning')) strengths.push('The homepage appears to communicate a service-led offer rather than being completely vague.');
  if (findings.includes('ai-angle-visible')) strengths.push('The AI/automation angle is visible on-page rather than hidden in the weeds.');

  if (!websiteContext.description) gaps.push('Meta description is missing or too weak, so the offer may be under-explained in search and previews.');
  if (!websiteContext.h1) gaps.push('No strong H1 was detected, which usually means the homepage message is not landing cleanly.');
  if ((websiteContext.headings || []).length < 3) gaps.push('The page structure looks thin, which often means the value proposition is not being unpacked clearly.');
  if ((websiteContext.ctas || []).length === 0) gaps.push('No clear CTA was detected, so a visitor may not know the next best move.');
  if ((websiteContext.bodyText || '').length < 500) gaps.push('There may not be enough homepage copy to explain the problem, solution, proof and next step.');
  if (!findings.includes('trust-signals-visible')) gaps.push('No obvious trust signals were detected in the homepage text sample.');

  nextSteps.push('Tighten the homepage message so the offer, audience and outcome are obvious within the first screenful.');
  nextSteps.push('Make the primary CTA unmissable and repeated consistently down the page.');
  if (!websiteContext.description) nextSteps.push('Write a proper meta description that clearly states who you help and what outcome you deliver.');
  if (!findings.includes('trust-signals-visible')) nextSteps.push('Add sharper proof: client names, results, examples or short case-study snippets.');
  if ((websiteContext.headings || []).length < 3) nextSteps.push('Break the page into clearer sections so the argument builds instead of feeling like one block of copy.');

  return {
    reviewed: websiteContext.status === 'ok',
    url: websiteContext.url,
    score: scored.score,
    overview: sentenceCase(
      websiteContext.status === 'ok'
        ? `we reviewed the homepage and found a ${scored.score >= 70 ? 'reasonably strong' : scored.score >= 45 ? 'promising but patchy' : 'fairly rough'} foundation. The site gives some signal about the offer, but there is still room to sharpen positioning, proof and conversion.`
        : 'we could not reliably fetch the homepage, so this audit is based mainly on the submitted form context rather than the live site.'
    ),
    snapshot: {
      title: websiteContext.title,
      description: websiteContext.description,
      h1: websiteContext.h1,
      ctas: websiteContext.ctas,
      headings: websiteContext.headings.slice(0, 5)
    },
    strengths: strengths.slice(0, 4),
    gaps: gaps.slice(0, 5),
    nextSteps: nextSteps.slice(0, 4),
    notes: scored.notes,
    status: websiteContext.status
  };
}

function generateSummary(audit, websiteContext, websiteAudit) {
  const firstName = audit.first_name || 'Your team';
  const challenge = (audit.challenge || 'a lack of joined-up AI usage').toLowerCase();
  const opportunity = (audit.biggest_opportunity || 'creating more joined-up systems').toLowerCase();
  const setup = (audit.ai_setup || '').toLowerCase();
  const notes = (audit.context || '').trim();
  const tools = (audit.tools || '').trim();
  const summaryFit = (audit.summary_fit || '').trim();
  const summaryNotes = (audit.summary_notes || '').trim();
  const findings = classifyWebsite(websiteContext);

  const likelyStage = setup
    ? `${setup}, which suggests there is already some appetite and activity around AI inside the agency`
    : 'still somewhere between curiosity and experimentation, rather than working from a joined-up AI operating model';

  const challengeLine = challenge
    ? `The strongest signal is that the pressure point is ${challenge}`
    : 'The strongest signal is that AI usage is happening, but not yet compounding across the business';

  const opportunityLine = opportunity
    ? `while the biggest opportunity probably sits in ${opportunity}.`
    : 'while the biggest opportunity is creating a more joined-up way of working.';

  const toolsLine = tools
    ? `Because you're already using ${tools}, the likely issue is not whether the team believes in AI, but that more tools often create more fragmentation, duplicated effort and cost unless there is a shared system underneath.`
    : '';

  const websiteInferenceLine = websiteAudit?.reviewed && findings.includes('ai-angle-visible')
    ? 'That suggests this is no longer an "if we should use AI" conversation, but a "how do we make it work properly across the agency" one.'
    : websiteAudit?.reviewed
      ? 'That points to a business that probably needs clearer integration and prioritisation more than more experimentation.'
      : '';

  const nuanceLine = notes
    ? `The extra context you shared reinforces that this is partly an operational issue: ${notes}`
    : '';

  const correctionLine = summaryFit === 'Not quite' && summaryNotes
    ? `You also indicated that our first read needed adjusting: ${summaryNotes}`
    : summaryNotes
      ? `Additional nuance: ${summaryNotes}`
      : '';

  return `${firstName}, based on your answers, it looks like the agency is ${likelyStage}. ${challengeLine}, ${opportunityLine} ${toolsLine} ${websiteInferenceLine} ${nuanceLine} ${correctionLine}`
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  getSupabase,
  json,
  cleanUrl,
  fetchWebsiteContext,
  buildWebsiteAudit,
  generateSummary
};
