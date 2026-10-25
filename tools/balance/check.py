"""Balance check: builds the reference characters inside the real game and prints
how far each one gets in the Dungeon and how often it clears each Stage difficulty.

Usage (from the repo root):
  python3 -m http.server 8765 &
  python3 tools/balance/check.py
Requires: pip install playwright  (and a Chromium browser for Playwright)
Edit tools/balance/refchars.js to change the reference characters, and
assets/balance/balance.js to change Dungeon anchors and Stage power.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

REFS = Path(__file__).with_name('refchars.js')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(2500)
    pg.add_script_tag(path=str(REFS))
    print(pg.evaluate("""()=>{const lines=[];
      for(const r of VALOR_REFS){const {power,stats}=valorRefApply(r);let reach=0;
        for(let f=1;f<=100;f++){const e=valorDungeonEnemyStats(f);let w=0;for(let k=0;k<40;k++)if(valorArenaSimulate(stats,state.class,e.stats,e.cls).win)w++;if(w>=20)reach=f;else break}
        const st=stageAreas.map((a,ai)=>VALOR_STAGE_DIFFS.map(d=>{let w=0;for(let k=0;k<100;k++)if(valorStageSimulateRun(ai,d,stats))w++;return w}).join('/')).join(' | ');
        lines.push(r.id+' (gün '+r.day+', Sv'+r.level+') güç '+power+' · zindan katı '+reach+' · sahneler K/Z/Kb % '+st)}
      return lines.join('\\n')}"""))
    b.close()
