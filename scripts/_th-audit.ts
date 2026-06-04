import { chromium } from "playwright";
const BASE = "http://localhost:3010";
const PAGES: [string,string][] = [
  ["authority-requests (REF)", "/authority-requests"],
  ["audit", "/audit"],
  ["compliance-monitoring", "/compliance-monitoring"],
  ["accuracy", "/accuracy"],
  ["fleet-onboarding", "/fleet-onboarding"],
  ["partner-detail(vehicle)", "/compliance-monitoring/partners/00cf2d10-0491-4adf-bedd-bc87fd05aa32"],
];
(async()=>{
  const b=await chromium.launch();
  const page=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
  await page.goto(`${BASE}/login`,{waitUntil:"domcontentloaded"});
  await page.fill("#email","reviewer@bolt.eu"); await page.fill("#password","sentinel");
  await Promise.all([page.waitForURL("**/home",{timeout:20000}).catch(()=>{}),page.click('button[type=submit]')]);
  await page.waitForTimeout(800);
  for(const [name,path] of PAGES){
    await page.goto(`${BASE}${path}`,{waitUntil:"networkidle"}).catch(()=>{});
    await page.waitForTimeout(500);
    const ths = await page.$$eval("th",els=>els.map(e=>{const s=getComputedStyle(e);return s.fontSize+"|"+s.textTransform+"|"+s.fontWeight;}));
    const tally:Record<string,number>={}; ths.forEach(v=>tally[v]=(tally[v]||0)+1);
    console.log(`\n[${name}] th count=${ths.length}`); Object.entries(tally).forEach(([k,c])=>console.log(`   ${c}×  ${k}  (size|transform|weight)`));
    // text-2xs sample
    const t2 = await page.$$eval("[class*='text-2xs']",els=>els.slice(0,40).map(e=>getComputedStyle(e).fontSize));
    if(t2.length){const tt:Record<string,number>={};t2.forEach(v=>tt[v]=(tt[v]||0)+1);console.log("   text-2xs sizes:",JSON.stringify(tt));}
  }
  await b.close();
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
