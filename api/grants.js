export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
 
  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry } = req.query;
 
  // 업종 → 분야코드(searchLclasId) 매핑
  // 금융=010, 기술=020, 인력=030, 수출=040, 내수=050, 창업=060, 경영=070, 기타=080
  const categoryMap = {
    food:          '060', // 창업
    retail:        '050', // 내수
    service:       '070', // 경영
    it:            '020', // 기술
    manufacturing: '020', // 기술
    other:         '060'  // 창업
  };
  const searchLclasId = categoryMap[industry] || '060';
 
  try {
    const encodedKey = encodeURIComponent(API_KEY);
    const url = `https://apis.data.go.kr/1421000/bizinfo/getPublicInfoList?serviceKey=${encodedKey}&numOfRows=10&pageNo=1&dataType=json&searchLclasId=${searchLclasId}`;
 
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
 
    // 응답 구조 파싱
    const items =
      data?.response?.body?.items?.item ||
      data?.body?.items?.item ||
      data?.items?.item ||
      data?.item ||
      [];
 
    const itemList = Array.isArray(items) ? items : (items ? [items] : []);
 
    if (!itemList || itemList.length === 0) {
      return res.status(200).json({ success: false, message: '데이터 없음', debug: JSON.stringify(data).slice(0, 500) });
    }
 
    const grants = itemList.slice(0, 5).map((item, i) => {
      const name    = item.pbanc_nm    || item.pbancNm    || item.사업명    || '지원사업';
      const agency  = item.inst_nm     || item.instNm     || item.소관기관명 || '정부기관';
      const endDt   = item.rcept_end_dt || item.rceptEndDt || item.신청종료일 || '';
      const summary = item.pbanc_ctnt  || item.pbancCtnt  || item.사업내용  || '';
      const amt     = item.sprt_amt    || item.sprtAmt    || item.지원금액  || '';
 
      let deadline = '상시';
      const dt = String(endDt).replace(/-/g, '');
      if (dt && dt.length >= 8) {
        deadline = dt.slice(0,4) + '.' + dt.slice(4,6) + '.' + dt.slice(6,8);
      }
 
      let amtStr = '금액 협의';
      if (amt && amt !== '0' && amt !== '') {
        const num = parseInt(String(amt).replace(/[^0-9]/g, ''));
        if (!isNaN(num) && num > 0) {
          amtStr = num >= 10000 ? '최대 ' + (num/10000).toFixed(0) + '억원' : '최대 ' + num.toLocaleString() + '만원';
        } else {
          amtStr = String(amt).slice(0, 20);
        }
      }
 
      return {
        rank:        i + 1,
        name:        name.slice(0, 30),
        agency:      agency.slice(0, 20),
        amount:      amtStr,
        probability: i < 2 ? '높음' : '보통',
        deadline:    deadline,
        competition: '약 ' + (i + 2) + ':1',
        selfFunding: (20 + i * 5) + '%',
        easyDesc:    (summary || name).slice(0, 40),
        tags:        [searchLclasId, agency.split(' ')[0]],
      };
    });
 
    res.status(200).json({ success: true, grants, total: itemList.length });
 
  } catch (err) {
    res.status(200).json({ success: false, error: err.message });
  }
}
