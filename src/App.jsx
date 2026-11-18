import { useEffect, useRef, useState } from 'react';
import { VIDEOS, EVENT_TITLE, IDLE_SECONDS } from './data.js';
import logo from './assets/logo.png';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* קו סיסמוגרף מתגלגל – חוזר על עצמו בצורה חלקה */
function Seismo() {
  const d = (() => {
    let s = 7, pts = [];
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const env = Math.pow(Math.sin((i / N) * Math.PI), 2) * (0.25 + 0.75 * Math.pow(Math.sin((i / N) * Math.PI * 3.1), 2));
      pts.push(`${i * 10},${60 + rnd() * 110 * env + Math.sin(i * 0.9) * 22 * env}`);
    }
    return 'M' + pts.join(' L');
  })();
  return (
    <div className="seismo" aria-hidden="true">
      <svg viewBox="0 0 4400 120" preserveAspectRatio="none">
        <path d={d} />
        <path d={d} transform="translate(2200 0)" />
      </svg>
    </div>
  );
}

/* סדק שנפתח לאורך מסך הבית */
const Crack = () => (
  <svg className="crack" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="62,0 58,14 66,26 55,44 63,58 50,80 58,96 46,120 54,138 42,160 48,178 40,200" />
    <polyline points="50,80 36,88 30,104" />
    <polyline points="54,138 70,146 76,162" />
  </svg>
);

function Player({ v, onEnd, onSkip, playingRef }) {
  const ref = useRef(null);
  const [p, setP] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  useEffect(() => {
    ref.current?.play().catch(() => {});
    // הלחיצה על כרטיס הסרטון מאשרת מעבר ישיר למסך מלא (נשאר במסך מלא גם אחרי הסרטון)
    if (window.self === window.top && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    return () => { playingRef.current = false; };
  }, []);
  const toggle = () => (ref.current.paused ? ref.current.play() : ref.current.pause());
  return (
    <div className="player">
      <h2><span className="vlabel">סרטון:</span> {v.title}</h2>
      <div className="frame">
        <video
          ref={ref} src={v.src} playsInline preload="auto" onClick={toggle}
          onPlay={() => { setP(true); playingRef.current = true; }}
          onPause={() => { setP(false); playingRef.current = false; }}
          onTimeUpdate={(e) => setT(e.target.currentTime)}
          onLoadedMetadata={(e) => setD(e.target.duration)}
          onEnded={onEnd}
        />
        {!p && (
          <button className="bigplay" onClick={toggle} aria-label="המשך צפייה">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
      </div>
      <div className="bar"><i style={{ width: d ? `${(t / d) * 100}%` : 0 }} /></div>
      <div className="row">
        <button className="btn ghost" onClick={toggle}>{p ? 'השהיה' : 'המשך צפייה'}</button>
        <button className="btn" onClick={onSkip}>לשאלות</button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home'); // home | video | quiz | result
  const [vi, setVi] = useState(0);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState({});
  const [shake, setShake] = useState(false);
  const [full, setFull] = useState(false);
  const canFull = typeof document !== 'undefined' && document.fullscreenEnabled && window.self === window.top; // לא בתוך עמוד הבית (iframe)
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  const last = useRef(Date.now());
  const playing = useRef(false);

  const reset = () => {
    setScreen('home'); setDone({}); setPicked(null); setQi(0); setScore(0);
  };

  /* חזרה אוטומטית למסך הבית אחרי חוסר פעילות (לא בזמן צפייה) */
  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, bump));
    const id = setInterval(() => {
      if (Date.now() - last.current > IDLE_SECONDS * 1000 && !playing.current) {
        last.current = Date.now();
        reset();
      }
    }, 1000);
    return () => {
      clearInterval(id);
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, bump));
    };
  }, []);

  const v = VIDEOS[vi];
  const q = v.questions[qi];
  const total = Object.values(done).reduce((a, b) => a + b, 0);
  const allDone = VIDEOS.every((x) => x.id in done);

  const open = (i) => { setVi(i); setQi(0); setScore(0); setPicked(null); setScreen('video'); };
  const answer = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
    else { setShake(true); setTimeout(() => setShake(false), 700); }
  };
  const next = () => {
    if (qi + 1 < v.questions.length) { setQi(qi + 1); setPicked(null); }
    else { setDone((d) => ({ ...d, [v.id]: score })); setScreen('result'); }
  };
  const msg = score === 3 ? 'מוכנים לרעידה!' : score === 2 ? 'כמעט שם' : 'כדאי לצפות שוב';

  return (
    <div className={`stage ${shake ? 'quake' : ''}`}>
      <div className="tape" aria-hidden="true" />
      <header className="topbar">
        <div className="logo"><img src={logo} alt="המכללה הלאומית לאיתנות ישראלית" /></div>
        {canFull && (
          <button className="fsbtn" onClick={toggleFull}>{full ? 'יציאה ממסך מלא' : 'מסך מלא'}</button>
        )}
      </header>
      <Seismo />

      {screen === 'home' && (
        <main className="screen home" key="home">
          <Crack />
          <h1 className="tremor">{EVENT_TITLE}</h1>
          <p className="lead">צפו בשלושה סרטונים קצרים וענו על שלוש שאלות אחרי כל אחד.</p>
          <div className="cards">
            {VIDEOS.map((x, i) => (
              <button key={x.id} className={`card ${x.id in done ? 'is-done' : ''}`} onClick={() => open(i)}>
                <span className="card-text">
                  <b>{x.title}</b>
                  <small>{x.sub}</small>
                </span>
                <span className="badge">{x.id in done ? `הושלם · ${done[x.id]} מתוך 3` : 'לצפייה'}</span>
              </button>
            ))}
          </div>
          {allDone && (
            <p className="final">סיימתם את כל הסרטונים! ציון כולל: {total} מתוך {VIDEOS.length * 3}</p>
          )}
        </main>
      )}

      {screen === 'video' && (
        <Player key={v.id} v={v} playingRef={playing} onSkip={() => setScreen('quiz')} onEnd={() => setTimeout(() => setScreen('quiz'), 1200)} />
      )}

      {screen === 'quiz' && (
        <main className="screen" key={`quiz${qi}`}>
          <h2>{v.title}</h2>
          <div className="steps" aria-label={`שאלה ${qi + 1} מתוך 3`}>
            {v.questions.map((_, i) => <i key={i} className={i < qi ? 'ok' : i === qi ? 'now' : ''} />)}
          </div>
          <p className="q">{q.q}</p>
          <div className="opts">
            {q.options.map((o, i) => {
              const state = picked === null ? '' : i === q.answer ? 'right' : i === picked ? 'wrong' : 'dim';
              return (
                <button key={i} className={`opt ${state}`} onClick={() => answer(i)} disabled={picked !== null && state === 'dim'}>
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={`fb ${picked === q.answer ? 'good' : 'bad'}`}>
              <strong>{picked === q.answer ? 'נכון!' : 'לא בדיוק'}</strong>
              <span>{q.why}</span>
              <button className="btn" onClick={next}>{qi + 1 < v.questions.length ? 'לשאלה הבאה' : 'לסיכום'}</button>
            </div>
          )}
        </main>
      )}

      {screen === 'result' && (
        <main className="screen result" key="result">
          <h2>{v.title}</h2>
          <div className="score tremor">{score}<span>/3</span></div>
          <p className="verdict">{msg}</p>
          <div className="row">
            <button className="btn ghost" onClick={() => open(vi)}>צפו שוב בסרטון</button>
            <button className="btn" onClick={() => setScreen('home')}>חזרה לתפריט</button>
          </div>
        </main>
      )}
    </div>
  );
}