export function pushRecentSearch(q: string) {
  const arr = JSON.parse(localStorage.getItem("recent_uni_searches") || "[]");
  const next = [q, ...arr.filter((x:string)=>x!==q)].slice(0,5);
  localStorage.setItem("recent_uni_searches", JSON.stringify(next));
}

export function loadRecentSearches(): string[] {
  return JSON.parse(localStorage.getItem("recent_uni_searches") || "[]");
}
