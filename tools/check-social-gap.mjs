#!/usr/bin/env node
/**
 * 社保断档测算 · 机械核对（配套 docs/social-gap-check.md §6）
 *
 * 用法：node tools/check-social-gap.mjs
 * 只做三件事，不重新实现业务逻辑：
 *   1) 断言 docs/social-gap-check.md §1 记录的口径锚点仍逐字存在于 index.html；
 *   2) 断言演示直达 runDemoSocial 的固定入参未被改动；
 *   3) 校验核对文档与 README 的引用关系、用例表结构完整性。
 * 任一失败即 exit 1，并指名是哪一条口径/引用被改坏。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const docPath = join(root, 'docs', 'social-gap-check.md');
const doc = readFileSync(docPath, 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

const pass = [];
const fails = [];
const ok = (cond, name) => (cond ? pass : fails).push(name);
const has = (s) => html.includes(s);

/* ---- 1) §1 口径不变式锚点（与 docs/social-gap-check.md §1 一一对应） ---- */
const ANCHORS = [
  ['I1 月序号折算', 'function monthIdx(y, m){ return y*12 + m; }'],
  ['I1 自然日仅作参考', 'var days = Math.round((d2-d1)/86400000);'],
  ['I2 离职边界月偏移', 'var leavePay = monthIdx(d1.getFullYear(), d1.getMonth()) + (leaveSame ? 0 : 1);'],
  ['I2 入职边界月偏移', 'var joinPay  = monthIdx(d2.getFullYear(), d2.getMonth()) + (joinSame ? 0 : 1);'],
  ['I3 断档月数公式', 'var gap = joinPay - leavePay - 1; if(gap < 0) gap = 0;'],
  ['I4 补缴估算公式', 'var cost = gap * base * rate;'],
  ['I4 费率小数自动归一', 'if(rv < 1) rv = rv*100;'],
  ['I5 补缴不计入连续年限文案', '多数城市规定补缴不计入连续年限'],
  ['I6 风险档一：无断档', "if(gap === 0){"],
  ['I6 风险档二：未达门槛即断缴', 'else if(gap < threshold){'],
  ['I7 入职早于离职异常分支', 'if(d2 < d1){'],
  ['I7 异常置空 last_risk', "LS.set('last_risk', null); updateStatusbar();"],
  ['I8 缺输入分支', "if(!leave || !join){ reset('请填写离职日与入职日。', 'ok'); return; }"],
  ['I9 断档结果供全局状态条复用', "LS.set('last_risk', gap); updateStatusbar();"],
  ['I10 月历 14 个月折叠阈值', 'var show = total <= 14;'],
];
for (const [name, s] of ANCHORS) ok(has(s), `锚点 ${name}`);

/* ---- 2) 演示直达固定入参（README 声明「北京，断档 2 个整月」的前提） ---- */
const demo = html.slice(html.indexOf('function runDemoSocial'));
ok(/sCity\.value = '北京'/.test(demo), '演示 城市=北京');
ok(/s-threshold'\)\.value = 60/.test(demo), '演示 门槛=60');
ok(/s-base'\)\.value = 18000/.test(demo), '演示 基数=18000');
ok(/s-rate'\)\.value = 38\.5/.test(demo), '演示 费率=38.5');
ok(/setMonth\(t\.getMonth\(\)\+1\); leave\.setDate\(8\)/.test(demo), '演示 离职日=下月8号');
ok(/setMonth\(leave\.getMonth\(\)\+3\); join\.setDate\(8\)/.test(demo), '演示 入职日=离职+3个月的8号');

/* ---- 3) 文档结构与引用完整性 ---- */
const caseRows = doc.split('\n').filter((l) => /^\| C\d+ \|/.test(l));
ok(caseRows.length >= 9, `用例表行数 ≥ 9（实际 ${caseRows.length}）`);
ok(caseRows.every((l) => (l.match(/\|/g) || []).length === 8), '用例表每行保持 7 列结构');
ok(caseRows.some((l) => /^\| C1 \|/.test(l) && l.includes(' 2 ') && l.includes('92') && l.includes('13,860')), 'C1 期望值（断档 2 / 自然日 92 / 补缴 ￥13,860）仍在表中');
ok(caseRows.some((l) => /^\| C2 \|/.test(l) && l.includes('20,790')), 'C2 期望值（断档 3 → 补缴 ￥20,790）仍在表中');
ok(caseRows.some((l) => /^\| C3 \|/.test(l) && l.includes(' 1 ') && l.includes('6,930')), 'C3 期望值（仅取消离职边界月 → 断档 1 / ￥6,930）仍在表中');
ok(doc.includes('?tab=social&demo=1'), '文档含演示直达走查（§4）');
ok(doc.includes('node tools/check-social-gap.mjs'), '文档 §6 指向本脚本');
ok(readme.includes('docs/social-gap-check.md'), 'README 引用核对文档');
ok(readme.includes('?tab=social&demo=1'), 'README 声明演示直达链接');

/* ---- 输出 ---- */
console.log(`社保断档测算核对：通过 ${pass.length} 项，失败 ${fails.length} 项`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) {
  console.log('\n失败含义：index.html 的断档口径/演示入参已改动，或核对文档/README 引用失配。');
  console.log('处置：按最新口径回改 docs/social-gap-check.md 的 §1 锚点与 §3 期望值，再按文档走查浏览器用例；不要删除断言。');
  process.exit(1);
}
console.log('全部通过。浏览器侧用例（§3 表格 + §4 演示直达）仍须按 docs/social-gap-check.md 人工走查。');
