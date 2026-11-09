const { test } = require('node:test');
const assert = require('node:assert/strict');
const KF = require('../src/lib.ts');

test('server addresses reject credentials, paths and non-http schemes', () => {
  assert.equal(KF.serverURL(' http://192.168.1.240:3210/ '), 'http://192.168.1.240:3210');
  for (const address of ['file:///etc/passwd', 'javascript:alert(1)', 'http://user:password@pi:3210', 'http://pi:3210/keremflix', 'http://pi:3210/?a=b']) assert.throws(() => KF.serverURL(address));
});
test('completed episodes restart; unfinished episodes resume', () => {
  assert.equal(KF.resume({ seconds: 950, duration: 1000 }), 0);
  assert.equal(KF.resume({ seconds: 949, duration: 1000 }), 949);
  assert.equal(KF.resume({ seconds: -5, duration: 1000 }), 0);
  assert.equal(KF.time(3665), '1:01:05');
});
test('external subtitles handle identifiers, settings, SRT and multiline text', () => {
  const cues = KF.parseVTT('WEBVTT\r\n\r\n1\r\n00:00:01.000 --> 00:00:02.500 align:center\r\n<i>Merhaba</i>\r\nDünya &amp; sen\r\n\r\n2\r\n00:00:03,000 --> 00:00:05,000\r\nİkinci satır');
  assert.deepEqual(cues, [{ start: 1, end: 2.5, text: 'Merhaba\nDünya & sen' }, { start: 3, end: 5, text: 'İkinci satır' }]);
  assert.deepEqual(KF.parseVTT('Altyazı yok'), []);
});
test('remote navigation keeps adjacent horizontal and vertical targets', () => {
  const rect = (left, top) => ({ left, top, width: 200, height: 150 });
  const candidates = [{ element: 'right', rect: rect(230, 0) }, { element: 'down', rect: rect(0, 200) }, { element: 'diagonal', rect: rect(230, 200) }];
  assert.equal(KF.neighbor(rect(0, 0), candidates, 'right'), 'right');
  assert.equal(KF.neighbor(rect(0, 0), candidates, 'down'), 'down');
  assert.equal(KF.neighbor(rect(0, 0), candidates, 'left'), null);
});
test('a wide episode row wins over distant centered cards when moving down', () => {
  const season = { left: 80, top: 400, width: 180, height: 60 };
  const candidates = [
    { element: 'episode', rect: { left: 80, top: 490, width: 1650, height: 70 } },
    { element: 'similar', rect: { left: 80, top: 1700, width: 250, height: 200 } }
  ];
  assert.equal(KF.neighbor(season, candidates, 'down'), 'episode');
});
