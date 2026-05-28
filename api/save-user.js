export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SHEET_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!SHEET_URL) {
    return res.status(200).json({ success: false, error: 'SHEET_URL 미설정' });
  }

  try {
    const body = req.body;

    // 구글 앱스 스크립트 웹훅으로 전송
    const response = await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp:   body.timestamp   || new Date().toLocaleString('ko-KR'),
        company:     body.company     || '',
        owner:       body.owner       || '',
        phone:       body.phone       || '',
        email:       body.email       || '',
        industry:    body.industry    || '',
        region:      body.region      || '',
        revenue:     body.revenue     || '',
        years:       body.years       || '',
        employees:   body.employees   || '',
        goals:       body.goals       || '',
        passRate:    body.passRate    || '',
        maxAmount:   body.maxAmount   || '',
        totalGrants: body.totalGrants || '',
        marketing:   body.marketing   || ''
      })
    });

    const result = await response.text();
    res.status(200).json({ success: true, result });

  } catch (err) {
    // 저장 실패해도 사용자 경험에는 영향 없게 200 반환
    res.status(200).json({ success: false, error: err.message });
  }
}
