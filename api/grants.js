export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const API_KEY = process.env.DATA_GO_KR_API_KEY;
  const { industry, region, goals, employees, years, revenue } = req.query;

  // ── 지역 매핑 ──
  const regionMap = {
    seoul:'서울', gyeonggi:'경기', incheon:'인천',
    busan:'부산', daegu:'대구', gwangju:'광주',
    daejeon:'대전', ulsan:'울산', sejong:'세종',
    gangwon:'강원', gyeongnam:'경남', gyeongbuk:'경북',
    jeonnam:'전남', jeonbuk:'전북', chungnam:'충남',
    chungbuk:'충북', jeju:'제주'
  };
  const regionKr = regionMap[region] || '';
  const allRegions = ['서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','경남','경북','전남','전북','충남','충북','제주'];
  // 지역 약칭 → 전체명 매핑
  const regionFullNames = {
    '경남':'경상남도', '경북':'경상북도', '전남':'전라남도', '전북':'전라북도',
    '충남':'충청남도', '충북':'충청북도', '강원':'강원도', '제주':'제주도',
    '서울':'서울특별시', '경기':'경기도', '인천':'인천광역시',
    '부산':'부산광역시', '대구':'대구광역시', '광주':'광주광역시',
    '대전':'대전광역시', '울산':'울산광역시', '세종':'세종특별자치시'
  };

  // ── fallback DB ──
  const fallbackDB = {
    food:[
      {name:'소상공인 경영환경개선 지원사업',agency:'소상공인시장진흥공단',amount:'최대 2,000만원',comp:'약 1.8:1',self:'20%',pb:5,tags:['소상공인','환경개선'],desc:'인테리어·설비 비용 80% 지원'},
      {name:'지역 소상공인 홍보마케팅 지원',agency:'지방자치단체',amount:'최대 1,500만원',comp:'약 1.3:1',self:'10%',pb:3,tags:['홍보','마케팅'],desc:'SNS·홍보 비용 90% 지원'},
      {name:'고용창출 장려금',agency:'고용노동부',amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8,tags:['채용','고용'],desc:'직원 채용 시 인건비 지원'},
      {name:'식품기업 시제품 제작 지원',agency:'농림축산식품부',amount:'최대 2,000만원',comp:'약 2.5:1',self:'30%',pb:0,tags:['식품','시제품'],desc:'신메뉴·포장 개발비 지원'},
      {name:'소상공인 디지털 전환 바우처',agency:'소상공인진흥공단',amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:2,tags:['디지털','온라인'],desc:'온라인 판매 구축비 지원'}
    ],
    retail:[
      {name:'소상공인 디지털 전환 바우처',agency:'소상공인시장진흥공단',amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:4,tags:['디지털','스마트'],desc:'키오스크·POS 구축비 지원'},
      {name:'온라인 판로 개척 지원',agency:'중소벤처기업부',amount:'최대 1,500만원',comp:'약 1.8:1',self:'10%',pb:3,tags:['이커머스','판로'],desc:'스마트스토어 입점 지원'},
      {name:'스마트상점 기술보급 사업',agency:'중소벤처기업부',amount:'최대 800만원',comp:'약 1.5:1',self:'20%',pb:5,tags:['스마트','AI'],desc:'AI·무인계산대 도입 지원'},
      {name:'수출 바우처 사업',agency:'KOTRA',amount:'최대 1,200만원',comp:'약 2.3:1',self:'30%',pb:0,tags:['수출','해외'],desc:'해외 판로 개척 지원'},
      {name:'고용창출 장려금',agency:'고용노동부',amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8,tags:['채용','고용'],desc:'직원 채용 시 인건비 지원'}
    ],
    service:[
      {name:'소상공인 역량강화 교육 지원',agency:'소상공인시장진흥공단',amount:'최대 500만원',comp:'약 1.2:1',self:'0%',pb:8,tags:['교육','역량'],desc:'경영·마케팅 교육비 100% 지원'},
      {name:'소상공인 홍보물 제작 지원',agency:'지방자치단체',amount:'최대 1,000만원',comp:'약 1.4:1',self:'10%',pb:5,tags:['홍보','마케팅'],desc:'간판·브로셔 제작비 지원'},
      {name:'고용창출 장려금',agency:'고용노동부',amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8,tags:['채용','고용'],desc:'직원 고용 시 인건비 지원'},
      {name:'서비스업 환경개선 자금',agency:'중소벤처기업부',amount:'최대 3,000만원',comp:'약 1.5:1',self:'0%',pb:3,tags:['융자','시설'],desc:'저금리(연 2%) 시설 개선 자금'},
      {name:'청년 일자리 창출 장려금',agency:'고용노동부',amount:'1인당 최대 1,200만원',comp:'약 1.2:1',self:'0%',pb:6,tags:['청년','채용'],desc:'34세 이하 청년 채용 시 추가 지원'}
    ],
    it:[
      {name:'창업성장기술개발사업 (디딤돌)',agency:'중소벤처기업부',amount:'최대 1억원',comp:'약 4:1',self:'25%',pb:0,tags:['R&D','창업'],desc:'IT 제품·서비스 개발비 지원'},
      {name:'비대면 서비스 바우처',agency:'중소벤처기업부',amount:'최대 2,000만원',comp:'약 2.5:1',self:'20%',pb:3,tags:['비대면','클라우드'],desc:'클라우드·보안 솔루션 구축비 지원'},
      {name:'ICT 혁신 바우처',agency:'과학기술정보통신부',amount:'최대 3,000만원',comp:'약 3:1',self:'30%',pb:1,tags:['ICT','AI'],desc:'AI·빅데이터 기술 도입 지원'},
      {name:'스타트업 글로벌 진출 지원',agency:'KOTRA',amount:'최대 2,000만원',comp:'약 2.8:1',self:'20%',pb:2,tags:['글로벌','스타트업'],desc:'해외 전시회·법인설립 비용 지원'},
      {name:'특허 기술사업화 지원',agency:'특허청',amount:'최대 1,500만원',comp:'약 2.2:1',self:'20%',pb:4,tags:['특허','기술사업화'],desc:'특허 기술을 제품화하는 비용 지원'}
    ],
    manufacturing:[
      {name:'스마트공장 구축 지원',agency:'중소벤처기업부',amount:'최대 5,000만원',comp:'약 2.5:1',self:'30%',pb:2,tags:['스마트공장','자동화'],desc:'공장 자동화·IoT 설비 도입 지원'},
      {name:'제조혁신 기반 구축사업',agency:'산업통상자원부',amount:'최대 3,000만원',comp:'약 3:1',self:'25%',pb:1,tags:['제조','혁신'],desc:'생산 공정 효율화 비용 지원'},
      {name:'중소기업 R&D 지원',agency:'중소기업기술정보진흥원',amount:'최대 1억 5,000만원',comp:'약 5:1',self:'25%',pb:0,tags:['R&D','기술'],desc:'신제품 개발·시험인증 비용 지원'},
      {name:'수출 유망 중소기업 육성',agency:'KOTRA',amount:'최대 2,000만원',comp:'약 2.3:1',self:'20%',pb:3,tags:['수출','해외'],desc:'해외 판로 개척 비용 지원'},
      {name:'녹색 기술인증 지원',agency:'환경부',amount:'최대 1,000만원',comp:'약 1.5:1',self:'10%',pb:5,tags:['친환경','인증'],desc:'친환경 제조 공정 전환 비용 지원'}
    ],
    other:[
      {name:'소상공인 지원사업 (일반)',agency:'소상공인시장진흥공단',amount:'최대 2,000만원',comp:'약 2:1',self:'20%',pb:3,tags:['소상공인'],desc:'업종 무관 소상공인 기본 지원'},
      {name:'고용창출 장려금',agency:'고용노동부',amount:'1인당 최대 960만원',comp:'약 1.1:1',self:'0%',pb:8,tags:['채용'],desc:'직원 고용 시 인건비 지원'},
      {name:'지역사랑 소상공인 특별지원',agency:'지방자치단체',amount:'최대 1,500만원',comp:'약 1.5:1',self:'10%',pb:5,tags:['지역'],desc:'지역 소상공인 특별 지원금'},
      {name:'소상공인 경영안정 자금',agency:'중소벤처기업부',amount:'최대 5,000만원',comp:'약 1.8:1',self:'0%',pb:2,tags:['융자','경영'],desc:'저금리 운영 자금 지원'},
      {name:'디지털 전환 바우처',agency:'중소벤처기업부',amount:'최대 1,000만원',comp:'약 2:1',self:'20%',pb:4,tags:['디지털'],desc:'온라인 시스템 구축 지원'}
    ]
  };

  // ── 보정값 ──
  const yearsBonus  = {under1:-10,'1to3':0,'3to5':5,'5to7':8,over7:10};
  const empBonus    = {'1':-5,'2to4':0,'5to9':5,'10to29':8,over30:10};
  const revBonus    = [0,3,6,9,12,15];
  const regionBonus = {seoul:0,gyeonggi:2,incheon:3,busan:5,daegu:5,gwangju:7,daejeon:5,ulsan:5,sejong:6,gangwon:8,gyeongnam:6,gyeongbuk:7,jeonnam:9,jeonbuk:8,chungnam:7,chungbuk:7,jeju:9};
  const baseBonus = (yearsBonus[years]||0)+(empBonus[employees]||0)+(revBonus[parseInt(revenue)||2]||6)+(regionBonus[region]||5);

  // ── 목표 키워드 ──
  const goalKeywords = {
    marketing:['홍보','마케팅','광고','판로'],
    rd:['R&D','기술개발','연구','혁신'],
    prototype:['시제품','제품개발','제조'],
    export:['수출','해외','글로벌'],
    hire:['채용','고용','인력'],
    digital:['디지털','스마트','AI','온라인'],
    space:['환경개선','시설','설비'],
    cert:['인증','특허'],
    edu:['교육','훈련','역량']
  };
  const goalList = goals ? goals.split(',').filter(Boolean) : [];
  const kwList = [];
  goalList.forEach(function(g){ if(goalKeywords[g]) goalKeywords[g].forEach(function(kw){kwList.push(kw);}); });

  try {
    const encodedKey = encodeURIComponent(API_KEY);

    // ── 3페이지 병렬 조회 ──
    const pages = [1,2,3];
    const fetches = pages.map(function(p){
      const url = `https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService?serviceKey=${encodedKey}&numOfRows=30&pageNo=${p}&dataType=json`;
      return fetch(url,{headers:{'Accept':'application/json'}})
        .then(function(r){return r.text();})
        .then(function(t){
          try{
            const d=JSON.parse(t);
            const items=d?.response?.body?.items?.item||d?.body?.items?.item||[];
            return Array.isArray(items)?items:(items?[items]:[]);
          }catch(e){return [];}
        }).catch(function(){return [];});
    });

    const results = await Promise.all(fetches);
    let apiItems = [];
    results.forEach(function(r){apiItems=apiItems.concat(r);});

    // 중복 제거
    const seen = new Set();
    apiItems = apiItems.filter(function(item){
      const id=item.pblancId||item.pblancNm;
      if(seen.has(id))return false;
      seen.add(id);
      return true;
    });

    // ── API 데이터 지역 필터링 (엄격) ──
    let filteredApi = apiItems;
    if(regionKr){
      filteredApi = apiItems.filter(function(item){
        const nm = item.pblancNm || '';
        const agency = item.jrsdInsttNm || '';
        const desc = item.bsnsSumryCn || '';
        const fullText = nm + agency + desc;

        // 1. 다른 지역 태그 패턴 체크
        let hasOtherRegion = false;

        // 사업명에 [지역] 태그가 있는 경우 → 내 지역 태그만 허용
        var tagMatch = nm.match(/^\[([^\]]+)\]/);
        if(tagMatch){
          var tagContent = tagMatch[1]; // 예: "충남", "부산·울산·경남", "인천"
          if(tagContent.includes(regionKr)){
            hasOtherRegion = false; // 내 지역 포함 → 통과
          } else {
            hasOtherRegion = true; // 내 지역 없는 다른 지역 태그 → 제거
          }
        } else {
          // 태그 없는 경우: 주관기관이 다른 지역 기관이면 제거
          allRegions.forEach(function(r){
            if(r === regionKr) return;
            var fullName = regionFullNames[r] || r;
            var myFullName = regionFullNames[regionKr] || regionKr;
            // 주관기관명 체크 (약칭/전체명 모두)
            if(agency.includes(fullName) || agency.includes(r+'광역시') ||
               agency.includes(r+'특별시') || agency.includes(r+'도') ||
               agency.startsWith(r)){
              if(!agency.includes(myFullName) && !agency.includes(regionKr)){
                hasOtherRegion = true;
              }
            }
            // 설명에 특정 지역 소재/지역 기업만인 경우
            if(desc.includes(r+' 소재') || desc.includes(r+'소재') ||
               desc.includes(fullName+' 소재') || nm.includes(r+' 스타트업') ||
               nm.includes(r+' 기업') || nm.startsWith(r+' ') ||
               desc.includes(r+'지역 중소기업') || desc.includes(r+'지역 기업') ||
               desc.includes(r+'지역 소재') || desc.includes(r+' 지역 소재')){
              if(!fullText.includes(regionKr) && !fullText.includes(myFullName)){
                hasOtherRegion = true;
              }
            }
          });
        }

        // 2. 사업명에 특정 지역명이 직접 포함된 경우 (태그 없이)
        if(!hasOtherRegion){
          allRegions.forEach(function(r){
            if(r === regionKr) return;
            if(nm.includes(r+'지역') || nm.includes('·'+r+'·') || nm.includes('·'+r+']')){
              if(!fullText.includes(regionKr)) hasOtherRegion = true;
            }
          });
        }

        // 3. 권역명 필터링 (대경권=대구+경북, 동남권=부산+울산+경남, 충청권=충남+충북 등)
        if(!hasOtherRegion){
          var regionZones = {
            '대경권':['대구','경북'], '동남권':['부산','울산','경남'],
            '충청권':['충남','충북','세종','대전'], '호남권':['전남','전북','광주'],
            '강원권':['강원'], '제주권':['제주']
          };
          Object.keys(regionZones).forEach(function(zone){
            if(!nm.includes(zone)) return;
            var zoneRegions = regionZones[zone];
            var myZone = zoneRegions.indexOf(regionKr) >= 0;
            if(!myZone && !fullText.includes(regionKr)){
              hasOtherRegion = true;
            }
          });
        }

        return !hasOtherRegion;
      });

      // 필터 결과가 너무 적으면 전국 사업(지역 태그 없는 것)만
      if(filteredApi.length < 2){
        filteredApi = apiItems.filter(function(item){
          const nm = item.pblancNm || '';
          return !nm.match(/^\[/); // 지역 태그로 시작하는 것 제외
        });
      }
    }

    // ── 업종 키워드 점수로 API 데이터 정렬 ──
    const industryKeywords = {
      food:    ['식품기업','음식점','카페창업','외식업','농식품','식당운영','푸드테크','식품제조','외식프랜차이즈'],
      retail:  ['소매업','유통기업','온라인쇼핑','전통시장','상점가','이커머스','도소매업','소상공인점포','오프라인매장'],
      service: ['서비스업체','소상공인서비스','미용업','교육서비스','세탁업','생활서비스업','뷰티업종'],
      it:      ['IT기업','소프트웨어','디지털전환','AI서비스','AI기업','ICT','플랫폼기업','IT스타트업','정보통신','SW개발','앱개발','클라우드서비스','데이터분석','데이터플랫폼','사이버보안','핀테크','SaaS','빅데이터','딥러닝','머신러닝'],
      manufacturing:['제조업','제조기업','스마트공장','공장자동화','생산설비','제조혁신','소재부품','부품소재','스마트제조','제조공정','생산라인'],
      other:   ['소상공인지원','중소기업지원','창업기업','예비창업']
    };
    const indKws = industryKeywords[industry]||industryKeywords.other;

    filteredApi = filteredApi.map(function(item){
      const t=(item.pblancNm||'')+(item.bsnsSumryCn||'')+(item.pldirSportRealmLclasCodeNm||'');
      var indSc=0; // 업종 점수 (통과 기준)
      var goalSc=0; // 목표 점수 (정렬용)
      var regionSc=0; // 지역 점수 (정렬용)
      indKws.forEach(function(kw){if(t.includes(kw))indSc+=2;});
      kwList.forEach(function(kw){if(t.includes(kw))goalSc++;});
      if(regionKr && (item.pblancNm||'').includes(regionKr)) regionSc=2;
      return Object.assign({},item,{_score:indSc+goalSc+regionSc, _indSc:indSc});
    }).sort(function(a,b){return b._score-a._score;});

    // ── 상위 API 결과 최대 3개 선택 (업종 점수 2 미만이면 제외) ──
    const topApi = filteredApi.filter(function(item){
      return (item._indSc || 0) >= 2; // 반드시 업종 관련 키워드가 있어야 통과
    }).slice(0,3);

    // ── fallback DB에서 나머지 보완 ──
    const fbList = (fallbackDB[industry]||fallbackDB.other).slice();

    // 목표 키워드로 fallback 정렬
    if(kwList.length>0){
      fbList.sort(function(a,b){
        const at=a.tags.join(' ')+a.desc;
        const bt=b.tags.join(' ')+b.desc;
        var as=0,bs=0;
        kwList.forEach(function(kw){if(at.includes(kw))as++;if(bt.includes(kw))bs++;});
        return bs-as;
      });
    }

    // ── API + fallback 합치기 ──
    // API 결과 먼저, 부족하면 fallback으로 채움
    const needFb = Math.max(0, 5 - topApi.length);
    const fbSlice = fbList.slice(0, needFb);

    // API 결과를 BIZMAP 형식으로 변환
    const suppList = fallbackDB[industry]||fallbackDB.other;

    const apiGrants = topApi.map(function(item,i){
      const supp = suppList[i]||suppList[suppList.length-1];
      const name=(item.pblancNm||'지원사업').replace(/<[^>]*>/g,'').trim();
      const agency=(item.jrsdInsttNm||item.excInsttNm||'정부기관').replace(/<[^>]*>/g,'').trim();
      const period=item.reqstBeginEndDe||'';
      const summary=(item.bsnsSumryCn||item.refrncNm||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
      const url2=item.pblancUrl||item.rceptEngnHmpgUrl||'https://www.bizinfo.go.kr';

      let deadline='상시';
      if(period&&period.includes('~')){
        const ep=period.split('~')[1];
        const dt=String(ep).replace(/-/g,'').trim();
        if(dt.length>=8)deadline=dt.slice(0,4)+'.'+dt.slice(4,6)+'.'+dt.slice(6,8);
      }

      const probScore=75-(i*8)+baseBonus+(supp.pb||0);
      const prob=probScore>=80?'높음':probScore>=65?'보통':'낮음';

      var dispName=name,rTag='';
      var rm=name.match(/^\[([^\]]+)\]\s*/);
      if(rm){rTag='['+rm[1]+'] ';dispName=name.replace(rm[0],'');}
      // 사업명 전체 표시

      var shortDesc=summary; // 전체 설명 표시

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
        url:url2,
        source:'api'
      };
    });

    // fallback 결과 변환
    const fbGrants = fbSlice.map(function(item,i){
      const rank = topApi.length + i + 1;
      const probScore=75-(rank*8)+baseBonus+(item.pb||0);
      const prob=probScore>=80?'높음':probScore>=65?'보통':'낮음';
      return {
        rank:rank,
        name:item.name,
        agency:item.agency,
        amount:item.amount,
        probability:prob,
        deadline:'공고 확인',
        competition:item.comp,
        selfFunding:item.self,
        easyDesc:item.desc,
        tags:item.tags,
        url:'https://www.bizinfo.go.kr',
        source:'db'
      };
    });

    const grants = apiGrants.concat(fbGrants);

    // rank 재정렬
    grants.forEach(function(g,i){g.rank=i+1;});

    res.status(200).json({success:true, grants, total:grants.length, api_count:apiGrants.length, fb_count:fbGrants.length});

  } catch(err) {
    // API 완전 실패 시 fallback만 사용
    const fbList = (fallbackDB[industry]||fallbackDB.other).slice();
    if(kwList && kwList.length>0){
      fbList.sort(function(a,b){
        const at=a.tags.join(' ')+a.desc;
        const bt=b.tags.join(' ')+b.desc;
        var as=0,bs=0;
        kwList.forEach(function(kw){if(at.includes(kw))as++;if(bt.includes(kw))bs++;});
        return bs-as;
      });
    }
    const grants = fbList.slice(0,5).map(function(item,i){
      const probScore=75-(i*8)+baseBonus+(item.pb||0);
      const prob=probScore>=80?'높음':probScore>=65?'보통':'낮음';
      return {rank:i+1,name:item.name,agency:item.agency,amount:item.amount,probability:prob,deadline:'공고 확인',competition:item.comp,selfFunding:item.self,easyDesc:item.desc,tags:item.tags,url:'https://www.bizinfo.go.kr',source:'db'};
    });
    res.status(200).json({success:true, grants, total:grants.length, fallback:true});
  }
}
