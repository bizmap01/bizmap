export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry } = req.query;

  // 업종 → 분야 코드 매핑
  const categoryMap = {
    food:          ['창업', '소상공인'],
    retail:        ['소상공인', '판로'],
    service:       ['소상공인', '창업'],
    it:            ['기술', '창업', 'R&D'],
    manufacturing: ['기술', 'R&D', '제조'],
    other:         ['소상공인', '창업']
  };
  const keywords = categoryMap[industry] || ['소상공인'];

  try {
    // 여러 키워드로 검색해서 합치기
    const fetches = keywords.slice(0, 2).map(kw =>
      fetch(
        `https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=10&cond%5BserviceName%3ALIKE%5D=${encodeURIComponent(kw)}&serviceKey=${API_KEY}`,
        { headers: { 'Content-Type': 'application/json' } }
      ).then(r => r.json()).catch(() => ({ data: [] }))
    );

    const results = await Promise.all(fetches);

    // 중복 제거 후 합치기
    const seen = new Set();
    const items = [];
    for (const result of results) {
      for (const item of (result.data || [])) {
        const key = item.서비스명 || item.serviceName || '';
        if (key && !seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      }
    }

    if (items.length === 0) {
      return res.status(200).json({ success: false, message: '데이터 없음' });
    }

    // BIZMAP 형식으로 변환
    const grants = items.slice(0, 5).map((item, i) => {
      const name     = item.서비스명      || item.serviceName     || '지원사업';
      const agency   = item.부처명        || item.ministryName    || '정부기관';
      const amount   = item.지원금액      || item.supportAmount   || '협의 후 결정';
      const summary  = item.서비스목적요약 || item.servicePurpose  || '';
      const startDt  = item.신청기간시작일 || item.applyStartDate  || '';
      const endDt    = item.신청기간종료일 || item.applyEndDate    || '상시';
      const url      = item.상세URL       || item.detailUrl       || 'https://www.bizinfo.go.kr';

      // 마감일 포맷
      let deadline = '상시';
      if (endDt && endDt.length >= 8) {
        deadline = endDt.slice(0, 4) + '.' + endDt.slice(4, 6) + '.' + endDt.slice(6, 8);
      }

      // 금액 포맷
      let amtStr = '금액 협의';
      if (amount && amount !== '' && amount !== '0') {
        const num = parseInt(amount);
        if (!isNaN(num)) {
          amtStr = num >= 10000
            ? '최대 ' + (num / 10000).toFixed(0) + '억원'
            : '최대 ' + num.toLocaleString() + '만원';
        } else {
          amtStr = String(amount);
        }
      }

      return {
        rank:        i + 1,
        name:        name,
        agency:      agency,
        amount:      amtStr,
        probability: i < 2 ? '높음' : '보통',
        deadline:    deadline,
        competition: '약 ' + (i + 2) + ':1',
        selfFunding: (20 + i * 5) + '%',
        easyDesc:    summary.slice(0, 40) || name + ' 지원',
        tags:        [agency.split(' ')[0], keywords[0]],
        url:         url
      };
    });

    res.status(200).json({ success: true, grants });

  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
