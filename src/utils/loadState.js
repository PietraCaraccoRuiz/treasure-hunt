export default function loadState() {
  try {
    const s = localStorage.getItem("cacaPokebolas_v1");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
