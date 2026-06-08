export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry, region, goals, employees, years, revenue } = req.query;

  const regionMap = {
    seoul:'서울', gyeonggi:'경기', incheon:'인천',
    busan:'부산', daegu:'대구', gwangju:'광주',
    daejeon:'대전', ulsan:'울산', sejong:'세종',
    gangwon:'강원', gyeongnam:'경남', gyeongbuk:'경북',
    jeonnam:'전남', jeonbuk:'전북', chungnam:'충남',
    chungbuk:'충북', jeju:'제주'
  };
  const regionKr = regionMap[region] || '';

  // 업종별 보완 데이터
  const supplementDB = {
    food:[
      {amount:'최대 2,000만원',comp:'약 1.8:1',self:'20%',pb:5},
      {amount:'최대 1,500만원',comp:'약 1.3:1',self:'10%',pb:3},
      {amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8},
      {amount:'최대 2,000만원',comp:'약 2.5:1',self:'30%',pb:0},
      {amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:2}
    ],
    retail:[
      {amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:4},
      {amount:'최대 1,500만원',comp:'약 1.8:1',self:'10%',pb:3},
      {amount:'최대 800만원',comp:'약 1.5:1',self:'20%',pb:5},
      {amount:'최대 1,200만원',comp:'약 2.3:1',self:'30%',pb:0},
      {amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8}
    ],
    service:[
      {amount:'최대 500만원',comp:'약 1.2:1',self:'0%',pb:8},
      {amount:'최대 1,000만원',comp:'약 1.4:1',self:'10%',pb:5},
      {amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8},
      {amount:'최대 3,000만원',comp:'약 1.5:1',self:'0%',pb:3},
      {amount:'1인당 최대 1,200만원',comp:'약 1.2:1',self:'0%',pb:6}
    ],
    it:[
      {amount:'최대 1억원',comp:'약 4:1',self:'25%',pb:0},
      {amount:'최대 2,000만원',comp:'약 2.5:1',self:'20%',pb:3},
      {amount:'최대 3,000만원',comp:'약 3:1',self:'30%',pb:1},
      {amount:'최대 2,000만원',comp:'약 2.8:1',self:'20%',pb:2},
      {amount:'최대 1,500만원',comp:'약 2.2:1',self:'20%',pb:4}
    ],
    manufacturing:[
      {amount:'최대 5,000만원',comp:'약 2.5:1',self:'30%',pb:2},
      {amount:'최대 3,000만원',comp:'약 3:1',self:'25%',pb:1},
      {amount:'최대 1억 5,000만원',comp:'약 5:1',self:'25%',pb:0},
      {amount:'최대 2,000만원',comp:'약 2.3:1',self:'20%',pb:3},
      {amount:'최대 1,000만원',comp:'약 1.5:1',self:'10%',pb:5}
    ],
    other:[
      {amount:'최대 2,000만원',comp:'약 2:1',self:'20%',pb:3},
      {amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8},
      {amount:'최대 1,500만원',comp:'약 1.5:1',self:'10%',pb:5},
      {amount:'최대 5,000만원',comp:'약 1.8:1',self:'0%',pb:2},
      {amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:4}
    ]
  };

  const suppList = supplementDB[industry] || supplementDB.other;

  // 업력·직원수·매출·지역 보정
  const yearsBonus  = {under1:-10,'1to3':0,'3to5':5,'5to7':8,over7:10};
  const empBonus    = {'1':-5,'2to4':0,'5to9':5,'10to29':8,over30:10};
  const revBonus    = [0,3,6,9,12,15];
  const regionBonus = {seoul:0,gyeonggi:2,incheon:3,busan:5,daegu:5,gwangju:7,daejeon:5,ulsan:5,sejong:6,gangwon:8,gyeongnam:6,gyeongbuk:7,jeonnam:9,jeonbuk:8,chungnam:7,chungbuk:7,jeju:9};
  const baseBonus = (yearsBonus[years]||0)+(empBonus[employees]||0)+(revBonus[parseInt(revenue)||2]||6)+(regionBonus[region]||5);

  // 목표 키워드
  const goalKeywords = {
    marketing:['홍보','마케팅','광고','판로','브랜드'],
    rd:['R&D','기술개발','연구','혁신'],
    prototype:['시제품','제품개발','제조'],
    export:['수출','해외','글로벌'],
    hire:['채용','고용','인력','일자리'],
    digital:['디지털','스마트','AI','온라인','ICT'],
    space:['환경개선','시설','공간','설비'],
    cert:['인증','특허','지식재산'],
    edu:['교육','훈련','역량']
  };
  const goalList = goals ? goals.split(',').filter(Boolean) : [];
  const kwList = [];
  goalList.forEach(function(g){ if(goalKeywords[g]) goalKeywords[g].forEach(function(kw){kwList.push(kw);}); });

  try {
    const encodedKey = encodeURIComponent(API_KEY);

    // 여러 페이지 병렬 조회 (더 많은 데이터 확보)
    const pages = [1,2,3];
    const fetches = pages.map(function(p) {
      const url = `https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService?serviceKey=${encodedKey}&numOfRows=30&pageNo=${p}&dataType=json`;
      return fetch(url, {headers:{'Accept':'application/json'}})
        .then(function(r){return r.text();})
        .then(function(t){
          try{
            const d = JSON.parse(t);
            const items = d?.response?.body?.items?.item || d?.body?.items?.item || [];
            return Array.isArray(items) ? items : (items ? [items] : []);
          }catch(e){return [];}
        })
        .catch(function(){return [];});
    });

    const results = await Promise.all(fetches);
    let itemList = [];
    results.forEach(function(r){ itemList = itemList.concat(r); });

    // 중복 제거
    const seen = new Set();
    itemList = itemList.filter(function(item){
      const id = item.pblancId || item.pblancNm;
      if(seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (!itemList || itemList.length === 0) {
      return res.status(200).json({success:false, message:'데이터 없음'});
    }

    // 업종 키워드 점수
    const industryKeywords = {
      food:     ['식품','음식','카페','외식','농식품','소상공인','식당','제과','푸드'],
      retail:   ['유통','판로','온라인쇼핑','소상공인','상권','이커머스','도소매','쇼핑'],
      service:  ['서비스','소상공인','미용','교육','학원','세탁','생활서비스'],
      it:       ['IT','소프트웨어','디지털','AI','스마트','ICT','앱','플랫폼','스타트업','벤처','창업','R&D','기술','혁신','정보통신'],
      manufacturing:['제조','공장','생산','스마트공장','기계','소재','부품','자동화'],
      other:    ['소상공인','중소기업','창업']
    };
    const indKws = industryKeywords[industry] || industryKeywords.other;

    // 점수 계산
    itemList = itemList.map(function(item){
      const t = (item.pblancNm||'')+(item.bsnsSumryCn||'')+(item.pldirSportRealmLclasCodeNm||'')+(item.hashtags||'');
      var indSc = 0;
      indKws.forEach(function(kw){ if(t.includes(kw)) indSc+=2; });
      var goalSc = 0;
      kwList.forEach(function(kw){ if(t.includes(kw)) goalSc++; });
      // 지역 점수
      var regSc = 0;
      var regionTags = ['서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','경남','경북','전남','전북','충남','충북','제주'];
      if(regionKr){
        var nm = item.pblancNm || '';
        var hasRegionTag = false;
        var isMyRegion = false;
        regionTags.forEach(function(r){
          if(nm.includes('['+r+']') || nm.includes('【'+r+'】')) {
            hasRegionTag = true;
            if(r === regionKr) isMyRegion = true;
          }
        });
        if(isMyRegion) regSc = 10;        // 내 지역 사업 강하게 우선
        else if(!hasRegionTag) regSc = 3; // 전국 사업
        else regSc = -20;                 // 다른 지역 사업 강하게 패널티
      }
      return Object.assign({}, item, {_score: indSc + goalSc + regSc});
    }).sort(function(a,b){ return b._score - a._score; });

    const result = itemList.slice(0, 5);

    const grants = result.map(function(item, i){
      const supp = suppList[i] || suppList[suppList.length-1];
      const name    = (item.pblancNm||'지원사업').replace(/<[^>]*>/g,'').trim();
      const agency  = (item.jrsdInsttNm||item.excInsttNm||'정부기관').replace(/<[^>]*>/g,'').trim();
      const period  = item.reqstBeginEndDe || '';
      const summary = (item.bsnsSumryCn||item.refrncNm||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
      const url2    = item.pblancUrl || item.rceptEngnHmpgUrl || 'https://www.bizinfo.go.kr';

      let deadline = '상시';
      if(period && period.includes('~')){
        const ep = period.split('~')[1];
        const dt = String(ep).replace(/-/g,'').trim();
        if(dt.length>=8) deadline=dt.slice(0,4)+'.'+dt.slice(4,6)+'.'+dt.slice(6,8);
      }

      const probScore = 75-(i*8)+baseBonus+(supp.pb||0);
      const prob = probScore>=80?'높음':probScore>=65?'보통':'낮음';

      var dispName=name, rTag='';
      var rm=name.match(/^\[([^\]]+)\]\s*/);
      if(rm){rTag='['+rm[1]+'] ';dispName=name.replace(rm[0],'');}
      if(dispName.length>28) dispName=dispName.slice(0,26)+'...';

      var shortDesc=summary;
      if(summary.length>55){
        var ci=summary.lastIndexOf(' ',55);
        shortDesc=ci>20?summary.slice(0,ci)+'...':summary.slice(0,55)+'...';
      }

      return {
        rank:i+1,
        name:rTag+dispName,
        agency:agency.slice(0,20),
        amount:supp.amount,
        probability:prob,
        deadline:deadline,
        competition:supp.comp,
        selfFunding:supp.self,
        easyDesc:shortDesc||name.slice(0,40),
        tags:[item.pldirSportRealmLclasCodeNm||'',agency.split(' ')[0]].filter(Boolean),
        url:url2
      };
    });

    res.status(200).json({success:true, grants, total:grants.length});

  } catch(err) {
    res.status(200).json({success:false, error:err.message});
  }
}
