import test from 'node:test';
import assert from 'node:assert/strict';
import {localDate,rangeFor,addDays,esc} from '../static/js/ui.js';

test('week begins Monday across year boundary',()=>{
 const {start,end}=rangeFor('2027-01-01','week');
 assert.equal(localDate(start),'2026-12-28');
 assert.equal(localDate(end),'2027-01-04');
});
test('leap month includes February 29',()=>{
 const {start,end}=rangeFor('2028-02-29','month');
 assert.equal(localDate(start),'2028-02-01');
 assert.equal(localDate(addDays(end,-1)),'2028-02-29');
});
test('quarter and year ranges use exclusive end',()=>{
 const q=rangeFor('2026-12-31','quarter');
 assert.equal(localDate(q.start),'2026-10-01');
 assert.equal(localDate(q.end),'2027-01-01');
 const y=rangeFor('2026-09-11','year');
 assert.equal(localDate(y.start),'2026-01-01');
 assert.equal(localDate(y.end),'2027-01-01');
});
test('user text escapes HTML and attribute delimiters',()=>{
 assert.equal(esc('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');
});
