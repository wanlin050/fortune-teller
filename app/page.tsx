"use client";

import { useState, useMemo, useEffect } from "react";
import DrawButton from "./draw-button";
import { Lunar, Solar } from "lunar-javascript";

type Mode = "fortune" | "bazi";
type CalendarType = "solar" | "lunar";

const TAG_SEPARATOR = "|||TAGS|||";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SIXTY_JIAZI = Array.from({ length: 60 }).map((_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

const HOURS = [
  { value: "0", label: "子时 (23-1点)", branch: "子" },
  { value: "1", label: "丑时 (1-3点)", branch: "丑" },
  { value: "2", label: "寅时 (3-5点)", branch: "寅" },
  { value: "3", label: "卯时 (5-7点)", branch: "卯" },
  { value: "4", label: "辰时 (7-9点)", branch: "辰" },
  { value: "5", label: "巳时 (9-11点)", branch: "巳" },
  { value: "6", label: "午时 (11-13点)", branch: "午" },
  { value: "7", label: "未时 (13-15点)", branch: "未" },
  { value: "8", label: "申时 (15-17点)", branch: "申" },
  { value: "9", label: "酉时 (17-19点)", branch: "酉" },
  { value: "10", label: "戌时 (19-21点)", branch: "戌" },
  { value: "11", label: "亥时 (21-23点)", branch: "亥" },
];

function getHourStem(dayStem: string, hourBranch: string) {
  const dayStemIndex = STEMS.indexOf(dayStem);
  const hourBranchIndex = BRANCHES.indexOf(hourBranch);
  const ziStemIndex = (dayStemIndex % 5) * 2; 
  const hourStemIndex = (ziStemIndex + hourBranchIndex) % 10;
  return STEMS[hourStemIndex];
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("fortune");
  const [calendar, setCalendar] = useState<CalendarType>("solar");
  
  // 日期输入状态
  const [year, setYear] = useState("2008");
  const [month, setMonth] = useState("2");
  const [day, setDay] = useState("8");
  const [hour, setHour] = useState("9"); // 默认酉时

  const [isReverse, setIsReverse] = useState(false);

  // 四柱状态
  const [baziYear, setBaziYear] = useState("戊子");
  const [baziMonth, setBaziMonth] = useState("甲寅");
  const [baziDay, setBaziDay] = useState("戊寅");
  const [baziHourBranch, setBaziHourBranch] = useState("酉");

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tagModal, setTagModal] = useState<{ title: string; desc: string; loading: boolean } | null>(null);

  // 动态计算时柱天干
  const currentHourStem = useMemo(() => {
    if (!baziDay || !baziHourBranch) return "";
    return getHourStem(baziDay[0], baziHourBranch);
  }, [baziDay, baziHourBranch]);

  const currentBaziStr = `${baziYear}年 ${baziMonth}月 ${baziDay}日 ${currentHourStem}${baziHourBranch}时`;

  // 联动：如果不是反推模式，年月日时改变时，自动更新四柱下拉框
  useEffect(() => {
    if (isReverse) return;
    try {
      const y = parseInt(year), m = parseInt(month), d = parseInt(day);
      const hBranch = HOURS.find(x => x.value === hour)?.branch || "子";
      
      let lunar;
      if (calendar === "lunar") {
        lunar = Lunar.fromYmd(y, m, d);
      } else {
        lunar = Solar.fromYmd(y, m, d).getLunar();
      }
      
      const ec = lunar.getEightChar();
      ec.setSect(2); // 晚子时算当天
      
      setBaziYear(ec.getYear());
      setBaziMonth(ec.getMonth());
      setBaziDay(ec.getDay());
      setBaziHourBranch(hBranch);
    } catch (e) {}
  }, [calendar, year, month, day, hour, isReverse]);

  // 反推算法：从当前时间倒退找第一个匹配的日期
  function findRecentDate(targetBazi: { y: string; m: string; d: string; hBranch: string }) {
    const currentYear = new Date().getFullYear();
    const targetHourStem = getHourStem(targetBazi.d[0], targetBazi.hBranch);
    const targetFullHour = targetHourStem + targetBazi.hBranch;
    
    // 从今年开始往前倒推（不设下限，直到找到为止，实际上最多跑几百年）
    for (let y = currentYear; y >= 1800; y--) {
      for (let m = 12; m >= 1; m--) {
        for (let d = 31; d >= 1; d--) {
          try {
            const solar = Solar.fromYmd(y, m, d);
            const lunar = solar.getLunar();
            const ec = lunar.getEightChar();
            ec.setSect(2);
            
            if (ec.getYear() === targetBazi.y && ec.getMonth() === targetBazi.m && ec.getDay() === targetBazi.d) {
              // 日柱匹配，直接推算这一天的具体时间
              const branchIndex = BRANCHES.indexOf(targetBazi.hBranch);
              const realHour = (branchIndex * 2 + 23) % 24; // 还原为具体的整点
              
              return { year: y, month: m, day: d, realHour };
            }
          } catch {}
        }
      }
    }
    return null;
  }

  async function handleBazi() {
    setError("");
    setResult("");
    setLoading(true);

    if (isReverse) {
      const found = findRecentDate({ y: baziYear, m: baziMonth, d: baziDay, hBranch: baziHourBranch });
      if (!found) {
        setError("历法库中未找到符合该四柱的日期（范围回溯至1800年）。");
        setLoading(false);
        return;
      }
      // 反推成功：把找到的日期写回上方的输入框，供用户确认
      setCalendar("solar");
      setYear(found.year.toString());
      setMonth(found.month.toString());
      setDay(found.day.toString());
      // 找到对应的小时并在下拉框选中
      const matchedHour = HOURS.find(x => x.branch === baziHourBranch)?.value || "0";
      setHour(matchedHour);
      
      setIsReverse(false); // 退出反推模式
      setError("已为您匹配最近的合法时间，请再次点击推算。");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bazi", baziStr: currentBaziStr }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text() || "推算失败");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
    } catch (e: any) {
      setError(e.message || "推算失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  async function handleExplainTag(tagName: string) {
    setTagModal({ title: tagName, desc: "玄机推演中…", loading: true });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "explain_tag", baziStr: currentBaziStr, tagName }),
      });
      if (!res.ok || !res.body) throw new Error("请求失败");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTagModal({ title: tagName, desc: acc, loading: false });
      }
    } catch {
      setTagModal({ title: tagName, desc: "解析失败，请稍后再试。", loading: false });
    }
  }

  const parsedResult = useMemo(() => {
    const idx = result.indexOf(TAG_SEPARATOR);
    if (idx === -1) return { text: result, tags: [] };
    const text = result.slice(0, idx).trim();
    const tagsRaw = result.slice(idx + TAG_SEPARATOR.length).trim();
    const tags = tagsRaw.split("|").filter(Boolean).map(t => {
      const [name, desc] = t.split(":");
      return { name: name?.trim(), desc: desc ? desc.trim() : "" };
    }).filter(t => t.name && t.desc);
    return { text, tags };
  }, [result]);

  const years = Array.from({ length: 111 }, (_, i) => 1940 + i);

  return (
    <main className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="stars" aria-hidden="true" />

      <p className="text-sm tracking-[0.45em] text-[#e7c56a]/80">FORTUNE</p>
      <h1 className="mt-4 text-5xl tracking-[0.2em] text-[#f6e3a1] drop-shadow-[0_0_18px_rgba(243,212,138,0.35)]">
        今日命签
      </h1>

      <div className="mt-6 inline-flex rounded-full border border-[#e7c56a]/30 p-1">
        <button type="button" onClick={() => setMode("fortune")} className={`rounded-full px-5 py-1.5 text-sm tracking-widest transition ${mode === "fortune" ? "bg-[#e7c56a]/90 text-[#1a1408]" : "text-[#f6e3a1]/70 hover:text-[#f6e3a1]"}`}>抽签</button>
        <button type="button" onClick={() => setMode("bazi")} className={`rounded-full px-5 py-1.5 text-sm tracking-widest transition ${mode === "bazi" ? "bg-[#e7c56a]/90 text-[#1a1408]" : "text-[#f6e3a1]/70 hover:text-[#f6e3a1]"}`}>测命格</button>
      </div>

      {mode === "fortune" ? (
        <>
          <p className="mt-4 text-lg tracking-widest text-[#f6e3a1]/75">心诚则灵，轻触金钮</p>
          <DrawButton />
        </>
      ) : (
        <div className="mt-6 flex w-full max-w-md flex-col items-stretch gap-4">
          
          <div className="flex items-center justify-between text-sm tracking-widest text-[#f6e3a1]/80">
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-1">
                <input type="radio" checked={calendar === "solar"} onChange={() => !isReverse && setCalendar("solar")} disabled={isReverse} className="accent-[#e7c56a]" /> 公历
              </label>
              <label className="flex cursor-pointer items-center gap-1">
                <input type="radio" checked={calendar === "lunar"} onChange={() => !isReverse && setCalendar("lunar")} disabled={isReverse} className="accent-[#e7c56a]" /> 农历
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[#e7c56a]">
              <input type="checkbox" checked={isReverse} onChange={(e) => setIsReverse(e.target.checked)} className="accent-[#e7c56a]" />
              未知日期 / 纯四柱反推
            </label>
          </div>

          {/* 日期选择区 (反推时变灰) */}
          <div className={`grid grid-cols-4 gap-2 text-sm tracking-widest text-[#f6e3a1]/70 transition-opacity ${isReverse ? "opacity-30 pointer-events-none" : ""}`}>
            <label className="flex flex-col items-start gap-1">年<select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/30 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1">月<select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/30 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1">日<select value={day} onChange={(e) => setDay(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/30 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1">时<select value={hour} onChange={(e) => setHour(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/30 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{HOURS.map(h => <option key={h.value} value={h.value}>{h.branch}时</option>)}</select></label>
          </div>

          {/* 四柱选择区 */}
          <div className="mt-2 grid grid-cols-4 gap-2 text-sm tracking-widest text-[#f6e3a1]/70">
            <label className="flex flex-col items-start gap-1 text-[#e7c56a]">年柱<select value={baziYear} onChange={(e) => setBaziYear(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/50 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{SIXTY_JIAZI.map(j => <option key={j} value={j}>{j}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1 text-[#e7c56a]">月柱<select value={baziMonth} onChange={(e) => setBaziMonth(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/50 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{SIXTY_JIAZI.map(j => <option key={j} value={j}>{j}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1 text-[#e7c56a]">日柱<select value={baziDay} onChange={(e) => setBaziDay(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/50 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{SIXTY_JIAZI.map(j => <option key={j} value={j}>{j}</option>)}</select></label>
            <label className="flex flex-col items-start gap-1 text-[#e7c56a]">时柱<select value={baziHourBranch} onChange={(e) => setBaziHourBranch(e.target.value)} className="w-full rounded-md border border-[#e7c56a]/50 bg-[#1a1408]/60 px-1 py-2 text-[#f6e3a1] outline-none">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          </div>

          <div className="mt-1 text-center text-sm tracking-widest text-[#f6e3a1] bg-[#e7c56a]/10 py-2 rounded-md border border-[#e7c56a]/20">
            当前排盘：<span className="text-[#e7c56a] font-bold">{currentBaziStr}</span>
          </div>

          <button
            type="button"
            onClick={handleBazi}
            disabled={loading}
            className="mt-2 rounded-full bg-gradient-to-b from-[#f6e3a1] to-[#c9a24b] px-8 py-3 text-base font-medium tracking-[0.2em] text-[#1a1408] shadow-[0_0_24px_rgba(243,212,138,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "推演中…" : isReverse ? "反推时间并验证" : "推算命格"}
          </button>

          {error && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 tracking-wider text-red-300/90">{error}</p>
          )}

          {(result || loading) && (
            <div aria-live="polite" className="mt-4 flex flex-col gap-4 rounded-lg border border-[#e7c56a]/25 bg-[#1a1408]/50 p-5 text-left">
              <p className="whitespace-pre-wrap text-[15px] leading-7 tracking-wide text-[#f6e3a1]/90">
                {parsedResult.text || "紫微星盘缓缓转动…"}
              </p>
              
              {parsedResult.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#e7c56a]/20">
                  {parsedResult.tags.map((tag, i) => (
                    <button key={i} onClick={() => handleExplainTag(tag.name)} className="group flex flex-col items-start rounded border border-[#e7c56a]/40 bg-[#e7c56a]/10 px-3 py-1.5 transition hover:bg-[#e7c56a]/20">
                      <span className="text-xs font-bold tracking-widest text-[#e7c56a]">{tag.name}</span>
                      <span className="mt-0.5 text-[11px] text-[#f6e3a1]/70">{tag.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {tagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setTagModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-[#e7c56a]/40 bg-[#1a1408] p-6 text-left shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold tracking-widest text-[#f6e3a1]">{tagModal.title}</h3>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 tracking-wide text-[#e7c56a]/80">{tagModal.desc}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setTagModal(null)} className="rounded border border-[#e7c56a]/40 px-5 py-1.5 text-sm tracking-widest text-[#f6e3a1] hover:bg-[#e7c56a]/10">关闭</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}