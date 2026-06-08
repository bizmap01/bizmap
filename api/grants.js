export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry } = req.query;

  // 업종 → 분야코드 매핑 (코드 없이 전체 조회 후 필터링)
  const categoryMap = {
    food:          '창업',
    retail:        '내수',
    service:       '경영',
    it:            '기술',
    manufacturing: '기술',
    other:         '창업'
  };
  const categoryName = categoryMap[industry] || '창업';

  try {
    const encodedKey = encodeURIComponent(API_KEY);
    // searchLclasId 없이 전체 조회
    const url = `https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService?serviceKey=${encodedKey}&numOfRows=20&pageNo=1&dataType=json`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(200).json({ success: false, message: '파싱 실패', raw: text.slice(0, 300) });
    }

    const items =
      data?.response?.body?.items?.item ||
      data?.body?.items?.item ||
      data?.items?.item ||
      [];

    const itemList = Array.isArray(items) ? items : (items ? [items] : []);

    if (!itemList || itemList.length === 0) {
      return res.status(200).json({ success: false, message: '데이터 없음', debug: JSON.stringify(data).slice(0, 500) });
    }

    // 분야명으로 필터링
    const filtered = itemList.filter(function(item) {
      const realm = (item.pldirSportRealmLclasCodeNm || '').toLowerCase();
      return realm.includes(categoryName) || realm.includes('소상공인') || realm.includes('중소기업');
    });

    const result = (filtered.length > 0 ? filtered : itemList).slice(0, 5);

    const grants = result.map(function(item, i) {
      const name    = item.pblancNm    || '지원사업';
      const agency  = item.jrsdInsttNm || item.excInsttNm || '정부기관';
      const period  = item.reqstBeginEndDe || '';
      const summary = item.bsnsSumryCn || item.refrncNm   || '';
      const url2    = item.pblancUrl   || item.rceptEngnHmpgUrl || 'https://www.bizinfo.go.kr';

      let deadline = '상시';
      if (period && period.includes('~')) {
        const endPart = period.split('~')[1];
        const dt = String(endPart).replace(/-/g, '').trim();
        if (dt.length >= 8) {
          deadline = dt.slice(0,4) + '.' + dt.slice(4,6) + '.' + dt.slice(6,8);
        }
      }

      return {
        rank:        i + 1,
        name:        name.slice(0, 30),
        agency:      agency.slice(0, 20),
        amount:      '금액 협의',
        probability: i < 2 ? '높음' : '보통',
        deadline:    deadline,
        competition: '약 ' + (i + 2) + ':1',
        selfFunding: (20 + i * 5) + '%',
        easyDesc:    (summary || name).slice(0, 40),
        tags:        [item.pldirSportRealmLclasCodeNm || categoryName, agency.split(' ')[0]],
        url:         url2
      };
    });

    res.status(200).json({ success: true, grants, total: grants.length });

  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
