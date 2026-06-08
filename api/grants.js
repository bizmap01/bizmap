export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry, region, goals, employees, years, revenue } = req.query;

  // 지역 → 한글명
  const regionMap = {
    seoul:'서울', gyeonggi:'경기', incheon:'인천',
    busan:'부산', daegu:'대구', gwangju:'광주',
    daejeon:'대전', ulsan:'울산', sejong:'세종',
    gangwon:'강원', gyeongnam:'경남', gyeongbuk:'경북',
    jeonnam:'전남', jeonbuk:'전북', chungnam:'충남',
    chungbuk:'충북', jeju:'제주'
  };
  const regionKr = regionMap[region] || '';

  // 업종 → 분야코드
  const categoryMap = {
    food:'060', retail:'050', service:'070',
    it:'020', manufacturing:'020', other:'060'
  };
  const searchLclasId = categoryMap[industry] || '060';

  // 목표 → 키워드
  const goalKeywords = {
    marketing:['홍보','마케팅','광고','판로','브랜드'],
    rd:['R&D','기술개발','연구','혁신','개발'],
    prototype:['시제품','제품개발','제조','생산'],
    export:['수출','해외','글로벌','무역'],
    hire:['채용','고용','인력','일자리','인건비'],
    digital:['디지털','스마트','AI','온라인','ICT'],
    space:['환경개선','시설','공간','인테리어','설비'],
    cert:['인증','특허','지식재산','ISO'],
    edu:['교육','훈련','역량','연수']
  };

  // 업종별 보완 데이터 (금액/경쟁률/자부담)
  const supplementDB = {
    food:[
      {amount:'최대 2,000만원', comp:'약 1.8:1', self:'20%', prob_boost:5},
      {amount:'최대 1,500만원', comp:'약 1.3:1', self:'10%', prob_boost:3},
      {amount:'1인당 최대 960만원', comp:'약 1.1:1', self:'0%', prob_boost:8},
      {amount:'최대 2,000만원', comp:'약 2.5:1', self:'30%', prob_boost:0},
      {amount:'최대 1,000만원', comp:'약 2:1', self:'20%', prob_boost:2}
    ],
    retail:[
      {amount:'최대 1,000만원', comp:'약 2:1', self:'20%', prob_boost:4},
      {amount:'최대 1,500만원', comp:'약 1.8:1', self:'10%', prob_boost:3},
      {amount:'최대 800만원', comp:'약 1.5:1', self:'20%', prob_boost:5},
      {amount:'최대 1,200만원', comp:'약 2.3:1', self:'30%', prob_boost:0},
      {amount:'1인당 최대 960만원', comp:'약 1.1:1', self:'0%', prob_boost:8}
    ],
    service:[
      {amount:'최대 500만원', comp:'약 1.2:1', self:'0%', prob_boost:8},
      {amount:'최대 1,000만원', comp:'약 1.4:1', self:'10%', prob_boost:5},
      {amount:'1인당 최대 960만원', comp:'약 1.1:1', self:'0%', prob_boost:8},
      {amount:'최대 3,000만원', comp:'약 1.5:1', self:'0%', prob_boost:3},
      {amount:'1인당 최대 1,200만원', comp:'약 1.2:1', self:'0%', prob_boost:6}
    ],
    it:[
      {amount:'최대 1억원', comp:'약 4:1', self:'25%', prob_boost:0},
      {amount:'최대 2,000만원', comp:'약 2.5:1', self:'20%', prob_boost:3},
      {amount:'최대 3,000만원', comp:'약 3:1', self:'30%', prob_boost:1},
      {amount:'최대 2,000만원', comp:'약 2.8:1', self:'20%', prob_boost:2},
      {amount:'최대 1,500만원', comp:'약 2.2:1', self:'20%', prob_boost:4}
    ],
    manufacturing:[
      {amount:'최대 5,000만원', comp:'약 2.5:1', self:'30%', prob_boost:2},
      {amount:'최대 3,000만원', comp:'약 3:1', self:'25%', prob_boost:1},
      {amount:'최대 1억 5,000만원', comp:'약 5:1', self:'25%', prob_boost:0},
      {amount:'최대 2,000만원', comp:'약 2.3:1', self:'20%', prob_boost:3},
      {amount:'최대 1,000만원', comp:'약 1.5:1', self:'10%', prob_boost:5}
    ],
    other:[
      {amount:'최대 2,000만원', comp:'약 2:1', self:'20%', prob_boost:3},
      {amount:'1인당 최대 960만원', comp:'약 1.1:1', self:'0%', prob_boost:8},
      {amount:'최대 1,500만원', comp:'약 1.5:1', self:'10%', prob_boost:5},
      {amount:'최대 5,000만원', comp:'약 1.8:1', self:'0%', prob_boost:2},
      {amount:'최대 1,000만원', comp:'약 2:1', self:'20%', prob_boost:4}
    ]
  };

  // 업력·직원수·매출 기반 보정값
  const yearsBonus  = {under1:-10, '1to3':0, '3to5':5, '5to7':8, over7:10};
  const empBonus    = {'1':-5, '2to4':0, '5to9':5, '10to29':8, over30:10};
  const revBonus    = [0,3,6,9,12,15];
  const regionBonus = {
    seoul:0, gyeonggi:2, incheon:3, busan:5, daegu:5, gwangju:7,
    daejeon:5, ulsan:5, sejong:6, gangwon:8, gyeongnam:6, gyeongbuk:7,
    jeonnam:9, jeonbuk:8, chungnam:7, chungbuk:7, jeju:9
  };

  const baseBonus = (yearsBonus[years]||0) + (empBonus[employees]||0)
                  + (revBonus[parseInt(revenue)||2]||6)
                  + (regionBonus[region]||5);

  const suppList = supplementDB[industry] || supplementDB.other;

  try {
    const encodedKey = encodeURIComponent(API_KEY);
    const url = `https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService?serviceKey=${encodedKey}&numOfRows=50&pageNo=1&dataType=json&searchLclasId=${searchLclasId}`;

    const response = await fetch(url, { headers: {'Accept':'application/json'} });
    const text = await response.text();

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(200).json({success:false, message:'파싱 실패', raw:text.slice(0,200)}); }

    const items = data?.response?.body?.items?.item || data?.body?.items?.item || [];
    let itemList = Array.isArray(items) ? items : (items ? [items] : []);

    if (!itemList || itemList.length === 0) {
      return res.status(200).json({success:false, message:'데이터 없음'});
    }

    // 디버그: 처음 5개 사업명 확인
    const debugNames = itemList.slice(0,5).map(function(i){return i.pblancNm||'';});

    // ── 지역 필터링 ──
    if (regionKr) {
      // 1차: 선택지역 + 전국 사업
      const regionFiltered = itemList.filter(function(item) {
        const txt = (item.pblancNm||'') + (item.jrsdInsttNm||'') + (item.bsnsSumryCn||'');
        const isNational = !txt.match(/\[(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|경남|경북|전남|전북|충남|충북|제주)\]/);
        const isMyRegion = txt.includes(regionKr);
        return isNational || isMyRegion;
      });
      if (regionFiltered.length >= 3) {
        itemList = regionFiltered;
      } else {
        // 2차: 전국 사업만 (지역 태그 없는 것)
        const nationalOnly = itemList.filter(function(item) {
          const txt = (item.pblancNm||'');
          return !txt.match(/^\[(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|경남|경북|전남|전북|충남|충북|제주)\]/);
        });
        if (nationalOnly.length >= 3) itemList = nationalOnly;
        // 3차: 그래도 없으면 전체 사용
      }
    }

    // ── 목표 키워드 점수 정렬 ──
    const goalList = goals ? goals.split(',').filter(Boolean) : [];
    const kwList = [];
    goalList.forEach(function(g){ if(goalKeywords[g]) goalKeywords[g].forEach(function(kw){kwList.push(kw);}); });

    if (kwList.length > 0) {
      itemList = itemList.map(function(item){
        const t = (item.pblancNm||'')+(item.bsnsSumryCn||'')+(item.hashtags||'');
        var sc = 0;
        kwList.forEach(function(kw){ if(t.includes(kw)) sc++; });
        return Object.assign({}, item, {_score:sc});
      }).sort(function(a,b){ return b._score - a._score; });
    }

    const result = itemList.slice(0, 5);

    const grants = result.map(function(item, i) {
      const supp = suppList[i] || suppList[suppList.length-1];

      const name    = (item.pblancNm||'지원사업').replace(/<[^>]*>/g,'').trim();
      const agency  = (item.jrsdInsttNm||item.excInsttNm||'정부기관').replace(/<[^>]*>/g,'').trim();
      const period  = item.reqstBeginEndDe || '';
      const summary = (item.bsnsSumryCn||item.refrncNm||'')
        .replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
      const url2    = item.pblancUrl || item.rceptEngnHmpgUrl || 'https://www.bizinfo.go.kr';

      // 마감일
      let deadline = '상시';
      if (period && period.includes('~')) {
        const ep = period.split('~')[1];
        const dt = String(ep).replace(/-/g,'').trim();
        if (dt.length >= 8) deadline = dt.slice(0,4)+'.'+dt.slice(4,6)+'.'+dt.slice(6,8);
      }

      // 선정가능성 계산
      const probScore = 75 - (i*8) + baseBonus + (supp.prob_boost||0);
      const prob = probScore >= 80 ? '높음' : probScore >= 65 ? '보통' : '낮음';

      // 사업명 정리
      var dispName = name;
      var rTag = '';
      var rm = name.match(/^\[([^\]]+)\]\s*/);
      if (rm) { rTag = '['+rm[1]+'] '; dispName = name.replace(rm[0],''); }
      if (dispName.length > 28) dispName = dispName.slice(0,26)+'...';

      // 설명 자연스럽게 자르기
      var shortDesc = summary;
      if (summary.length > 55) {
        var ci = summary.lastIndexOf(' ', 55);
        shortDesc = ci > 20 ? summary.slice(0,ci)+'...' : summary.slice(0,55)+'...';
      }

      return {
        rank:        i + 1,
        name:        rTag + dispName,
        agency:      agency.slice(0, 20),
        amount:      supp.amount,
        probability: prob,
        deadline:    deadline,
        competition: supp.comp,
        selfFunding: supp.self,
        easyDesc:    shortDesc || name.slice(0,40),
        tags:        [item.pldirSportRealmLclasCodeNm||'', agency.split(' ')[0]].filter(Boolean),
        url:         url2
      };
    });

    res.status(200).json({ success:true, grants, total:grants.length, debug_names:debugNames });

  } catch(err) {
    res.status(200).json({ success:false, error:err.message });
  }
}
